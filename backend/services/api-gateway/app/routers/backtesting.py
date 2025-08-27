"""
API Gateway - Backtesting Routes
Proxies requests to the Backtesting Service.
"""

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.responses import JSONResponse
from typing import Dict, Any

from ..config import settings
import sys
import os

# Add shared modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../..'))
from shared.auth_dependency import get_current_user

logger = structlog.get_logger()

router = APIRouter()

# Backtesting service URL
BACKTESTING_SERVICE_URL = "http://backtesting-service:8004"


@router.post("/run")
async def run_backtest(
    request: Request,
    current_user = Depends(get_current_user)
) -> Dict[str, Any]:
    """Proxy backtest run request to Backtesting Service."""
    try:
        # Get request body
        body = await request.json()
        
        # Add user context (convert UUID to string for JSON serialization)
        body["user_id"] = str(current_user.id)
        logger.info("🌉 API GW: Backtest proxy received",
                    user_id=str(current_user.id),
                    has_strategy_id='strategy_id' in body,
                    has_json_tree='json_tree' in body,
                    symbol=body.get('symbol'),
                    interval=body.get('interval'))
        
        # Proxy to backtesting service with authorization header
        auth_header = request.headers.get("authorization")
        headers = {
            "Content-Type": "application/json",
            "X-User-ID": str(current_user.id)
        }
        if auth_header:
            headers["Authorization"] = auth_header
            
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{BACKTESTING_SERVICE_URL}/run",
                json=body,
                headers=headers
            )
            logger.info("🌉 API GW: Forwarded to backtesting-service",
                        status_code=response.status_code,
                        ok=(200 <= response.status_code < 300))
            
            if response.status_code == 200:
                return response.json()
            else:
                # Forward error from backtesting service
                error_detail = "Backtesting service error"
                try:
                    error_data = response.json()
                    error_detail = error_data.get("detail", error_detail)
                except:
                    pass
                    
                raise HTTPException(
                    status_code=response.status_code,
                    detail=error_detail
                )
                
    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.error("Backtesting service timeout")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Backtesting service timeout"
        )
    except httpx.RequestError as e:
        logger.error("Backtesting service connection error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Backtesting service unavailable"
        )
    except Exception as e:
        logger.error("Backtest proxy error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.get("/{backtest_id}")
async def get_backtest_result(
    backtest_id: str,
    request: Request,
    current_user = Depends(get_current_user)
) -> Dict[str, Any]:
    """Proxy backtest result request to Backtesting Service."""
    try:
        # Forward authorization header
        auth_header = request.headers.get("authorization")
        headers = {"X-User-ID": str(current_user.id)}
        if auth_header:
            headers["Authorization"] = auth_header
            
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{BACKTESTING_SERVICE_URL}/{backtest_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to get backtest result"
                )
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get backtest result error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve backtest result"
        )


@router.get("/")
async def list_backtests(
    request: Request,
    current_user = Depends(get_current_user)
) -> Dict[str, Any]:
    """Proxy backtest list request to Backtesting Service."""
    try:
        # Forward authorization header
        auth_header = request.headers.get("authorization")
        headers = {"X-User-ID": str(current_user.id)}
        if auth_header:
            headers["Authorization"] = auth_header
            
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{BACKTESTING_SERVICE_URL}/",
                headers=headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to list backtests"
                )
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error("List backtests error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list backtests"
        )
