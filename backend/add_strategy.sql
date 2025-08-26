-- Add the ADA Bull Run 2023 strategy to the dev user
INSERT INTO strategies (
    id, 
    user_id, 
    name, 
    description, 
    json_tree, 
    compilation_report, 
    version, 
    created_at, 
    updated_at
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',  -- dev user ID
    'ADA Bull Run Catcher 2023',
    'Optimized strategy for ADA''s volatile Jan-Mar 2023 period. Uses SMA 3/8 crossover to catch quick price movements from $0.25 to $0.42. Designed to generate multiple profitable trades during volatile periods.',
    '{
        "nodes": [
            {
                "id": "price-1",
                "type": "priceNode", 
                "position": {"x": 100, "y": 200},
                "data": {"priceType": "close"}
            },
            {
                "id": "sma3-1",
                "type": "smaNode",
                "position": {"x": 300, "y": 150},
                "data": {"period": 3}
            },
            {
                "id": "sma8-1", 
                "type": "smaNode",
                "position": {"x": 300, "y": 250},
                "data": {"period": 8}
            },
            {
                "id": "crossover-1",
                "type": "crossoverNode", 
                "position": {"x": 500, "y": 200},
                "data": {"crossType": "above"}
            },
            {
                "id": "crossover-2",
                "type": "crossoverNode",
                "position": {"x": 500, "y": 300}, 
                "data": {"crossType": "below"}
            },
            {
                "id": "buy-1",
                "type": "buyNode",
                "position": {"x": 700, "y": 150},
                "data": {"quantity": 1000, "orderType": "market"}
            },
            {
                "id": "sell-1", 
                "type": "sellNode",
                "position": {"x": 700, "y": 300},
                "data": {"quantity": 1000, "orderType": "market"}
            }
        ],
        "edges": [
            {"source": "price-1", "target": "sma3-1", "sourceHandle": "price-out", "targetHandle": "price-in"},
            {"source": "price-1", "target": "sma8-1", "sourceHandle": "price-out", "targetHandle": "price-in"},
            {"source": "sma3-1", "target": "crossover-1", "sourceHandle": "sma-out", "targetHandle": "fast-in"},
            {"source": "sma8-1", "target": "crossover-1", "sourceHandle": "sma-out", "targetHandle": "slow-in"},
            {"source": "sma3-1", "target": "crossover-2", "sourceHandle": "sma-out", "targetHandle": "fast-in"}, 
            {"source": "sma8-1", "target": "crossover-2", "sourceHandle": "sma-out", "targetHandle": "slow-in"},
            {"source": "crossover-1", "target": "buy-1", "sourceHandle": "cross-out", "targetHandle": "trigger-in"},
            {"source": "crossover-2", "target": "sell-1", "sourceHandle": "cross-out", "targetHandle": "trigger-in"}
        ]
    }',
    '{"success": true, "message": "Strategy optimized for ADA 2023 bull run", "nodes_count": 7, "edges_count": 8}',
    1,  -- version
    NOW(),
    NOW()
)
RETURNING id, name;