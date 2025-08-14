#!/usr/bin/env python3
"""
Test script to validate strategy compilation from node tree to Python object.
Tests the core conversion process without running actual strategies.
"""

import sys
import os
import json
import pickle

# Add shared models to path
sys.path.append(os.path.join(os.path.dirname(__file__), '.'))

from shared.strategy_engine.compiler import StrategyCompiler
from shared.strategy_engine import get_available_nodes

def test_simple_buy_strategy():
    """Test a simple buy strategy with price input and buy action."""
    
    print("🧪 Testing Simple Buy Strategy Compilation")
    print("=" * 50)
    
    # Sample strategy: Price → Compare (> 50000) → Buy
    strategy_json = {
        "nodes": [
            {
                "id": "price-1",
                "type": "priceNode",
                "position": {"x": 100, "y": 100},
                "data": {"priceType": "close"}
            },
            {
                "id": "compare-1", 
                "type": "compareNode",
                "position": {"x": 300, "y": 100},
                "data": {
                    "operator": "greater_than",
                    "value": 50000
                }
            },
            {
                "id": "buy-1",
                "type": "buyNode", 
                "position": {"x": 500, "y": 100},
                "data": {"amount": 1000}
            }
        ],
        "edges": [
            {
                "id": "edge-1",
                "source": "price-1",
                "target": "compare-1", 
                "sourceHandle": "price-out",
                "targetHandle": "value-in"
            },
            {
                "id": "edge-2",
                "source": "compare-1",
                "target": "buy-1",
                "sourceHandle": "result-out", 
                "targetHandle": "condition-in"
            }
        ]
    }
    
    print(f"📊 Strategy Structure:")
    print(f"   Nodes: {len(strategy_json['nodes'])}")
    print(f"   Edges: {len(strategy_json['edges'])}")
    for node in strategy_json['nodes']:
        print(f"   - {node['id']}: {node['type']}")
    
    # Test compilation
    print("\n🔧 Starting Compilation Process")
    compiler = StrategyCompiler()
    result = compiler.compile_strategy(strategy_json)
    
    print(f"\n📋 Compilation Results:")
    print(f"   Success: {result.success}")
    print(f"   Errors: {result.errors}")
    print(f"   Warnings: {result.warnings}")
    print(f"   Unknown Nodes: {result.unknown_nodes}")
    print(f"   Execution Order: {result.execution_order}")
    print(f"   Strategy Instance: {result.strategy_instance is not None}")
    
    if result.strategy_instance:
        print(f"\n🏗️ Strategy Instance Details:")
        print(f"   Type: {type(result.strategy_instance).__name__}")
        print(f"   Nodes: {len(result.strategy_instance.nodes)}")
        print(f"   Edges: {len(result.strategy_instance.edges)}")
        print(f"   Execution Order: {result.strategy_instance.execution_order}")
        
        # Test pickling
        print(f"\n🥒 Testing Pickle Serialization:")
        try:
            pickled = pickle.dumps(result.strategy_instance)
            print(f"   ✅ Pickle Success - Size: {len(pickled)} bytes")
            
            # Test unpickling
            unpickled = pickle.loads(pickled)
            print(f"   ✅ Unpickle Success - Type: {type(unpickled).__name__}")
            print(f"   ✅ Unpickled Nodes: {len(unpickled.nodes)}")
            print(f"   ✅ Unpickled Execution Order: {unpickled.execution_order}")
            
            return True
            
        except Exception as e:
            print(f"   ❌ Pickle Failed: {e}")
            return False
    
    return result.success

def test_available_nodes():
    """Test that node registry is working properly."""
    
    print("\n📚 Testing Node Registry")
    print("=" * 50)
    
    nodes = get_available_nodes()
    print(f"Total Available Nodes: {len(nodes)}")
    
    by_category = {}
    for node_type, info in nodes.items():
        category = info.get('category', 'unknown')
        if category not in by_category:
            by_category[category] = []
        by_category[category].append(node_type)
    
    for category, node_types in by_category.items():
        print(f"\n{category.title()} Nodes ({len(node_types)}):")
        for node_type in node_types:
            print(f"   - {node_type}")
    
    return len(nodes) > 0

def test_complex_strategy():
    """Test a more complex strategy with multiple indicators."""
    
    print("\n🧪 Testing Complex Strategy Compilation") 
    print("=" * 50)
    
    # Strategy: Price → SMA → EMA → Compare → Buy
    strategy_json = {
        "nodes": [
            {
                "id": "price-1",
                "type": "priceNode", 
                "position": {"x": 50, "y": 100},
                "data": {"priceType": "close"}
            },
            {
                "id": "sma-1",
                "type": "smaNode",
                "position": {"x": 200, "y": 100}, 
                "data": {"period": 20}
            },
            {
                "id": "ema-1", 
                "type": "emaNode",
                "position": {"x": 350, "y": 100},
                "data": {"period": 12}
            },
            {
                "id": "compare-1",
                "type": "compareNode",
                "position": {"x": 500, "y": 100},
                "data": {"operator": "greater_than"}
            },
            {
                "id": "buy-1",
                "type": "buyNode",
                "position": {"x": 650, "y": 100}, 
                "data": {"amount": 500}
            }
        ],
        "edges": [
            {
                "id": "edge-1",
                "source": "price-1",
                "target": "sma-1",
                "sourceHandle": "price-out",
                "targetHandle": "price-in"
            },
            {
                "id": "edge-2", 
                "source": "price-1",
                "target": "ema-1",
                "sourceHandle": "price-out",
                "targetHandle": "price-in"
            },
            {
                "id": "edge-3",
                "source": "ema-1", 
                "target": "compare-1",
                "sourceHandle": "ema-out",
                "targetHandle": "value-in"
            },
            {
                "id": "edge-4",
                "source": "sma-1",
                "target": "compare-1", 
                "sourceHandle": "sma-out",
                "targetHandle": "reference-in"
            },
            {
                "id": "edge-5",
                "source": "compare-1",
                "target": "buy-1",
                "sourceHandle": "result-out",
                "targetHandle": "condition-in"
            }
        ]
    }
    
    print(f"📊 Complex Strategy Structure:")
    print(f"   Nodes: {len(strategy_json['nodes'])}")
    print(f"   Edges: {len(strategy_json['edges'])}")
    
    compiler = StrategyCompiler()
    result = compiler.compile_strategy(strategy_json)
    
    print(f"\n📋 Complex Strategy Results:")
    print(f"   Success: {result.success}")
    print(f"   Errors: {result.errors}")
    print(f"   Execution Order: {result.execution_order}")
    
    if result.strategy_instance:
        # Test pickle roundtrip
        try:
            pickled = pickle.dumps(result.strategy_instance)
            unpickled = pickle.loads(pickled)
            print(f"   ✅ Complex Strategy Pickle Success")
            return True
        except Exception as e:
            print(f"   ❌ Complex Strategy Pickle Failed: {e}")
    
    return result.success

def main():
    """Run all compilation tests."""
    
    print("🔬 Strategy Compilation Validation Test Suite")
    print("=" * 60)
    print("Testing the conversion from GUI node tree to Python objects\n")
    
    tests = [
        ("Node Registry", test_available_nodes),
        ("Simple Buy Strategy", test_simple_buy_strategy), 
        ("Complex Strategy", test_complex_strategy)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            success = test_func()
            results.append((test_name, success))
            print(f"✅ {test_name}: {'PASSED' if success else 'FAILED'}")
        except Exception as e:
            print(f"❌ {test_name}: CRASHED - {e}")
            results.append((test_name, False))
    
    print(f"\n{'='*60}")
    print("📊 FINAL RESULTS")
    print("=" * 60)
    
    passed = 0
    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{test_name}: {status}")
        if success:
            passed += 1
    
    print(f"\nOverall: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("🎉 All compilation tests PASSED - Pipeline is working correctly!")
    else:
        print("⚠️ Some tests FAILED - Issues found in compilation pipeline!")
    
    return passed == len(results)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)