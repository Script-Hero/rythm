"""
Signal validation utilities for AlgoTrade Forward Testing.
Provides comprehensive signal schema validation and normalization.
"""

import structlog
from typing import Dict, Any, Optional, List, Union
from decimal import Decimal, InvalidOperation
import time

logger = structlog.get_logger("signal_validation")


class SignalValidationError(Exception):
    """Raised when signal validation fails."""
    pass


class SignalValidator:
    """
    Comprehensive signal validation and normalization utility.
    Ensures all trading signals conform to expected schema and data types.
    """
    
    VALID_ACTIONS = ['BUY', 'SELL', 'HOLD']
    VALID_ORDER_TYPES = ['market', 'limit', 'stop', 'stop_limit']
    
    @classmethod
    def validate_and_normalize_signal(
        cls,
        signal: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Validate and normalize a trading signal.
        
        Args:
            signal: Raw signal dictionary
            context: Optional context (session_id, symbol, etc.) for enrichment
            
        Returns:
            Normalized signal dictionary or None if validation fails
        """
        try:
            if not signal or not isinstance(signal, dict):
                logger.warning("Invalid signal structure", signal=signal)
                return None
            
            normalized = {}
            
            # Validate and normalize action
            action = cls._validate_action(signal.get('action'))
            if not action:
                return None
            normalized['action'] = action
            
            # Skip further validation for HOLD signals
            if action == 'HOLD':
                normalized.update({
                    'timestamp': signal.get('timestamp', time.time()),
                    'order_type': 'market'
                })
                return normalized
            
            # Validate order type
            normalized['order_type'] = cls._validate_order_type(
                signal.get('order_type', 'market')
            )
            
            # Handle quantity/position_size
            quantity_result = cls._validate_quantity_or_position_size(signal)
            if not quantity_result:
                return None
            normalized.update(quantity_result)
            
            # Validate symbol (if provided or in context)
            symbol = signal.get('symbol') or (context and context.get('symbol'))
            if symbol:
                normalized['symbol'] = cls._validate_symbol(symbol)
            
            # Validate current price (if provided)
            if 'current_price' in signal:
                price = cls._validate_price(signal['current_price'])
                if price is not None:
                    normalized['current_price'] = price
            
            # Handle sell-specific parameters
            if action == 'SELL':
                sell_percent = cls._validate_sell_percent(
                    signal.get('sell_percent', 1.0)
                )
                normalized['sell_percent'] = sell_percent
            
            # Add timestamp
            normalized['timestamp'] = signal.get('timestamp', time.time())
            
            # Copy other valid fields
            for field in ['original_quantity', 'order_id', 'strategy_id']:
                if field in signal:
                    normalized[field] = signal[field]
            
            logger.debug("Signal validation successful", 
                        original=signal, 
                        normalized=normalized)
            
            return normalized
            
        except Exception as e:
            logger.error("Signal validation failed", 
                        signal=signal, 
                        error=str(e))
            return None
    
    @classmethod
    def _validate_action(cls, action: Any) -> Optional[str]:
        """Validate trading action."""
        if not action:
            logger.warning("Missing action in signal")
            return None
        
        action_str = str(action).upper()
        if action_str not in cls.VALID_ACTIONS:
            logger.warning("Invalid action in signal", 
                         action=action, 
                         valid_actions=cls.VALID_ACTIONS)
            return None
        
        return action_str
    
    @classmethod
    def _validate_order_type(cls, order_type: Any) -> str:
        """Validate and normalize order type."""
        if not order_type:
            return 'market'
        
        order_type_str = str(order_type).lower()
        if order_type_str not in cls.VALID_ORDER_TYPES:
            logger.warning("Invalid order type, using market", 
                         order_type=order_type)
            return 'market'
        
        return order_type_str
    
    @classmethod
    def _validate_quantity_or_position_size(
        cls, 
        signal: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Validate quantity or position_size and convert appropriately."""
        result = {}
        
        # Check for position_size first (preferred)
        if 'position_size' in signal:
            position_size = cls._validate_position_size(signal['position_size'])
            if position_size is None:
                return None
            result['position_size'] = position_size
            
        elif 'quantity' in signal:
            # Convert quantity to position_size
            try:
                quantity = float(signal['quantity'])
                if quantity <= 0:
                    logger.warning("Invalid quantity in signal", quantity=quantity)
                    return None
                
                # Convert quantity to position size (treat as percentage)
                position_size = min(quantity / 100.0, 1.0)
                result['position_size'] = position_size
                result['original_quantity'] = quantity
                
                logger.debug("Converted quantity to position_size", 
                           quantity=quantity, 
                           position_size=position_size)
                
            except (ValueError, TypeError) as e:
                logger.warning("Failed to convert quantity", 
                             quantity=signal.get('quantity'), 
                             error=str(e))
                return None
        else:
            # Default position size
            result['position_size'] = 0.1  # 10% default
            logger.debug("Using default position size", position_size=0.1)
        
        return result
    
    @classmethod
    def _validate_position_size(cls, position_size: Any) -> Optional[float]:
        """Validate position size (should be between 0 and 1)."""
        try:
            size = float(position_size)
            if size <= 0 or size > 1:
                logger.warning("Position size out of range (0, 1]", position_size=size)
                return None
            return size
        except (ValueError, TypeError) as e:
            logger.warning("Invalid position size format", 
                         position_size=position_size, 
                         error=str(e))
            return None
    
    @classmethod
    def _validate_sell_percent(cls, sell_percent: Any) -> float:
        """Validate sell percentage (should be between 0 and 1)."""
        try:
            percent = float(sell_percent)
            if percent <= 0 or percent > 1:
                logger.warning("Invalid sell percent, using 100%", sell_percent=percent)
                return 1.0
            return percent
        except (ValueError, TypeError):
            logger.warning("Invalid sell percent format, using 100%", 
                         sell_percent=sell_percent)
            return 1.0
    
    @classmethod
    def _validate_symbol(cls, symbol: Any) -> Optional[str]:
        """Validate trading symbol."""
        if not symbol:
            return None
        
        symbol_str = str(symbol).strip().upper()
        if len(symbol_str) < 2:
            logger.warning("Invalid symbol format", symbol=symbol)
            return None
        
        return symbol_str
    
    @classmethod
    def _validate_price(cls, price: Any) -> Optional[float]:
        """Validate price value."""
        try:
            price_float = float(price)
            if price_float <= 0:
                logger.warning("Invalid price value", price=price)
                return None
            return price_float
        except (ValueError, TypeError) as e:
            logger.warning("Invalid price format", price=price, error=str(e))
            return None
    
    @classmethod
    def validate_signal_batch(
        cls, 
        signals: List[Dict[str, Any]],
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Validate a batch of signals."""
        validated_signals = []
        
        for i, signal in enumerate(signals):
            validated = cls.validate_and_normalize_signal(signal, context)
            if validated:
                validated_signals.append(validated)
            else:
                logger.warning("Signal validation failed in batch", 
                             index=i, 
                             signal=signal)
        
        logger.info("Signal batch validation completed", 
                   input_count=len(signals),
                   validated_count=len(validated_signals))
        
        return validated_signals
    
    @classmethod
    def create_signal_schema_summary(cls) -> Dict[str, Any]:
        """Create a summary of the expected signal schema."""
        return {
            "required_fields": ["action"],
            "optional_fields": [
                "symbol", "current_price", "position_size", "quantity", 
                "sell_percent", "order_type", "timestamp"
            ],
            "valid_actions": cls.VALID_ACTIONS,
            "valid_order_types": cls.VALID_ORDER_TYPES,
            "position_size_range": "0.0 < position_size <= 1.0",
            "sell_percent_range": "0.0 < sell_percent <= 1.0",
            "quantity_conversion": "quantity converted to position_size = min(quantity/100, 1.0)"
        }


# Convenience functions for common validation tasks
def validate_signal(signal: Dict[str, Any], **context) -> Optional[Dict[str, Any]]:
    """Convenience function for single signal validation."""
    return SignalValidator.validate_and_normalize_signal(signal, context)


def validate_signals(signals: List[Dict[str, Any]], **context) -> List[Dict[str, Any]]:
    """Convenience function for batch signal validation."""
    return SignalValidator.validate_signal_batch(signals, context)