"""
Strategy Compiler for node-based strategies.
Enhanced from Beta1 with better error handling and validation.
"""

import ast
import uuid
from typing import Any, Dict, List, Optional, Set, Tuple
from dataclasses import dataclass
from collections import defaultdict, deque

from .nodes import NODE_REGISTRY, Node


@dataclass
class CompilationResult:
    """Result of strategy compilation."""
    success: bool
    strategy_instance: Optional['CompiledStrategy'] = None
    errors: List[str] = None
    warnings: List[str] = None
    unknown_nodes: List[str] = None
    execution_order: List[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "success": self.success,
            "errors": self.errors or [],
            "warnings": self.warnings or [],
            "unknown_nodes": self.unknown_nodes or [],
            "execution_order": self.execution_order or [],
            "has_strategy": self.strategy_instance is not None
        }


class StrategyCompiler:
    """
    Compiles node-based strategies into executable code.
    Enhanced with better dependency resolution and validation.
    """
    
    def __init__(self):
        self.errors = []
        self.warnings = []
        self.unknown_nodes = []
    
    def compile_strategy(self, strategy_json: Dict[str, Any]) -> CompilationResult:
        """
        Compile a strategy from JSON representation.
        
        Args:
            strategy_json: Contains 'nodes' and 'edges' arrays from React Flow
            
        Returns:
            CompilationResult with success status and compiled strategy
        """
        self.errors = []
        self.warnings = []
        self.unknown_nodes = []
        
        try:
            nodes = strategy_json.get("nodes", [])
            edges = strategy_json.get("edges", [])
            
            if not nodes:
                self.errors.append("Strategy must contain at least one node")
                return CompilationResult(success=False, errors=self.errors)
            
            # Validate nodes and edges
            validation_result = self._validate_strategy(nodes, edges)
            if not validation_result:
                return CompilationResult(
                    success=False,
                    errors=self.errors,
                    warnings=self.warnings,
                    unknown_nodes=self.unknown_nodes
                )
            
            # Create node instances
            node_instances = self._create_node_instances(nodes)
            
            # Build execution graph
            execution_graph = self._build_execution_graph(nodes, edges)
            
            # Determine execution order
            execution_order = self._topological_sort(execution_graph)
            
            if not execution_order:
                self.errors.append("Strategy contains circular dependencies")
                return CompilationResult(success=False, errors=self.errors)
            
            # Create compiled strategy
            compiled_strategy = CompiledStrategy(
                nodes=node_instances,
                edges=edges,
                execution_order=execution_order,
                execution_graph=execution_graph
            )
            
            # Test execution with dummy data
            test_result = self._test_strategy_execution(compiled_strategy)
            if not test_result:
                return CompilationResult(
                    success=False,
                    errors=self.errors,
                    warnings=self.warnings
                )
            
            return CompilationResult(
                success=True,
                strategy_instance=compiled_strategy,
                warnings=self.warnings,
                unknown_nodes=self.unknown_nodes,
                execution_order=execution_order
            )
            
        except Exception as e:
            self.errors.append(f"Compilation failed: {str(e)}")
            return CompilationResult(success=False, errors=self.errors)
    
    def _validate_strategy(self, nodes: List[Dict], edges: List[Dict]) -> bool:
        """Validate strategy structure."""
        node_ids = {node["id"] for node in nodes}
        
        # Check for unknown node types
        for node in nodes:
            node_type = node.get("type")
            if node_type not in NODE_REGISTRY:
                self.unknown_nodes.append(node_type)
        
        if self.unknown_nodes:
            self.errors.append(f"Unknown node types: {self.unknown_nodes}")
        
        # Validate edges
        for edge in edges:
            source = edge.get("source")
            target = edge.get("target")
            
            if source not in node_ids:
                self.errors.append(f"Edge references unknown source node: {source}")
            if target not in node_ids:
                self.errors.append(f"Edge references unknown target node: {target}")
        
        # Check for action nodes (strategy must have at least one)
        action_nodes = [
            node for node in nodes 
            if node.get("type") in ["buyNode", "sellNode", "holdNode"]
        ]
        
        if not action_nodes:
            self.warnings.append("Strategy has no action nodes (buy/sell/hold)")
        
        # Check for disconnected nodes
        connected_nodes = set()
        for edge in edges:
            connected_nodes.add(edge["source"])
            connected_nodes.add(edge["target"])
        
        disconnected = node_ids - connected_nodes
        if disconnected and len(nodes) > 1:
            self.warnings.append(f"Disconnected nodes: {list(disconnected)}")
        
        return len(self.errors) == 0
    
    def _create_node_instances(self, nodes: List[Dict]) -> Dict[str, Node]:
        """Create node instances from JSON definitions."""
        node_instances = {}
        
        for node_data in nodes:
            node_id = node_data["id"]
            node_type = node_data["type"]
            
            if node_type in NODE_REGISTRY:
                node_class = NODE_REGISTRY[node_type]
                instance = node_class(
                    node_id=node_id,
                    data=node_data.get("data", {}),
                    position=node_data.get("position", {"x": 0, "y": 0})
                )
                node_instances[node_id] = instance
        
        return node_instances
    
    def _build_execution_graph(self, nodes: List[Dict], edges: List[Dict]) -> Dict[str, Set[str]]:
        """Build directed graph for execution order."""
        graph = defaultdict(set)
        
        # Initialize all nodes in graph
        for node in nodes:
            graph[node["id"]] = set()
        
        # Add dependencies (reversed - target depends on source)
        for edge in edges:
            source = edge["source"]
            target = edge["target"]
            graph[target].add(source)
        
        return dict(graph)
    
    def _topological_sort(self, graph: Dict[str, Set[str]]) -> Optional[List[str]]:
        """Topological sort to determine execution order."""
        # Kahn's algorithm
        in_degree = {node: len(deps) for node, deps in graph.items()}
        queue = deque([node for node, degree in in_degree.items() if degree == 0])
        result = []
        
        while queue:
            node = queue.popleft()
            result.append(node)
            
            # Remove this node from all dependency lists
            for target, dependencies in graph.items():
                if node in dependencies:
                    dependencies.remove(node)
                    in_degree[target] -= 1
                    if in_degree[target] == 0:
                        queue.append(target)
        
        # Check for cycles
        if len(result) != len(graph):
            return None
        
        return result
    
    def _test_strategy_execution(self, strategy: 'CompiledStrategy') -> bool:
        """Test strategy execution with dummy data."""
        try:
            # Reset all nodes
            for node in strategy.nodes.values():
                node.reset_state()
            
            # Test with dummy market data
            test_data = {
                "symbol": "TEST",
                "price": 100.0,
                "volume": 1000.0,
                "timestamp": "2024-01-01T00:00:00Z"
            }
            
            signals = strategy.execute(test_data)
            
            # Strategy should return some result (even if None/empty)
            return True
            
        except Exception as e:
            self.errors.append(f"Strategy execution test failed: {str(e)}")
            return False


class CompiledStrategy:
    """
    Compiled and executable strategy.
    Contains all nodes and execution logic.
    """
    
    def __init__(self, nodes: Dict[str, Node], edges: List[Dict], 
                 execution_order: List[str], execution_graph: Dict[str, Set[str]]):
        self.nodes = nodes
        self.edges = edges
        self.execution_order = execution_order
        self.execution_graph = execution_graph
        self.edge_map = self._build_edge_map(edges)
    
    def _build_edge_map(self, edges: List[Dict]) -> Dict[str, List[Dict]]:
        """Build mapping from source to target connections."""
        edge_map = defaultdict(list)
        
        for edge in edges:
            source = edge["source"]
            edge_map[source].append(edge)
        
        return dict(edge_map)
    
    def execute(self, market_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Execute strategy with market data.
        
        Args:
            market_data: Current market data (price, volume, etc.)
            
        Returns:
            List of trading signals generated by action nodes
        """
        node_outputs = {}
        signals = []
        
        # Execute nodes in topological order
        for node_id in self.execution_order:
            node = self.nodes[node_id]
            
            # Gather inputs for this node
            inputs = self._gather_node_inputs(node_id, node_outputs, market_data)
            
            # Execute node
            outputs = node.compute(**inputs)
            
            # Store outputs
            node_outputs[node_id] = outputs
            
            # Check for trading signals
            if "signal-out" in outputs and outputs["signal-out"]:
                signals.append(outputs["signal-out"])
        
        return signals
    
    def _gather_node_inputs(self, node_id: str, node_outputs: Dict[str, Dict], 
                           market_data: Dict[str, Any]) -> Dict[str, Any]:
        """Gather inputs for a node from previous outputs and market data."""
        inputs = {}
        
        # Get inputs from connected nodes
        for source_id, source_outputs in node_outputs.items():
            if source_id in self.edge_map:
                for edge in self.edge_map[source_id]:
                    if edge["target"] == node_id:
                        source_handle = edge["sourceHandle"]
                        target_handle = edge["targetHandle"]
                        
                        if source_handle in source_outputs:
                            inputs[target_handle.replace("-", "_")] = source_outputs[source_handle]
        
        # Add market data for data nodes
        node = self.nodes[node_id]
        if hasattr(node, 'node_type') and node.node_type in ["priceNode", "volumeNode"]:
            # Data nodes get market data directly
            if node.node_type == "priceNode":
                price_type = node.data.get("priceType", "close")
                inputs["market_data"] = market_data
            elif node.node_type == "volumeNode":
                inputs["market_data"] = market_data
        
        return inputs
    
    def reset(self):
        """Reset all node states."""
        for node in self.nodes.values():
            node.reset_state()
    
    def get_state_summary(self) -> Dict[str, Any]:
        """Get summary of strategy state for debugging."""
        return {
            "node_count": len(self.nodes),
            "edge_count": len(self.edges),
            "execution_order": self.execution_order,
            "nodes": {node_id: node.get_state_summary() 
                     for node_id, node in self.nodes.items()}
        }