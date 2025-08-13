"""
Clean Database Service for Strategy Operations
Async PostgreSQL operations with connection pooling
"""

import asyncpg
import json
from typing import List, Dict, Any, Optional
from uuid import UUID
import structlog
from datetime import datetime

logger = structlog.get_logger("database_service")

class DatabaseService:
    """Clean, focused database service for strategy operations"""
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
    
    async def initialize(self, database_url: str):
        """Initialize database connection pool"""
        logger.info("🗃️ Initializing database connection pool")
        
        try:
            self.pool = await asyncpg.create_pool(
                database_url,
                min_size=2,
                max_size=10,
                command_timeout=60
            )
            logger.info("✅ Database pool created successfully")
        except Exception as e:
            logger.exception("❌ Failed to create database pool", error=str(e))
            raise
    
    async def close(self):
        """Close database connections"""
        if self.pool:
            await self.pool.close()
            logger.info("🔒 Database pool closed")
    
    async def is_connected(self) -> bool:
        """Check database connection health"""
        if not self.pool:
            return False
        try:
            async with self.pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            return True
        except:
            return False
    
    async def create_strategy(self, user_id: UUID, name: str, description: str,
                             category: str, tags: List[str], json_tree: Dict[str, Any],
                             compilation_report: Dict[str, Any], is_template: bool = False) -> Any:
        """Create a new strategy"""
        logger.info("💾 Creating strategy in database", 
                   user_id=str(user_id), 
                   name=name, 
                   category=category,
                   is_template=is_template)
        
        async with self.pool.acquire() as conn:
            try:
                strategy = await conn.fetchrow("""
                    INSERT INTO strategies (
                        user_id, name, description, category, tags, 
                        json_tree, compilation_report, is_template
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING id, name, created_at
                """, user_id, name, description, category, tags, 
                    json.dumps(json_tree), json.dumps(compilation_report), is_template)
                
                logger.info("✅ Strategy created successfully", 
                           strategy_id=str(strategy['id']))
                
                return strategy
            except Exception as e:
                logger.exception("❌ Failed to create strategy", error=str(e))
                raise
    
    async def get_strategy_by_id(self, strategy_id: UUID, user_id: UUID) -> Optional[Dict]:
        """Get strategy by ID for specific user"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT id, name, description, category, tags, json_tree, 
                       compilation_report, is_template, created_at, updated_at
                FROM strategies 
                WHERE id = $1 AND user_id = $2 AND is_active = true
            """, strategy_id, user_id)
            
            if row:
                strategy = dict(row)
                strategy['json_tree'] = json.loads(strategy['json_tree'])
                strategy['compilation_report'] = json.loads(strategy['compilation_report']) if strategy['compilation_report'] else None
                return strategy
            return None
    
    async def list_user_strategies(self, user_id: UUID, category: Optional[str] = None,
                                  include_templates: bool = True, limit: int = 50,
                                  offset: int = 0) -> List[Dict]:
        """List strategies for a user"""
        query = """
            SELECT id, name, description, category, tags, is_template, 
                   created_at, updated_at
            FROM strategies 
            WHERE user_id = $1 AND is_active = true
        """
        params = [user_id]
        param_count = 1
        
        if category:
            param_count += 1
            query += f" AND category = ${param_count}"
            params.append(category)
        
        if not include_templates:
            query += " AND is_template = false"
        
        query += f" ORDER BY updated_at DESC LIMIT ${param_count + 1} OFFSET ${param_count + 2}"
        params.extend([limit, offset])
        
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    async def update_strategy(self, strategy_id: UUID, user_id: UUID, **kwargs) -> Optional[Dict]:
        """Update strategy fields"""
        update_fields = []
        params = [strategy_id, user_id]
        param_count = 2
        
        for field, value in kwargs.items():
            if value is not None:
                param_count += 1
                if field == 'json_tree':
                    update_fields.append(f"json_tree = ${param_count}")
                    params.append(json.dumps(value))
                elif field == 'compilation_report':
                    update_fields.append(f"compilation_report = ${param_count}")
                    params.append(json.dumps(value))
                else:
                    update_fields.append(f"{field} = ${param_count}")
                    params.append(value)
        
        if not update_fields:
            return None
        
        query = f"""
            UPDATE strategies 
            SET {', '.join(update_fields)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2
            RETURNING id, name, updated_at
        """
        
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *params)
    
    async def delete_strategy(self, strategy_id: UUID, user_id: UUID) -> bool:
        """Soft delete a strategy"""
        async with self.pool.acquire() as conn:
            result = await conn.execute("""
                UPDATE strategies 
                SET is_active = false, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND user_id = $2
            """, strategy_id, user_id)
            
            return result == "UPDATE 1"
    
    async def search_strategies(self, user_id: UUID, query: str, 
                               category: Optional[str] = None, limit: int = 20, 
                               offset: int = 0) -> tuple[List[Dict], int]:
        """Search strategies by name or description"""
        search_query = f"%{query}%"
        base_where = "user_id = $1 AND is_active = true AND (name ILIKE $2 OR description ILIKE $3)"
        params = [user_id, search_query, search_query]
        param_count = 3
        
        if category:
            param_count += 1
            base_where += f" AND category = ${param_count}"
            params.append(category)
        
        async with self.pool.acquire() as conn:
            # Get total count
            count_query = f"SELECT COUNT(*) FROM strategies WHERE {base_where}"
            total = await conn.fetchval(count_query, *params)
            
            # Get results
            result_query = f"""
                SELECT id, name, description, category, tags, is_template, 
                       created_at, updated_at
                FROM strategies 
                WHERE {base_where}
                ORDER BY updated_at DESC 
                LIMIT ${param_count + 1} OFFSET ${param_count + 2}
            """
            params.extend([limit, offset])
            
            rows = await conn.fetch(result_query, *params)
            strategies = [dict(row) for row in rows]
            
            return strategies, total
    
    async def get_user_strategy_stats(self, user_id: UUID) -> Dict:
        """Get strategy statistics for user"""
        async with self.pool.acquire() as conn:
            stats = await conn.fetchrow("""
                SELECT 
                    COUNT(*) as total_strategies,
                    COUNT(*) FILTER (WHERE is_template = false) as custom_strategies,
                    COUNT(*) FILTER (WHERE is_template = true) as templates
                FROM strategies 
                WHERE user_id = $1 AND is_active = true
            """, user_id)
            
            categories = await conn.fetch("""
                SELECT DISTINCT category 
                FROM strategies 
                WHERE user_id = $1 AND is_active = true
            """, user_id)
            
            return {
                "total_strategies": stats['total_strategies'],
                "custom_strategies": stats['custom_strategies'], 
                "templates": stats['templates'],
                "categories": [cat['category'] for cat in categories]
            }
    
    async def update_compilation_report(self, strategy_id: UUID, report: Dict[str, Any]):
        """Update compilation report for a strategy"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE strategies 
                SET compilation_report = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            """, strategy_id, json.dumps(report))