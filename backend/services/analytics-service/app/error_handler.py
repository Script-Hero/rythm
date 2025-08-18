"""
Error handling and retry mechanisms for Analytics Service.
"""

import asyncio
import functools
from typing import Any, Callable, Optional, Type, Union, List
from datetime import datetime

import structlog
from sqlalchemy.exc import SQLAlchemyError
from redis.exceptions import RedisError
from aiokafka.errors import KafkaError

logger = structlog.get_logger()


class AnalyticsServiceError(Exception):
    """Base exception for Analytics Service."""
    pass


class DatabaseError(AnalyticsServiceError):
    """Database operation error."""
    pass


class CacheError(AnalyticsServiceError):
    """Cache operation error."""
    pass


class KafkaProcessingError(AnalyticsServiceError):
    """Kafka message processing error."""
    pass


class CalculationError(AnalyticsServiceError):
    """Analytics calculation error."""
    pass


def retry_async(
    max_attempts: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: Union[Type[Exception], tuple] = Exception,
    on_retry: Optional[Callable] = None
):
    """
    Async retry decorator with exponential backoff.
    
    Args:
        max_attempts: Maximum number of retry attempts
        delay: Initial delay between retries in seconds
        backoff: Backoff multiplier for delay
        exceptions: Exception types to retry on
        on_retry: Optional callback function called on each retry
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            current_delay = delay
            
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                
                except exceptions as e:
                    last_exception = e
                    
                    if attempt == max_attempts - 1:
                        # Last attempt failed, re-raise
                        logger.error(
                            "All retry attempts failed",
                            function=func.__name__,
                            attempts=max_attempts,
                            error=str(e)
                        )
                        raise
                    
                    # Log retry attempt
                    logger.warning(
                        "Function failed, retrying",
                        function=func.__name__,
                        attempt=attempt + 1,
                        max_attempts=max_attempts,
                        delay=current_delay,
                        error=str(e)
                    )
                    
                    # Call retry callback if provided
                    if on_retry:
                        try:
                            await on_retry(attempt + 1, e)
                        except Exception as callback_error:
                            logger.error("Retry callback failed", error=str(callback_error))
                    
                    # Wait before retry
                    await asyncio.sleep(current_delay)
                    current_delay *= backoff
                
                except Exception as e:
                    # Non-retryable exception
                    logger.error(
                        "Non-retryable exception in function",
                        function=func.__name__,
                        error=str(e)
                    )
                    raise
            
            # This should never be reached, but just in case
            if last_exception:
                raise last_exception
        
        return wrapper
    return decorator


def handle_database_errors(func: Callable) -> Callable:
    """Decorator to handle database errors and convert to service errors."""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except SQLAlchemyError as e:
            logger.error("Database error", function=func.__name__, error=str(e))
            raise DatabaseError(f"Database operation failed: {str(e)}") from e
        except Exception as e:
            logger.error("Unexpected error in database operation", function=func.__name__, error=str(e))
            raise
    
    return wrapper


def handle_cache_errors(func: Callable) -> Callable:
    """Decorator to handle cache errors gracefully."""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except RedisError as e:
            logger.warning("Cache error, continuing without cache", function=func.__name__, error=str(e))
            # For cache operations, we often want to continue without cache
            return None
        except Exception as e:
            logger.error("Unexpected error in cache operation", function=func.__name__, error=str(e))
            # Decide whether to re-raise or return None based on operation type
            return None
    
    return wrapper


def handle_kafka_errors(func: Callable) -> Callable:
    """Decorator to handle Kafka errors."""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except KafkaError as e:
            logger.error("Kafka error", function=func.__name__, error=str(e))
            raise KafkaProcessingError(f"Kafka operation failed: {str(e)}") from e
        except Exception as e:
            logger.error("Unexpected error in Kafka operation", function=func.__name__, error=str(e))
            raise
    
    return wrapper


def handle_calculation_errors(func: Callable) -> Callable:
    """Decorator to handle analytics calculation errors."""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except (ValueError, TypeError, ZeroDivisionError, OverflowError) as e:
            logger.error("Calculation error", function=func.__name__, error=str(e))
            raise CalculationError(f"Analytics calculation failed: {str(e)}") from e
        except Exception as e:
            logger.error("Unexpected error in calculation", function=func.__name__, error=str(e))
            raise
    
    return wrapper


class CircuitBreaker:
    """
    Circuit breaker implementation for service resilience.
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        expected_exception: Type[Exception] = Exception
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        
        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
    
    def __call__(self, func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            if self.state == "OPEN":
                if self._should_attempt_reset():
                    self.state = "HALF_OPEN"
                    logger.info("Circuit breaker transitioning to HALF_OPEN", function=func.__name__)
                else:
                    logger.warning("Circuit breaker is OPEN, blocking call", function=func.__name__)
                    raise AnalyticsServiceError("Service temporarily unavailable (circuit breaker open)")
            
            try:
                result = await func(*args, **kwargs)
                self._on_success()
                return result
            
            except self.expected_exception as e:
                self._on_failure()
                raise
        
        return wrapper
    
    def _should_attempt_reset(self) -> bool:
        """Check if we should attempt to reset the circuit breaker."""
        if self.last_failure_time is None:
            return True
        
        elapsed = (datetime.utcnow() - self.last_failure_time).total_seconds()
        return elapsed >= self.recovery_timeout
    
    def _on_success(self):
        """Handle successful operation."""
        if self.state == "HALF_OPEN":
            self.state = "CLOSED"
            self.failure_count = 0
            logger.info("Circuit breaker reset to CLOSED")
    
    def _on_failure(self):
        """Handle failed operation."""
        self.failure_count += 1
        self.last_failure_time = datetime.utcnow()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(
                "Circuit breaker opened",
                failure_count=self.failure_count,
                threshold=self.failure_threshold
            )


# Pre-configured retry decorators for common operations
retry_database = retry_async(
    max_attempts=3,
    delay=0.5,
    exceptions=(SQLAlchemyError, DatabaseError)
)

retry_cache = retry_async(
    max_attempts=2,
    delay=0.1,
    exceptions=(RedisError, CacheError)
)

retry_kafka = retry_async(
    max_attempts=3,
    delay=1.0,
    exceptions=(KafkaError, KafkaProcessingError)
)

# Circuit breakers for external services
database_circuit_breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=30.0,
    expected_exception=DatabaseError
)

cache_circuit_breaker = CircuitBreaker(
    failure_threshold=3,
    recovery_timeout=10.0,
    expected_exception=CacheError
)


async def log_error_context(
    error: Exception,
    context: dict,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None
):
    """Log error with full context for debugging."""
    error_data = {
        "error_type": type(error).__name__,
        "error_message": str(error),
        "context": context,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    if user_id:
        error_data["user_id"] = user_id
    
    if session_id:
        error_data["session_id"] = session_id
    
    logger.error("Detailed error context", **error_data)