/**
 * Type definitions for strategy management
 */

export interface StrategyNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface StrategyEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface StrategyJsonTree {
  nodes: StrategyNode[];
  edges: StrategyEdge[];
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  json_tree: StrategyJsonTree;
  created_at: string;
  updated_at: string;
  version: number;
  is_template: boolean;
  category: string;
  tags: string[];
  created_by: string;
  is_active: boolean;
}

export interface StrategyFormData {
  name: string;
  description: string;
  category: string;
  tags: string[];
}

export interface StrategyFilters {
  category?: string;
  include_templates: boolean;
  search?: string;
}

export const STRATEGY_CATEGORIES = [
  'custom',
  'momentum',
  'mean-reversion',
  'trend-following',
  'volatility',
  'volume',
  'multi-factor'
] as const;

export type StrategyCategory = typeof STRATEGY_CATEGORIES[number];