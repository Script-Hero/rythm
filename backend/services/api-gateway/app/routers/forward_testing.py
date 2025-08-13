"""
API Gateway - Forward Testing Routes  
Proxies requests to the Forward Testing Service.
"""

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Depends, Request, status
from typing import Dict, Any

import sys
import os

# Add shared modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../..'))
from shared.auth_dependency import get_current_user

logger = structlog.get_logger()

router = APIRouter()

# Forward Testing service URL
FORWARD_TEST_SERVICE_URL = "http://forward-test-service:8003"


async def proxy_to_forward_test_service(
    method: str,
    path: str,
    current_user,
    body: Dict[str, Any] = None,
    params: Dict[str, str] = None
) -> Dict[str, Any]:
    """Helper function to proxy requests to Forward Testing Service."""
    try:
        headers = {
            "Content-Type": "application/json",
            "X-User-ID": str(current_user.id)
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{FORWARD_TEST_SERVICE_URL}{path}"
            
            if method.upper() == "GET":
                response = await client.get(url, headers=headers, params=params)
            elif method.upper() == "POST":
                response = await client.post(url, headers=headers, json=body)
            elif method.upper() == "PUT":
                response = await client.put(url, headers=headers, json=body)
            elif method.upper() == "PATCH":
                response = await client.patch(url, headers=headers, json=body)
            elif method.upper() == "DELETE":
                response = await client.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            if response.status_code < 400:
                return response.json()
            else:
                error_detail = "Forward testing service error"
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
        logger.error("Forward testing service timeout")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Forward testing service timeout"
        )
    except httpx.RequestError as e:
        logger.error("Forward testing service connection error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Forward testing service unavailable"
        )


@router.post("/")
async def create_session(
    request: Request,
    current_user = Depends(get_current_user)
):
    """Create a new forward testing session."""
    body = await request.json()
    return await proxy_to_forward_test_service("POST", "/", current_user, body)


@router.get("/")  
async def list_sessions(
    request: Request,
    current_user = Depends(get_current_user)
):
    """List user's forward testing sessions."""
    params = dict(request.query_params)
    return await proxy_to_forward_test_service("GET", "/", current_user, params=params)


@router.get("/{session_id}")
async def get_session(
    session_id: str,
    current_user = Depends(get_current_user)
):
    """Get a specific forward testing session."""
    return await proxy_to_forward_test_service("GET", f"/{session_id}", current_user)


@router.patch("/{session_id}")
async def update_session(
    session_id: str,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Update a forward testing session."""
    body = await request.json()
    return await proxy_to_forward_test_service("PATCH", f"/{session_id}", current_user, body)


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a forward testing session."""
    return await proxy_to_forward_test_service("DELETE", f"/{session_id}", current_user)


@router.post("/{session_id}/start")
async def start_session(
    session_id: str,
    current_user = Depends(get_current_user)
):
    """Start a forward testing session."""
    return await proxy_to_forward_test_service("POST", f"/{session_id}/start", current_user)


@router.post("/{session_id}/stop")
async def stop_session(
    session_id: str,
    current_user = Depends(get_current_user)
):
    """Stop a forward testing session."""
    return await proxy_to_forward_test_service("POST", f"/{session_id}/stop", current_user)


@router.get("/{session_id}/portfolio")
async def get_portfolio(
    session_id: str,
    current_user = Depends(get_current_user)
):
    """Get session portfolio."""
    return await proxy_to_forward_test_service("GET", f"/{session_id}/portfolio", current_user)


@router.get("/{session_id}/metrics")
async def get_metrics(
    session_id: str,
    current_user = Depends(get_current_user)
):
    """Get session metrics."""
    return await proxy_to_forward_test_service("GET", f"/{session_id}/metrics", current_user)


@router.get("/{session_id}/trades")
async def get_trades(
    session_id: str,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Get session trades."""
    params = dict(request.query_params)
    return await proxy_to_forward_test_service("GET", f"/{session_id}/trades", current_user, params=params)


@router.get("/{session_id}/chart")
async def get_chart_data(
    session_id: str,
    current_user = Depends(get_current_user)
):
    """Get session chart data."""
    return await proxy_to_forward_test_service("GET", f"/{session_id}/chart", current_user)


@router.post("/restore")
async def restore_session_data(
    request: Request,
    current_user = Depends(get_current_user)
):
    """Restore session data."""
    body = await request.json()
    return await proxy_to_forward_test_service("POST", "/restore", current_user, body)