"""Strategy-related data models."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel


class StrategyBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "custom"
    tags: List[str] = []
    is_template: bool = False
    is_active: bool = True


class StrategyCreate(StrategyBase):
    json_tree: Dict[str, Any]  # React Flow nodes and edges


class StrategyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    json_tree: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class StrategyResponse(StrategyBase):
    id: UUID
    user_id: UUID
    json_tree: Dict[str, Any]
    compilation_report: Optional[Dict[str, Any]] = None
    version: int
    parent_strategy_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Strategy(StrategyResponse):
    """Internal strategy model."""
    pass


class StrategyCompilationResult(BaseModel):
    success: bool
    report: Dict[str, Any]
    error: Optional[str] = None


class StrategyTemplate(BaseModel):
    name: str
    description: str
    category: str
    json_tree: Dict[str, Any]
    preview_image: Optional[str] = None


class StrategySearchResult(BaseModel):
    strategies: List[StrategyResponse]
    total: int
    page: int
    per_page: int


class StrategyStats(BaseModel):
    total_strategies: int
    total_templates: int
    categories: Dict[str, int]
    recent_activity: List[Dict[str, Any]]