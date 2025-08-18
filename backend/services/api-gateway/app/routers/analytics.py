"""
API Gateway - Analytics Routes
Proxy routes to Analytics Service.
"""

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.responses import JSONResponse
from typing import Dict, Any

import sys
import os

# Add shared modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../..'))
from shared.auth_dependency import get_current_user

logger = structlog.get_logger()

router = APIRouter()

# Analytics Service URL
ANALYTICS_SERVICE_URL = os.getenv("ANALYTICS_SERVICE_URL", "http://localhost:8006")


async def proxy_to_analytics_service(
    request: Request,
    path: str,
    current_user = Depends(get_current_user)
) -> JSONResponse:
    """
    Proxy request to Analytics Service.
    
    Args:
        request: Original FastAPI request
        path: Path to append to analytics service URL
        current_user: Current authenticated user
    """
    try:
        # Get authorization header
        auth_header = request.headers.get("authorization")
        if not auth_header:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        headers = {
            "authorization": auth_header,
            "content-type": "application/json"
        }
        
        # Construct URL
        url = f"{ANALYTICS_SERVICE_URL}{path}"
        
        # Get query parameters
        query_params = dict(request.query_params)
        
        async with httpx.AsyncClient() as client:
            if request.method == "GET":
                response = await client.get(url, headers=headers, params=query_params)
            elif request.method == "POST":
                body = await request.body()
                response = await client.post(url, headers=headers, content=body, params=query_params)
            elif request.method == "PUT":
                body = await request.body()
                response = await client.put(url, headers=headers, content=body, params=query_params)
            elif request.method == "DELETE":
                response = await client.delete(url, headers=headers, params=query_params)
            else:
                raise HTTPException(status_code=405, detail="Method not allowed")
        
        return JSONResponse(
            status_code=response.status_code,
            content=response.json(),
            headers=dict(response.headers)
        )
    
    except httpx.RequestError as e:
        logger.error("Analytics service connection error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Analytics service unavailable"
        )
    
    except httpx.HTTPStatusError as e:
        logger.error("Analytics service HTTP error", status_code=e.response.status_code, error=str(e))
        raise HTTPException(
            status_code=e.response.status_code,
            detail="Analytics service error"
        )
    
    except Exception as e:
        logger.error("Analytics proxy error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


# Forward Testing Analytics Routes
@router.get("/forward-test/{session_id}/live")
async def get_live_analytics(
    session_id: str,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Get real-time analytics for forward testing session."""
    return await proxy_to_analytics_service(
        request, 
        f"/api/analytics/forward-test/{session_id}/live",
        current_user
    )


@router.get("/forward-test/{session_id}/performance")
async def get_forward_test_performance(
    session_id: str,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Get performance summary for forward testing session."""
    return await proxy_to_analytics_service(
        request,
        f"/api/analytics/forward-test/{session_id}/performance",
        current_user
    )


# Backtest Analytics Routes
@router.get("/backtest/{backtest_id}/key-metrics")
async def get_backtest_key_metrics(
    backtest_id: str,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Get key metrics for backtest result."""
    return await proxy_to_analytics_service(
        request,
        f"/api/analytics/backtest/{backtest_id}/key-metrics",
        current_user
    )


@router.get("/backtest/{backtest_id}/summary")
async def get_backtest_summary(
    backtest_id: str,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Get complete analytics summary for backtest."""
    return await proxy_to_analytics_service(
        request,
        f"/api/analytics/backtest/{backtest_id}/summary",
        current_user
    )


@router.get("/backtest/{backtest_id}/drawdown")
async def get_backtest_drawdown(
    backtest_id: str,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Get drawdown analysis for backtest (future implementation)."""
    return await proxy_to_analytics_service(
        request,
        f"/api/analytics/backtest/{backtest_id}/drawdown",
        current_user
    )


@router.get("/backtest/{backtest_id}/returns/{period}")
async def get_backtest_returns(
    backtest_id: str,
    period: str,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Get returns analysis for backtest (future implementation)."""
    return await proxy_to_analytics_service(
        request,
        f"/api/analytics/backtest/{backtest_id}/returns/{period}",
        current_user
    )


# Health Check
@router.get("/health")
async def analytics_health_check():
    """Check Analytics Service health."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{ANALYTICS_SERVICE_URL}/health")
            return response.json()
    
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Analytics service unavailable"
        )