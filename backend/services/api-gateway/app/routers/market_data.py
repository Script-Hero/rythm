"""
API Gateway - Market Data Routes
Proxies requests to the Market Data Service.
"""

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Request, status
from typing import Dict, Any

logger = structlog.get_logger()

router = APIRouter()

# Market Data service URL
MARKET_DATA_SERVICE_URL = "http://market-data-service:8001"


async def proxy_to_market_data_service(
    method: str,
    path: str,
    body: Dict[str, Any] = None,
    params: Dict[str, str] = None
) -> Dict[str, Any]:
    """Helper function to proxy requests to Market Data Service."""
    try:
        headers = {"Content-Type": "application/json"}
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{MARKET_DATA_SERVICE_URL}{path}"
            
            if method.upper() == "GET":
                response = await client.get(url, headers=headers, params=params)
            elif method.upper() == "POST":
                response = await client.post(url, headers=headers, json=body)
            elif method.upper() == "DELETE":
                response = await client.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            if response.status_code < 400:
                return response.json()
            else:
                error_detail = "Market data service error"
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
        logger.error("Market data service timeout")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Market data service timeout"
        )
    except httpx.RequestError as e:
        logger.error("Market data service connection error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Market data service unavailable"
        )


@router.get("/symbols")
async def list_symbols(request: Request):
    """List available trading symbols."""
    params = dict(request.query_params)
    return await proxy_to_market_data_service("GET", "/symbols", params=params)


@router.get("/symbols/search")
async def search_symbols(request: Request):
    """Search for symbols."""
    params = dict(request.query_params)  
    return await proxy_to_market_data_service("GET", "/symbols/search", params=params)


@router.get("/symbols/{symbol:path}/latest")
async def get_latest_prices(symbol: str, request: Request):
    """Get latest prices for symbol."""
    params = dict(request.query_params)
    return await proxy_to_market_data_service("GET", f"/symbols/{symbol}/latest", params=params)


@router.get("/symbols/{symbol:path}/stream")
async def get_price_stream_info(symbol: str):
    """Get price stream info for symbol."""
    return await proxy_to_market_data_service("GET", f"/symbols/{symbol}/stream")


@router.post("/symbols/{symbol:path}/subscribe")
async def subscribe_to_symbol(symbol: str):
    """Subscribe to real-time data for symbol."""
    return await proxy_to_market_data_service("POST", f"/symbols/{symbol}/subscribe")


@router.delete("/symbols/{symbol:path}/unsubscribe")
async def unsubscribe_from_symbol(symbol: str):
    """Unsubscribe from real-time data for symbol."""
    return await proxy_to_market_data_service("DELETE", f"/symbols/{symbol}/unsubscribe")


@router.post("/historical")
async def get_historical_data(request: Request):
    """Get historical OHLCV data."""
    body = await request.json()
    return await proxy_to_market_data_service("POST", "/historical", body)


@router.get("/currencies/base")
async def list_base_currencies():
    """List available base currencies."""
    return await proxy_to_market_data_service("GET", "/currencies/base")


@router.get("/currencies/quote")
async def list_quote_currencies():
    """List available quote currencies."""
    return await proxy_to_market_data_service("GET", "/currencies/quote")


@router.post("/validate")
async def validate_symbol_date_range(request: Request):
    """Validate symbol and date range for backtesting."""
    body = await request.json()
    return await proxy_to_market_data_service("POST", "/validate", body)


@router.get("/symbols/{symbol:path}/date-range")
async def get_symbol_date_range(symbol: str):
    """Get available date range for a symbol."""
    return await proxy_to_market_data_service("GET", f"/symbols/{symbol}/date-range")