"""
Shared response models for consistent API responses across all services.

This module provides standardized response wrappers that the frontend expects,
ensuring consistent success/error handling across all microservices.
"""

from typing import Any, Optional
from pydantic import BaseModel


class StandardResponse(BaseModel):
    """
    Standard response wrapper used across all services.
    
    The frontend expects this format for all API responses:
    {
        "success": boolean,
        "data": any,
        "message": string
    }
    """
    success: bool = True
    data: Any = None
    message: str = ""

    @classmethod
    def success_response(cls, data: Any = None, message: str = ""):
        """Create a successful response."""
        return cls(success=True, data=data, message=message)
    
    @classmethod
    def error_response(cls, message: str, data: Any = None):
        """Create an error response."""
        return cls(success=False, data=data, message=message)


class ListResponse(StandardResponse):
    """
    Standard response for list endpoints.
    
    The frontend expects specific formats for lists:
    - Strategies: {"strategies": Strategy[]}
    - Sessions: {"sessions": ForwardTestSession[]}
    - Trades: {"trades": Trade[]}
    """
    
    @classmethod
    def strategies_response(cls, strategies: list, message: str = ""):
        """Create response for strategy lists."""
        return cls(success=True, data={"strategies": strategies}, message=message)
    
    @classmethod
    def sessions_response(cls, sessions: list, message: str = ""):
        """Create response for forward test session lists."""
        return cls(success=True, data={"sessions": sessions}, message=message)
    
    @classmethod
    def trades_response(cls, trades: list, message: str = ""):
        """Create response for trade lists.""" 
        return cls(success=True, data={"trades": trades}, message=message)


class SessionDetailResponse(StandardResponse):
    """
    Specific response format for forward test session details.
    
    Frontend expects:
    {
        "success": boolean,
        "data": {
            "session_detail": {
                "session": ForwardTestSession,
                "portfolio": Portfolio,
                "metrics": Metrics,
                "trades": Trade[]
            }
        }
    }
    """
    
    @classmethod
    def create(cls, session: Any, portfolio: Any = None, metrics: Any = None, trades: list = None):
        """Create session detail response."""
        return cls(
            success=True,
            data={
                "session_detail": {
                    "session": session,
                    "portfolio": portfolio or {},
                    "metrics": metrics or {},
                    "trades": trades or []
                }
            }
        )


class CreationResponse(StandardResponse):
    """
    Standard response for resource creation endpoints.
    
    Frontend expects:
    {
        "success": boolean,
        "data": {"id": string},
        "message": string
    }
    """
    
    @classmethod
    def create(cls, resource_id: str, message: str = "Resource created successfully"):
        """Create a resource creation response."""
        return cls(
            success=True,
            data={"id": resource_id},
            message=message
        )
    
    @classmethod
    def session_created(cls, session_id: str, message: str = "Forward test session created successfully"):
        """Create a session creation response."""
        return cls(
            success=True,
            data={"session_id": session_id, "id": session_id},
            message=message
        )
    
    @classmethod
    def strategy_created(cls, strategy_id: str, message: str = "Strategy created successfully"):
        """Create a strategy creation response."""
        return cls(
            success=True,
            data={"id": strategy_id},
            message=message
        )