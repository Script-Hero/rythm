"""
AlgoTrade Strategy Service
Handles strategy CRUD operations, compilation, and validation.
"""

import os
import sys
import time
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional
from uuid import UUID

import structlog
import uvicorn
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.responses import JSONResponse

# Add shared models to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../..'))

from shared.models.strategy_models import (
    StrategyCreate, StrategyUpdate, StrategyResponse, 
    StrategyCompilationResult, StrategySearchResult, StrategyStats
)
from shared.models.user_models import UserResponse
from shared.strategy_engine import StrategyCompiler, get_available_nodes
from shared.auth_dependency import get_current_user
from shared.auth_client import close_auth_client

from .config import settings
from .services import DatabaseService, RedisService, StrategyTemplateService

# Configure logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(30),
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    logger.info("🚀 Starting Strategy Service")
    
    # Initialize services
    await DatabaseService.initialize()
    await RedisService.initialize()
    await StrategyTemplateService.initialize()
    
    logger.info("✅ Strategy Service initialized")
    
    yield
    
    logger.info("🛑 Shutting down Strategy Service")
    await DatabaseService.close()
    await RedisService.close()
    await close_auth_client()


app = FastAPI(
    title="AlgoTrade Strategy Service",
    description="Strategy management, compilation, and validation service",
    version="1.0.0",
    lifespan=lifespan
)


# Strategy CRUD Operations
@app.post("/", response_model=StrategyResponse)
async def create_strategy(
    strategy: StrategyCreate,
    current_user: UserResponse = Depends(get_current_user)
) -> StrategyResponse:
    """Create a new strategy."""
    try:
        # Validate and compile strategy
        compiler = StrategyCompiler()
        compilation_result = compiler.compile_strategy(strategy.json_tree)
        
        if not compilation_result.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Strategy compilation failed",
                    "compilation_errors": compilation_result.errors,
                    "unknown_nodes": compilation_result.unknown_nodes
                }
            )
        
        # Save to database
        db_strategy = await DatabaseService.create_strategy(
            user_id=current_user.id,
            name=strategy.name,
            description=strategy.description,
            category=strategy.category,
            tags=strategy.tags,
            json_tree=strategy.json_tree,
            compilation_report=compilation_result.to_dict(),
            is_template=strategy.is_template
        )
        
        # Cache compiled strategy in Redis
        await RedisService.cache_compiled_strategy(
            str(db_strategy.id),
            compilation_result.strategy_instance
        )
        
        logger.info(
            "Strategy created",
            strategy_id=str(db_strategy.id),
            user_id=str(current_user.id),
            name=strategy.name
        )
        
        return db_strategy
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Strategy creation failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Strategy creation failed"
        )


@app.get("/", response_model=List[StrategyResponse])
async def list_strategies(
    category: Optional[str] = None,
    include_templates: bool = True,
    limit: int = 50,
    offset: int = 0,
    current_user: UserResponse = Depends(get_current_user)
) -> List[StrategyResponse]:
    """List user's strategies."""
    try:
        strategies = await DatabaseService.list_user_strategies(
            user_id=current_user.id,
            category=category,
            include_templates=include_templates,
            limit=limit,
            offset=offset
        )
        
        return strategies
        
    except Exception as e:
        logger.error("Failed to list strategies", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve strategies"
        )


@app.get("/{strategy_id}", response_model=StrategyResponse)
async def get_strategy(
    strategy_id: UUID,
    current_user: UserResponse = Depends(get_current_user)
) -> StrategyResponse:
    """Get a specific strategy."""
    try:
        strategy = await DatabaseService.get_strategy_by_id(strategy_id, current_user.id)
        
        if not strategy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found"
            )
        
        return strategy
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get strategy", strategy_id=str(strategy_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve strategy"
        )


@app.put("/{strategy_id}", response_model=StrategyResponse)
async def update_strategy(
    strategy_id: UUID,
    strategy_update: StrategyUpdate,
    current_user: UserResponse = Depends(get_current_user)
) -> StrategyResponse:
    """Update an existing strategy."""
    try:
        # Get existing strategy
        existing = await DatabaseService.get_strategy_by_id(strategy_id, current_user.id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found"
            )
        
        # If strategy structure changed, recompile
        compilation_result = None
        if strategy_update.json_tree is not None:
            compiler = StrategyCompiler()
            compilation_result = compiler.compile_strategy(strategy_update.json_tree)
            
            if not compilation_result.success:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "message": "Strategy compilation failed",
                        "compilation_errors": compilation_result.errors
                    }
                )
        
        # Update in database
        updated_strategy = await DatabaseService.update_strategy(
            strategy_id=strategy_id,
            user_id=current_user.id,
            **strategy_update.model_dump(exclude_unset=True),
            compilation_report=compilation_result.to_dict() if compilation_result else None
        )
        
        # Update Redis cache
        if compilation_result and compilation_result.strategy_instance:
            await RedisService.cache_compiled_strategy(
                str(strategy_id),
                compilation_result.strategy_instance
            )
        
        logger.info("Strategy updated", strategy_id=str(strategy_id))
        
        return updated_strategy
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Strategy update failed", strategy_id=str(strategy_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Strategy update failed"
        )


@app.delete("/{strategy_id}")
async def delete_strategy(
    strategy_id: UUID,
    current_user: UserResponse = Depends(get_current_user)
) -> Dict[str, Any]:
    """Delete a strategy."""
    try:
        success = await DatabaseService.delete_strategy(strategy_id, current_user.id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found"
            )
        
        # Remove from Redis cache
        await RedisService.remove_compiled_strategy(str(strategy_id))
        
        logger.info("Strategy deleted", strategy_id=str(strategy_id))
        
        return {"success": True, "message": "Strategy deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Strategy deletion failed", strategy_id=str(strategy_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Strategy deletion failed"
        )


# Strategy Compilation
@app.post("/{strategy_id}/compile", response_model=StrategyCompilationResult)
async def compile_strategy(
    strategy_id: UUID,
    current_user: UserResponse = Depends(get_current_user)
) -> StrategyCompilationResult:
    """Compile and validate a strategy."""
    try:
        # Get strategy
        strategy = await DatabaseService.get_strategy_by_id(strategy_id, current_user.id)
        if not strategy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found"
            )
        
        # Compile strategy
        compiler = StrategyCompiler()
        result = compiler.compile_strategy(strategy.json_tree)
        
        # Update compilation report in database
        await DatabaseService.update_compilation_report(strategy_id, result.to_dict())
        
        # Cache if successful
        if result.success and result.strategy_instance:
            await RedisService.cache_compiled_strategy(
                str(strategy_id),
                result.strategy_instance
            )
        
        return StrategyCompilationResult(
            success=result.success,
            report=result.to_dict(),
            error="; ".join(result.errors) if result.errors else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Strategy compilation failed", strategy_id=str(strategy_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Compilation failed"
        )


@app.post("/{strategy_id}/duplicate", response_model=StrategyResponse)
async def duplicate_strategy(
    strategy_id: UUID,
    current_user: UserResponse = Depends(get_current_user)
) -> StrategyResponse:
    """Duplicate an existing strategy."""
    try:
        # Get original strategy
        original = await DatabaseService.get_strategy_by_id(strategy_id, current_user.id)
        if not original:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found"
            )
        
        # Create duplicate with new name
        duplicate_name = f"{original.name} (Copy)"
        
        duplicated = await DatabaseService.create_strategy(
            user_id=current_user.id,
            name=duplicate_name,
            description=original.description,
            category=original.category,
            tags=original.tags,
            json_tree=original.json_tree,
            compilation_report=original.compilation_report,
            is_template=False  # Duplicates are never templates
        )
        
        logger.info("Strategy duplicated", original_id=str(strategy_id), new_id=str(duplicated.id))
        
        return duplicated
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Strategy duplication failed", strategy_id=str(strategy_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Duplication failed"
        )


# Strategy Search and Statistics
@app.get("/search", response_model=StrategySearchResult)
async def search_strategies(
    query: str,
    category: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    current_user: UserResponse = Depends(get_current_user)
) -> StrategySearchResult:
    """Search strategies by name or description."""
    try:
        strategies, total = await DatabaseService.search_strategies(
            user_id=current_user.id,
            query=query,
            category=category,
            limit=limit,
            offset=offset
        )
        
        return StrategySearchResult(
            strategies=strategies,
            total=total,
            page=offset // limit + 1,
            per_page=limit
        )
        
    except Exception as e:
        logger.error("Strategy search failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Search failed"
        )


@app.get("/stats")
async def get_strategy_stats(
    current_user: UserResponse = Depends(get_current_user)
):
    """Get strategy statistics for the user."""
    try:
        stats = await DatabaseService.get_user_strategy_stats(current_user.id)
        return stats
        
    except Exception as e:
        logger.error("Failed to get strategy stats", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get statistics"
        )


# Template Management
@app.get("/templates", response_model=List[StrategyResponse])
async def list_templates() -> List[StrategyResponse]:
    """Get available strategy templates."""
    try:
        templates = await StrategyTemplateService.get_all_templates()
        return templates
        
    except Exception as e:
        logger.error("Failed to get templates", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve templates"
        )


@app.post("/templates/{template_name}/create", response_model=StrategyResponse)
async def create_from_template(
    template_name: str,
    strategy_name: str,
    current_user: UserResponse = Depends(get_current_user)
) -> StrategyResponse:
    """Create a strategy from a template."""
    try:
        template = await StrategyTemplateService.get_template(template_name)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )
        
        # Create strategy from template
        created_strategy = await DatabaseService.create_strategy(
            user_id=current_user.id,
            name=strategy_name,
            description=f"Created from {template_name} template",
            category=template.category,
            tags=template.tags,
            json_tree=template.json_tree,
            compilation_report=template.compilation_report,
            is_template=False
        )
        
        logger.info("Strategy created from template", template=template_name, strategy_id=str(created_strategy.id))
        
        return created_strategy
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Template strategy creation failed", template=template_name, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create strategy from template"
        )


# Node Information
@app.get("/nodes", response_model=Dict[str, Any])
async def get_available_node_types() -> Dict[str, Any]:
    """Get all available node types for strategy building."""
    try:
        nodes = get_available_nodes()
        return {
            "success": True,
            "nodes": nodes,
            "categories": {
                "data": [n for n, info in nodes.items() if info["category"] == "data"],
                "indicators": [n for n, info in nodes.items() if info["category"] == "indicators"],
                "logic": [n for n, info in nodes.items() if info["category"] == "logic"],
                "actions": [n for n, info in nodes.items() if info["category"] == "actions"],
                "other": [n for n, info in nodes.items() if info["category"] == "other"]
            },
            "total_count": len(nodes)
        }
        
    except Exception as e:
        logger.error("Failed to get node types", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve node types"
        )


# Health and monitoring
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "service": "strategy-service",
        "database_connected": await DatabaseService.is_connected(),
        "redis_connected": await RedisService.is_connected(),
        "available_nodes": len(get_available_nodes())
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8002,
        reload=settings.DEBUG
    )