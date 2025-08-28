"""
AlgoTrade Strategy Service
Handles strategy CRUD operations, compilation, and validation.
"""

import os
import sys
import time
import logging
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional
from uuid import UUID
from fastapi import Body

import structlog
import uvicorn
import pickle
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.responses import JSONResponse, Response

# Add shared models to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../..'))

from shared.models.strategy_models import (
    StrategyCreate, StrategyUpdate, StrategyResponse, 
    StrategyCompilationResult, StrategySearchResult, StrategyStats
)
from shared.response_models import (
    StandardResponse, ListResponse, CreationResponse
)
from shared.models.user_models import UserResponse
from shared.strategy_engine import StrategyCompiler, get_available_nodes
from shared.auth_dependency import get_current_user
from shared.auth_client import close_auth_client

from .config import settings
from .database_service import DatabaseService
from .redis_service import RedisService
from .services import StrategyTemplateService

# Configure logging - ensure output goes to stdout/stderr
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(10),  # DEBUG level to see all logs
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Global service instances
database_service = DatabaseService()
redis_service = RedisService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    logger.info("🚀 Starting Strategy Service")
    
    # Initialize services
    await database_service.initialize(settings.DATABASE_URL)
    await redis_service.initialize(settings.REDIS_URL)
    await StrategyTemplateService.initialize()
    
    logger.info("✅ Strategy Service initialized")
    
    yield
    
    logger.info("🛑 Shutting down Strategy Service")
    await database_service.close()
    await redis_service.close()
    await close_auth_client()


app = FastAPI(
    title="AlgoTrade Strategy Service",
    description="Strategy management, compilation, and validation service",
    version="1.0.0",
    lifespan=lifespan
)


# Strategy CRUD Operations
@app.post("/")
async def create_strategy(
    strategy: StrategyCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create a new strategy."""
    logger.warning("🆕 Creating new strategy", 
               user_id=str(current_user.id),
               user_email=current_user.email,
               user_username=current_user.username,
               strategy_name=strategy.name,
               strategy_category=strategy.category,
               strategy_tags=strategy.tags,
               is_template=strategy.is_template)
    
    # Log strategy structure details
    if hasattr(strategy, 'json_tree') and strategy.json_tree:
        nodes = strategy.json_tree.get("nodes", [])
        edges = strategy.json_tree.get("edges", [])
        logger.info("📊 Strategy structure received", 
                   node_count=len(nodes),
                   edge_count=len(edges),
                   node_types=[node.get("type") for node in nodes])
    else:
        logger.warning("⚠️ No json_tree provided in strategy", strategy_name=strategy.name)
    
    try:
        # Validate and compile strategy
        logger.warning("🔧 Starting strategy compilation")
        compiler = StrategyCompiler()
        compilation_result = compiler.compile_strategy(strategy.json_tree)
        
        logger.warning("🔧 Compilation completed", 
                   success=compilation_result.success,
                   error_count=len(compilation_result.errors) if compilation_result.errors else 0,
                   warning_count=len(compilation_result.warnings) if compilation_result.warnings else 0,
                   unknown_nodes_count=len(compilation_result.unknown_nodes) if compilation_result.unknown_nodes else 0)
        
        if not compilation_result.success:
            logger.error("❌ Strategy compilation failed", 
                        errors=compilation_result.errors,
                        unknown_nodes=compilation_result.unknown_nodes,
                        warnings=compilation_result.warnings)
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Strategy compilation failed",
                    "compilation_errors": compilation_result.errors,
                    "unknown_nodes": compilation_result.unknown_nodes
                }
            )
        
        # Save to database
        logger.warning("💾 Saving strategy to database")
        db_strategy = await database_service.create_strategy(
            user_id=current_user.id,
            name=strategy.name,
            description=strategy.description,
            category=strategy.category,
            tags=strategy.tags,
            json_tree=strategy.json_tree,
            compilation_report=compilation_result.to_dict(),
            is_template=strategy.is_template
        )
        
        logger.warning("💾 Strategy saved to database", 
                   strategy_id=str(db_strategy['id']) if db_strategy else "None")
        
        # Cache compiled strategy in Redis
        logger.warning("🔄 Caching compiled strategy in Redis")
        await redis_service.cache_compiled_strategy(
            str(db_strategy['id']),
            compilation_result.strategy_instance
        )
        
        logger.warning("✅ Strategy creation completed successfully",
            strategy_id=str(db_strategy['id']),
            user_id=str(current_user.id),
            name=strategy.name,
            compilation_success=compilation_result.success
        )
        
        return CreationResponse.strategy_created(
            strategy_id=str(db_strategy['id']),
            message="Strategy created successfully"
        )
        
    except HTTPException as he:
        logger.error("❌ HTTP exception during strategy creation", 
                    status_code=he.status_code,
                    detail=he.detail)
        raise
    except Exception as e:
        logger.exception("💥 Unexpected error during strategy creation", 
                        error=str(e),
                        strategy_name=strategy.name,
                        user_id=str(current_user.id))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Strategy creation failed"
        )


@app.get("/")
async def list_strategies(
    category: Optional[str] = None,
    include_templates: bool = True,
    limit: int = 50,
    offset: int = 0,
    current_user: UserResponse = Depends(get_current_user)
):
    """List user's strategies."""
    try:
        strategies = await database_service.list_user_strategies(
            user_id=current_user.id,
            category=category,
            include_templates=include_templates,
            limit=limit,
            offset=offset
        )
        
        return ListResponse.strategies_response(
            strategies=strategies,
            message="Strategies retrieved successfully"
        )
        
    except Exception as e:
        logger.error("Failed to list strategies", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve strategies"
        )


# Node Information
@app.get("/nodes")
async def get_available_node_types():
    """Get all available node types for strategy building."""
    try:
        nodes = get_available_nodes()
        node_data = {
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
        
        return StandardResponse.success_response(
            data=node_data,
            message="Available node types retrieved successfully"
        )
        
    except Exception as e:
        logger.error("Failed to get node types", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve node types"
        )


# Strategy Search and Statistics
@app.get("/search")
async def search_strategies(
    query: str,
    category: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    current_user: UserResponse = Depends(get_current_user)
):
    """Search strategies by name or description."""
    try:
        strategies, total = await database_service.search_strategies(
            user_id=current_user.id,
            query=query,
            category=category,
            limit=limit,
            offset=offset
        )
        
        search_result = StrategySearchResult(
            strategies=strategies,
            total=total,
            page=offset // limit + 1,
            per_page=limit
        )
        
        return ListResponse.strategies_response(
            strategies=strategies,
            message="Search completed successfully"
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
        stats = await database_service.get_user_strategy_stats(current_user.id)
        return StandardResponse.success_response(
            data=stats,
            message="Strategy statistics retrieved successfully"
        )
        
    except Exception as e:
        logger.error("Failed to get strategy stats", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get statistics"
        )


@app.get("/{strategy_id}")
async def get_strategy(
    strategy_id: UUID,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get a specific strategy."""
    try:
        strategy = await database_service.get_strategy_by_id(strategy_id, current_user.id)
        
        if not strategy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found"
            )
        
        return StandardResponse.success_response(
            data=strategy,
            message="Strategy retrieved successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get strategy", strategy_id=str(strategy_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve strategy"
        )


@app.get("/{strategy_id}/compiled")
async def get_compiled_strategy_binary(
    strategy_id: UUID,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get compiled strategy as binary data for execution services."""
    logger.info("🔄 Retrieving compiled strategy binary", 
               strategy_id=str(strategy_id),
               user_id=str(current_user.id))
    
    try:
        # Check if strategy exists and belongs to user
        strategy = await database_service.get_strategy_by_id(strategy_id, current_user.id)
        if not strategy:
            logger.error("❌ Strategy not found for compiled binary request", 
                        strategy_id=str(strategy_id),
                        user_id=str(current_user.id))
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found"
            )
        
        # Get compiled strategy from Redis cache
        logger.info("🔍 Retrieving compiled strategy from cache")
        compiled_strategy = await redis_service.get_compiled_strategy(str(strategy_id))
        
        if not compiled_strategy:
            logger.warning("❌ No compiled strategy found in cache", 
                          strategy_id=str(strategy_id))
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compiled strategy not found in cache. Please recompile the strategy."
            )
        
        # Serialize to binary
        logger.info("🥒 Serializing compiled strategy to binary")
        binary_data = pickle.dumps(compiled_strategy)
        
        logger.info("✅ Compiled strategy binary retrieved successfully", 
                   strategy_id=str(strategy_id),
                   binary_size=len(binary_data))
        
        return Response(
            content=binary_data,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename=strategy_{strategy_id}.pkl",
                "X-Strategy-ID": str(strategy_id),
                "X-Binary-Size": str(len(binary_data))
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("💥 Failed to retrieve compiled strategy binary", 
                        strategy_id=str(strategy_id),
                        error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve compiled strategy"
        )


@app.put("/{strategy_id}")
async def update_strategy(
    strategy_id: UUID,
    strategy_update: StrategyUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update an existing strategy."""
    try:
        # Get existing strategy
        existing = await database_service.get_strategy_by_id(strategy_id, current_user.id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found"
            )
        
        # If strategy structure or node data changed, recompile
        compilation_result = None
        needs_recompilation = False
        
        if strategy_update.json_tree is not None:
            # Check if json_tree actually changed (structure or node data)
            existing_json_tree = existing.get('json_tree', {})
            if strategy_update.json_tree != existing_json_tree:
                needs_recompilation = True
                logger.warning("🔄 Strategy structure or node data changed - triggering recompilation",
                             strategy_id=str(strategy_id))
            else:
                logger.info("📋 Strategy json_tree provided but unchanged - skipping recompilation",
                           strategy_id=str(strategy_id))
        
        if needs_recompilation:
            logger.warning("🔧 Starting strategy recompilation", strategy_id=str(strategy_id))
            compiler = StrategyCompiler()
            compilation_result = compiler.compile_strategy(strategy_update.json_tree)
            
            if not compilation_result.success:
                logger.error("❌ Strategy recompilation failed", 
                            strategy_id=str(strategy_id),
                            errors=compilation_result.errors,
                            warnings=compilation_result.warnings)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "message": "Strategy compilation failed",
                        "compilation_errors": compilation_result.errors
                    }
                )
            
            logger.warning("✅ Strategy recompilation successful", 
                         strategy_id=str(strategy_id),
                         warning_count=len(compilation_result.warnings) if compilation_result.warnings else 0)
        
        # Update in database
        updated_strategy = await database_service.update_strategy(
            strategy_id=strategy_id,
            user_id=current_user.id,
            **strategy_update.model_dump(exclude_unset=True),
            compilation_report=compilation_result.to_dict() if compilation_result else None
        )
        
        # Update Redis cache if recompiled
        if compilation_result and compilation_result.strategy_instance:
            logger.warning("🔄 Updating Redis cache with recompiled strategy", 
                         strategy_id=str(strategy_id))
            await redis_service.cache_compiled_strategy(
                str(strategy_id),
                compilation_result.strategy_instance
            )
        elif needs_recompilation:
            logger.warning("⚠️ Recompilation needed but no strategy instance generated", 
                         strategy_id=str(strategy_id))
        
        logger.info("Strategy updated", strategy_id=str(strategy_id))
        
        return StandardResponse.success_response(
            data=updated_strategy,
            message="Strategy updated successfully"
        )
        
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
        success = await database_service.delete_strategy(strategy_id, current_user.id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found"
            )
        
        # Remove from Redis cache
        await redis_service.remove_compiled_strategy(str(strategy_id))
        
        logger.info("Strategy deleted", strategy_id=str(strategy_id))
        
        return StandardResponse.success_response(
            message="Strategy deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Strategy deletion failed", strategy_id=str(strategy_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Strategy deletion failed"
        )


# Strategy Compilation
@app.post("/{strategy_id}/compile")
async def compile_strategy(
    strategy_id: UUID,
    current_user: UserResponse = Depends(get_current_user)
):
    """Compile and validate a strategy."""
    logger.info("🔧 Compiling strategy", 
               strategy_id=str(strategy_id),
               user_id=str(current_user.id))
    
    try:
        # Get strategy
        logger.info("📋 Fetching strategy from database", strategy_id=str(strategy_id))
        strategy = await database_service.get_strategy_by_id(strategy_id, current_user.id)
        if not strategy:
            logger.error("❌ Strategy not found", 
                        strategy_id=str(strategy_id),
                        user_id=str(current_user.id))
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found"
            )
        
        logger.info("📊 Strategy found for compilation", 
                   strategy_id=str(strategy_id),
                   strategy_name=getattr(strategy, 'name', 'Unknown'),
                   json_tree_present=hasattr(strategy, 'json_tree') and strategy.json_tree is not None)
        
        # Log strategy structure
        if hasattr(strategy, 'json_tree') and strategy.json_tree:
            nodes = strategy.json_tree.get("nodes", [])
            edges = strategy.json_tree.get("edges", [])
            logger.info("📊 Strategy structure for compilation", 
                       node_count=len(nodes),
                       edge_count=len(edges),
                       node_types=[node.get("type") for node in nodes])
        
        # Compile strategy
        logger.info("🔧 Starting compilation process")
        compiler = StrategyCompiler()
        result = compiler.compile_strategy(strategy.json_tree)
        
        logger.info("🔧 Compilation process completed", 
                   success=result.success,
                   error_count=len(result.errors) if result.errors else 0,
                   warning_count=len(result.warnings) if result.warnings else 0,
                   unknown_nodes_count=len(result.unknown_nodes) if result.unknown_nodes else 0)
        
        if not result.success:
            logger.error("❌ Compilation failed", 
                        strategy_id=str(strategy_id),
                        errors=result.errors,
                        unknown_nodes=result.unknown_nodes)
        
        # Update compilation report in database
        logger.info("💾 Updating compilation report in database")
        await database_service.update_compilation_report(strategy_id, result.to_dict())
        
        # Cache if successful
        if result.success and result.strategy_instance:
            logger.info("🔄 Caching compiled strategy")
            await redis_service.cache_compiled_strategy(
                str(strategy_id),
                result.strategy_instance
            )
        else:
            logger.info("⏭️ Skipping cache due to compilation failure or missing strategy instance")
        
        compilation_result = StrategyCompilationResult(
            success=result.success,
            report=result.to_dict(),
            error="; ".join(result.errors) if result.errors else None
        )
        
        logger.info("✅ Compilation endpoint completed", 
                   strategy_id=str(strategy_id),
                   success=result.success)
        
        return StandardResponse.success_response(
            data=compilation_result,
            message="Strategy compilation completed"
        )
        
    except HTTPException as he:
        logger.error("❌ HTTP exception during compilation", 
                    strategy_id=str(strategy_id),
                    status_code=he.status_code,
                    detail=he.detail)
        raise
    except Exception as e:
        logger.exception("💥 Unexpected error during compilation", 
                        strategy_id=str(strategy_id), 
                        error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Compilation failed"
        )


@app.post("/{strategy_id}/duplicate")
async def duplicate_strategy(
    strategy_id: UUID,
    duplicate_data: Optional[Dict[str, str]] = Body(None),
    current_user: UserResponse = Depends(get_current_user)
):
    """Duplicate an existing strategy."""
    try:
        # Get original strategy
        original = await database_service.get_strategy_by_id(strategy_id, current_user.id)
        if not original:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Strategy not found"
            )
        
        # Create duplicate with new name (allow custom name if provided)
        if duplicate_data and duplicate_data.get("name"):
            duplicate_name = duplicate_data["name"]
        else:
            duplicate_name = f"{original.name} (Copy)"
        
        duplicated = await database_service.create_strategy(
            user_id=current_user.id,
            name=duplicate_name,
            description=original.description,
            category=original.category,
            tags=original.tags,
            json_tree=original.json_tree,
            compilation_report=original.compilation_report,
            is_template=False  # Duplicates are never templates
        )
        
        logger.info("Strategy duplicated", original_id=str(strategy_id), new_id=str(duplicated['id']))
        
        return StandardResponse.success_response(
            data=duplicated,
            message="Strategy duplicated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Strategy duplication failed", strategy_id=str(strategy_id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Duplication failed"
        )




# Template Management
@app.get("/templates")
async def list_templates():
    """Get available strategy templates."""
    try:
        templates = await StrategyTemplateService.get_all_templates()
        return ListResponse.strategies_response(
            strategies=templates,
            message="Templates retrieved successfully"
        )
        
    except Exception as e:
        logger.error("Failed to get templates", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve templates"
        )


@app.post("/templates/{template_name}/create")
async def create_from_template(
    template_name: str,
    strategy_name: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Create a strategy from a template."""
    try:
        template = await StrategyTemplateService.get_template(template_name)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )
        
        # Create strategy from template
        created_strategy = await database_service.create_strategy(
            user_id=current_user.id,
            name=strategy_name,
            description=f"Created from {template_name} template",
            category=template.category,
            tags=template.tags,
            json_tree=template.json_tree,
            compilation_report=template.compilation_report,
            is_template=False
        )
        
        logger.info("Strategy created from template", template=template_name, strategy_id=str(created_strategy['id']))
        
        return CreationResponse.strategy_created(
            strategy_id=str(created_strategy['id']),
            message="Strategy created from template successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Template strategy creation failed", template=template_name, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create strategy from template"
        )




# Health and monitoring
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "service": "strategy-service",
        "database_connected": await database_service.is_connected(),
        "redis_connected": await redis_service.is_connected(),
        "available_nodes": len(get_available_nodes())
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8002,
        reload=settings.DEBUG
    )