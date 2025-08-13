"""
Strategy Compiler for node-based strategies.
Enhanced from Beta1 with better error handling and validation.
"""

import ast
import uuid
import structlog
from typing import Any, Dict, List, Optional, Set, Tuple
from dataclasses import dataclass
from collections import defaultdict, deque

from .nodes import NODE_REGISTRY, Node

# Configure structured logging
logger = structlog.get_logger("strategy_compiler")


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
        
        logger.info("🚀 Starting strategy compilation", strategy_json_keys=list(strategy_json.keys()))
        
        try:
            nodes = strategy_json.get("nodes", [])
            edges = strategy_json.get("edges", [])
            
            logger.info("📊 Strategy structure", 
                       node_count=len(nodes), 
                       edge_count=len(edges),
                       node_types=[node.get("type") for node in nodes])
            
            if not nodes:
                logger.error("❌ No nodes in strategy")
                self.errors.append("Strategy must contain at least one node")
                return CompilationResult(success=False, errors=self.errors)
            
            # Validate nodes and edges
            logger.info("🔍 Starting strategy validation")
            validation_result = self._validate_strategy(nodes, edges)
            if not validation_result:
                logger.error("❌ Strategy validation failed", 
                           errors=self.errors, 
                           warnings=self.warnings,
                           unknown_nodes=self.unknown_nodes)
                return CompilationResult(
                    success=False,
                    errors=self.errors,
                    warnings=self.warnings,
                    unknown_nodes=self.unknown_nodes
                )
            
            logger.info("✅ Strategy validation passed")
            
            # Create node instances
            logger.info("🏗️ Creating node instances")
            node_instances = self._create_node_instances(nodes)
            logger.info("✅ Node instances created", instance_count=len(node_instances))
            
            # Build execution graph
            logger.info("🔗 Building execution graph")
            execution_graph = self._build_execution_graph(nodes, edges)
            logger.info("✅ Execution graph built", dependencies=dict(execution_graph))
            
            # Determine execution order
            logger.info("📋 Determining execution order")
            execution_order = self._topological_sort(execution_graph)
            
            if not execution_order:
                logger.error("❌ Circular dependencies detected")
                self.errors.append("Strategy contains circular dependencies")
                return CompilationResult(success=False, errors=self.errors)
            
            logger.info("✅ Execution order determined", execution_order=execution_order)
            
            # Create compiled strategy
            logger.info("🏭 Creating compiled strategy")
            compiled_strategy = CompiledStrategy(
                nodes=node_instances,
                edges=edges,
                execution_order=execution_order,
                execution_graph=execution_graph
            )
            
            # Test execution with dummy data
            logger.info("🧪 Testing strategy execution with dummy data")
            test_result = self._test_strategy_execution(compiled_strategy)
            if not test_result:
                logger.error("❌ Strategy execution test failed", errors=self.errors)
                return CompilationResult(
                    success=False,
                    errors=self.errors,
                    warnings=self.warnings
                )
            
            logger.info("✅ Strategy compilation completed successfully", 
                       warnings_count=len(self.warnings),
                       unknown_nodes_count=len(self.unknown_nodes))
            
            return CompilationResult(
                success=True,
                strategy_instance=compiled_strategy,
                warnings=self.warnings,
                unknown_nodes=self.unknown_nodes,
                execution_order=execution_order
            )
            
        except Exception as e:
            logger.exception("💥 Strategy compilation crashed", 
                           error_message=str(e),
                           strategy_keys=list(strategy_json.keys()),
                           nodes_count=len(strategy_json.get("nodes", [])),
                           edges_count=len(strategy_json.get("edges", [])))
            self.errors.append(f"Compilation failed: {str(e)}")
            return CompilationResult(success=False, errors=self.errors)
    
    def _validate_strategy(self, nodes: List[Dict], edges: List[Dict]) -> bool:
        """Validate strategy structure."""
        logger.info("🔍 Validating strategy structure")
        
        node_ids = {node["id"] for node in nodes}
        logger.info("📋 Node IDs extracted", node_ids=list(node_ids))
        
        # Check for unknown node types
        logger.info("🔎 Checking for unknown node types")
        available_node_types = list(NODE_REGISTRY.keys())
        logger.info("📚 Available node types", available_types=available_node_types)
        
        for node in nodes:
            node_type = node.get("type")
            node_id = node.get("id")
            logger.info("🧩 Checking node", node_id=node_id, node_type=node_type)
            
            if node_type not in NODE_REGISTRY:
                logger.warning("⚠️ Unknown node type found", 
                             node_id=node_id, 
                             node_type=node_type,
                             available_types=available_node_types)
                self.unknown_nodes.append(node_type)
        
        if self.unknown_nodes:
            logger.error("❌ Found unknown node types", unknown_nodes=self.unknown_nodes)
            self.errors.append(f"Unknown node types: {self.unknown_nodes}")
        else:
            logger.info("✅ All node types are valid")
        
        # Validate edges
        logger.info("🔗 Validating edges", edge_count=len(edges))
        for i, edge in enumerate(edges):
            source = edge.get("source")
            target = edge.get("target")
            source_handle = edge.get("sourceHandle")
            target_handle = edge.get("targetHandle")
            
            logger.info(f"🔗 Edge {i}", 
                       source=source, 
                       target=target,
                       source_handle=source_handle,
                       target_handle=target_handle)
            
            if source not in node_ids:
                logger.error("❌ Edge references unknown source node", 
                           edge_index=i, 
                           source=source, 
                           available_nodes=list(node_ids))
                self.errors.append(f"Edge references unknown source node: {source}")
                
            if target not in node_ids:
                logger.error("❌ Edge references unknown target node", 
                           edge_index=i, 
                           target=target, 
                           available_nodes=list(node_ids))
                self.errors.append(f"Edge references unknown target node: {target}")
        
        # Check for action nodes (strategy must have at least one)
        logger.info("⚡ Checking for action nodes")
        action_node_types = ["buyNode", "sellNode", "holdNode"]
        action_nodes = [
            node for node in nodes 
            if node.get("type") in action_node_types
        ]
        
        logger.info("⚡ Action nodes found", 
                   action_node_count=len(action_nodes),
                   action_node_ids=[node.get("id") for node in action_nodes])
        
        if not action_nodes:
            logger.warning("⚠️ No action nodes found")
            self.warnings.append("Strategy has no action nodes (buy/sell/hold)")
        
        # Check for disconnected nodes
        logger.info("🔗 Checking for disconnected nodes")
        connected_nodes = set()
        for edge in edges:
            connected_nodes.add(edge["source"])
            connected_nodes.add(edge["target"])
        
        disconnected = node_ids - connected_nodes
        logger.info("🔗 Connectivity check", 
                   total_nodes=len(node_ids),
                   connected_nodes=list(connected_nodes),
                   disconnected_nodes=list(disconnected))
        
        if disconnected and len(nodes) > 1:
            logger.warning("⚠️ Found disconnected nodes", disconnected_nodes=list(disconnected))
            self.warnings.append(f"Disconnected nodes: {list(disconnected)}")
        
        validation_passed = len(self.errors) == 0
        logger.info("🏁 Validation complete", 
                   passed=validation_passed,
                   error_count=len(self.errors),
                   warning_count=len(self.warnings),
                   errors=self.errors,
                   warnings=self.warnings)
        
        return validation_passed
    
    def _create_node_instances(self, nodes: List[Dict]) -> Dict[str, Node]:
        """Create node instances from JSON definitions."""
        logger.info("🏗️ Creating node instances from JSON")
        
        node_instances = {}
        
        for i, node_data in enumerate(nodes):
            node_id = node_data["id"]
            node_type = node_data["type"]
            node_data_content = node_data.get("data", {})
            position = node_data.get("position", {"x": 0, "y": 0})
            
            logger.info(f"🧩 Creating node {i}", 
                       node_id=node_id, 
                       node_type=node_type,
                       data_keys=list(node_data_content.keys()),
                       position=position)
            
            if node_type in NODE_REGISTRY:
                try:
                    node_class = NODE_REGISTRY[node_type]
                    logger.info("🔍 Found node class", 
                               node_type=node_type, 
                               class_name=node_class.__name__)
                    
                    instance = node_class(
                        node_id=node_id,
                        data=node_data_content,
                        position=position
                    )
                    
                    node_instances[node_id] = instance
                    logger.info("✅ Node instance created successfully", 
                               node_id=node_id,
                               instance_type=type(instance).__name__)
                    
                except Exception as e:
                    logger.exception("❌ Failed to create node instance", 
                                   node_id=node_id,
                                   node_type=node_type,
                                   error=str(e))
                    raise
            else:
                logger.error("❌ Node type not in registry", 
                           node_id=node_id, 
                           node_type=node_type,
                           available_types=list(NODE_REGISTRY.keys()))
        
        logger.info("✅ All node instances created", 
                   total_created=len(node_instances),
                   instance_ids=list(node_instances.keys()))
        
        return node_instances
    
    def _build_execution_graph(self, nodes: List[Dict], edges: List[Dict]) -> Dict[str, Set[str]]:
        """Build directed graph for execution order."""
        logger.info("🔗 Building execution graph")
        
        graph = defaultdict(set)
        
        # Initialize all nodes in graph
        logger.info("📋 Initializing nodes in graph")
        for node in nodes:
            node_id = node["id"]
            graph[node_id] = set()
            logger.info("➕ Added node to graph", node_id=node_id)
        
        # Add dependencies (reversed - target depends on source)
        logger.info("🔗 Adding edge dependencies")
        for i, edge in enumerate(edges):
            source = edge["source"]
            target = edge["target"]
            graph[target].add(source)
            logger.info(f"🔗 Added dependency {i}", 
                       source=source, 
                       target=target, 
                       dependency=f"{target} depends on {source}")
        
        final_graph = dict(graph)
        logger.info("✅ Execution graph built", 
                   node_count=len(final_graph),
                   dependencies_summary={k: list(v) for k, v in final_graph.items()})
        
        return final_graph
    
    def _topological_sort(self, graph: Dict[str, Set[str]]) -> Optional[List[str]]:
        """Topological sort to determine execution order."""
        logger.info("📋 Starting topological sort (Kahn's algorithm)")
        
        # Kahn's algorithm
        in_degree = {node: len(deps) for node, deps in graph.items()}
        logger.info("📊 Calculated in-degrees", in_degrees=in_degree)
        
        queue = deque([node for node, degree in in_degree.items() if degree == 0])
        logger.info("🚀 Initial queue (nodes with no dependencies)", initial_queue=list(queue))
        
        result = []
        iteration = 0
        
        while queue:
            iteration += 1
            node = queue.popleft()
            result.append(node)
            logger.info(f"📋 Step {iteration}: Processing node", 
                       current_node=node, 
                       result_so_far=result,
                       queue_remaining=list(queue))
            
            # Remove this node from all dependency lists
            nodes_to_check = []
            for target, dependencies in graph.items():
                if node in dependencies:
                    dependencies.remove(node)
                    in_degree[target] -= 1
                    nodes_to_check.append(target)
                    logger.info("🔗 Removed dependency", 
                               from_node=node, 
                               to_node=target, 
                               new_in_degree=in_degree[target])
                    
                    if in_degree[target] == 0:
                        queue.append(target)
                        logger.info("➕ Added to queue (no more dependencies)", node=target)
        
        # Check for cycles
        if len(result) != len(graph):
            logger.error("💥 Cycle detected in graph", 
                        expected_nodes=len(graph), 
                        sorted_nodes=len(result),
                        missing_nodes=[node for node in graph.keys() if node not in result],
                        final_in_degrees=in_degree)
            return None
        
        logger.info("✅ Topological sort completed", 
                   execution_order=result,
                   total_iterations=iteration)
        
        return result
    
    def _test_strategy_execution(self, strategy: 'CompiledStrategy') -> bool:
        """Test strategy execution with dummy data."""
        logger.info("🧪 Starting strategy execution test")
        
        try:
            # Reset all nodes
            logger.info("🔄 Resetting all node states")
            for node_id, node in strategy.nodes.items():
                logger.info("🔄 Resetting node", node_id=node_id, node_type=type(node).__name__)
                node.reset_state()
            
            # Test with dummy market data
            test_data = {
                "symbol": "TEST",
                "price": 100.0,
                "volume": 1000.0,
                "timestamp": "2024-01-01T00:00:00Z"
            }
            logger.info("📊 Using test data", test_data=test_data)
            
            logger.info("▶️ Executing strategy with test data")
            signals = strategy.execute(test_data)
            
            logger.info("✅ Strategy execution test completed", 
                       signals_generated=len(signals) if signals else 0,
                       signals=signals)
            
            # Strategy should return some result (even if None/empty)
            return True
            
        except Exception as e:
            logger.exception("❌ Strategy execution test failed", 
                           error=str(e),
                           strategy_node_count=len(strategy.nodes),
                           strategy_edge_count=len(strategy.edges),
                           execution_order=strategy.execution_order)
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
        logger.info("🚀 Starting strategy execution", 
                   market_data=market_data,
                   execution_order=self.execution_order)
        
        node_outputs = {}
        signals = []
        
        # Execute nodes in topological order
        for i, node_id in enumerate(self.execution_order):
            node = self.nodes[node_id]
            logger.info(f"⚡ Executing node {i+1}/{len(self.execution_order)}", 
                       node_id=node_id, 
                       node_type=type(node).__name__)
            
            try:
                # Gather inputs for this node
                inputs = self._gather_node_inputs(node_id, node_outputs, market_data)
                logger.info("📥 Node inputs gathered", 
                           node_id=node_id, 
                           input_keys=list(inputs.keys()),
                           inputs={k: str(v) for k, v in inputs.items()})
                
                # Execute node
                outputs = node.compute(**inputs)
                logger.info("📤 Node outputs", 
                           node_id=node_id, 
                           output_keys=list(outputs.keys()) if outputs else [],
                           outputs={k: str(v) for k, v in outputs.items()} if outputs else {})
                
                # Store outputs
                node_outputs[node_id] = outputs
                
                # Check for trading signals
                if outputs and "signal-out" in outputs and outputs["signal-out"]:
                    logger.info("🎯 Trading signal generated", 
                               node_id=node_id, 
                               signal=outputs["signal-out"])
                    signals.append(outputs["signal-out"])
                
            except Exception as e:
                logger.exception("💥 Node execution failed", 
                               node_id=node_id,
                               node_type=type(node).__name__,
                               error=str(e),
                               inputs=inputs if 'inputs' in locals() else "unknown")
                raise
        
        logger.info("✅ Strategy execution completed", 
                   total_signals=len(signals),
                   signals=signals,
                   node_outputs_summary={k: list(v.keys()) if v else [] for k, v in node_outputs.items()})
        
        return signals
    
    def _gather_node_inputs(self, node_id: str, node_outputs: Dict[str, Dict], 
                           market_data: Dict[str, Any]) -> Dict[str, Any]:
        """Gather inputs for a node from previous outputs and market data."""
        logger.info("📥 Gathering inputs for node", node_id=node_id)
        
        inputs = {}
        
        # Get inputs from connected nodes
        logger.info("🔗 Checking for input connections")
        connections_found = 0
        for source_id, source_outputs in node_outputs.items():
            if source_id in self.edge_map:
                for edge in self.edge_map[source_id]:
                    if edge["target"] == node_id:
                        source_handle = edge["sourceHandle"]
                        target_handle = edge["targetHandle"]
                        
                        logger.info("🔗 Found connection", 
                                   source_node=source_id,
                                   target_node=node_id,
                                   source_handle=source_handle,
                                   target_handle=target_handle)
                        
                        if source_handle in source_outputs:
                            input_key = target_handle.replace("-", "_")
                            inputs[input_key] = source_outputs[source_handle]
                            connections_found += 1
                            logger.info("✅ Connected input", 
                                       input_key=input_key,
                                       value=str(source_outputs[source_handle]))
                        else:
                            logger.warning("⚠️ Source handle not found in outputs",
                                         source_handle=source_handle,
                                         available_handles=list(source_outputs.keys()))
        
        logger.info("🔗 Connection summary", 
                   connections_found=connections_found,
                   inputs_gathered=list(inputs.keys()))
        
        # Add market data for data nodes
        node = self.nodes[node_id]
        node_type = getattr(node, 'node_type', type(node).__name__.replace('Node', 'Node').lower())
        logger.info("📊 Checking if node needs market data", 
                   node_id=node_id,
                   node_type=node_type)
        
        if node_type in ["priceNode", "volumeNode"]:
            logger.info("📊 Adding market data to data node", 
                       node_id=node_id,
                       node_type=node_type,
                       market_data_keys=list(market_data.keys()))
            
            # Data nodes get market data directly
            if node_type == "priceNode":
                price_type = node.data.get("priceType", "close")
                inputs["market_data"] = market_data
                logger.info("💰 Price node configured", 
                           price_type=price_type,
                           market_data=market_data)
            elif node_type == "volumeNode":
                inputs["market_data"] = market_data
                logger.info("📊 Volume node configured", market_data=market_data)
        
        logger.info("📥 Final inputs for node", 
                   node_id=node_id,
                   input_count=len(inputs),
                   inputs={k: str(v) for k, v in inputs.items()})
        
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