"""
API Gateway - Strategies Routes
Proxies requests to the Strategy Service.
"""

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Depends, Request, status
from typing import Dict, Any

from ..auth import get_current_user

logger = structlog.get_logger()

router = APIRouter()

# Strategy service URL
STRATEGY_SERVICE_URL = "http://strategy-service:8002"


async def proxy_to_strategy_service(
    method: str,
    path: str, 
    current_user,
    body: Dict[str, Any] = None,
    params: Dict[str, str] = None
) -> Dict[str, Any]:
    """Helper function to proxy requests to Strategy Service."""
    try:
        headers = {
            "Content-Type": "application/json",
            "X-User-ID": str(current_user.id)
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{STRATEGY_SERVICE_URL}{path}"
            
            if method.upper() == "GET":
                response = await client.get(url, headers=headers, params=params)
            elif method.upper() == "POST":
                response = await client.post(url, headers=headers, json=body)
            elif method.upper() == "PUT":
                response = await client.put(url, headers=headers, json=body)
            elif method.upper() == "DELETE":
                response = await client.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            if response.status_code < 400:
                return response.json()
            else:
                # Forward error from strategy service
                error_detail = "Strategy service error"
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
        logger.error("Strategy service timeout")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Strategy service timeout"
        )
    except httpx.RequestError as e:
        logger.error("Strategy service connection error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Strategy service unavailable"
        )


@router.post("/")
async def create_strategy(
    request: Request,
    current_user = Depends(get_current_user)
):
    """Create a new strategy."""
    body = await request.json()
    return await proxy_to_strategy_service("POST", "/", current_user, body)


@router.get("/")
async def list_strategies(
    request: Request,
    current_user = Depends(get_current_user)
):
    """List user's strategies."""
    params = dict(request.query_params)
    return await proxy_to_strategy_service("GET", "/", current_user, params=params)


@router.get("/{strategy_id}")
async def get_strategy(
    strategy_id: str,
    current_user = Depends(get_current_user)
):
    """Get a specific strategy."""
    return await proxy_to_strategy_service("GET", f"/{strategy_id}", current_user)


@router.put("/{strategy_id}")
async def update_strategy(
    strategy_id: str,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Update a strategy."""
    body = await request.json()
    return await proxy_to_strategy_service("PUT", f"/{strategy_id}", current_user, body)


@router.delete("/{strategy_id}")
async def delete_strategy(
    strategy_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a strategy."""
    return await proxy_to_strategy_service("DELETE", f"/{strategy_id}", current_user)


@router.post("/{strategy_id}/duplicate")
async def duplicate_strategy(
    strategy_id: str,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Duplicate a strategy."""
    body = await request.json()
    return await proxy_to_strategy_service("POST", f"/{strategy_id}/duplicate", current_user, body)


@router.get("/search")
async def search_strategies(
    request: Request,
    current_user = Depends(get_current_user)
):
    """Search strategies."""
    params = dict(request.query_params)
    return await proxy_to_strategy_service("GET", "/search", current_user, params=params)


@router.get("/stats")
async def get_strategy_stats(
    current_user = Depends(get_current_user)
):
    """Get strategy statistics."""
    return await proxy_to_strategy_service("GET", "/stats", current_user)