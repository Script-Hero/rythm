import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "../../components/ui/dropdown-menu";
import { Button } from "../../components/ui/button";
import { Database, BarChart3, Settings, Zap, ChevronLeft, ChevronRight, Hash, TrendingUp, ChevronDown, Save, FolderOpen, Plus } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { STRATEGY_TEMPLATES, getTemplateList } from './complex-templates';
import { BASIC_STRATEGY_TEMPLATES, getBasicTemplateList } from './basic-templates';
import { SaveStrategyDialog } from '../../components/strategies/SaveStrategyDialog';
import { StrategyBrowserDialog } from '../../components/strategies/StrategyBrowserDialog';
import { TemplateBrowserDialog } from '../../components/strategies/TemplateBrowserDialog';
import { NodeContextMenu } from '../../components/strategies/NodeContextMenu';
import { toast } from 'sonner';
import { apiService } from '../../services/api';


// Nodes
import PriceNode from '../../components/nodes/data/PriceNode.jsx';
import TimeNode from '../../components/nodes/data/TimeNode.jsx';
import SpreadNode from '../../components/nodes/data/SpreadNode.jsx';
import SMANode from '../../components/nodes/indicators/SMANode.jsx';
import RSINode from '../../components/nodes/indicators/RSINode.jsx';
import ATRNode from '../../components/nodes/indicators/ATRNode.jsx';
import WilliamsRNode from '../../components/nodes/indicators/WilliamsRNode.jsx';
import CCINode from '../../components/nodes/indicators/CCINode.jsx';
import ADXNode from '../../components/nodes/indicators/ADXNode.jsx';
import CompareNode from '../../components/nodes/logic/CompareNode.jsx';
import ThresholdNode from '../../components/nodes/logic/ThresholdNode.jsx';
import DivergenceNode from '../../components/nodes/logic/DivergenceNode.jsx';
import PatternNode from '../../components/nodes/logic/PatternNode.jsx';
import BuyNode from '../../components/nodes/actions/BuyNode.jsx';
import SellNode from '../../components/nodes/actions/SellNode.jsx';
import StopLossNode from '../../components/nodes/actions/StopLossNode.jsx';
import TakeProfitNode from '../../components/nodes/actions/TakeProfitNode.jsx';
import PositionSizeNode from '../../components/nodes/actions/PositionSizeNode.jsx';
import AndNode from '../../components/nodes/logic/AndNode.jsx';
import OrNode from '../../components/nodes/logic/OrNode.jsx';
import NotNode from '../../components/nodes/logic/NotNode.jsx';
import CrossoverNode from "../../components/nodes/logic/CrossoverNode.jsx";
import BollingerBandsNode from '../../components/nodes/indicators/BollingerBandsNode.jsx';
import EMANode from '../../components/nodes/indicators/EMANode.jsx';
import HoldNode from '../../components/nodes/actions/HoldNode.jsx';
import MACDNode from '../../components/nodes/indicators/MACDNode.jsx';
import StochasticNode from "../../components/nodes/indicators/StochasticNode.jsx";
import VolumeNode from "../../components/nodes/indicators/VolumeNode.jsx";
import LabelNode from '../../components/nodes/other/LabelNode.jsx';


const nodeTypes = {
  priceNode: PriceNode,
  timeNode: TimeNode,
  spreadNode: SpreadNode,
  smaNode: SMANode,
  rsiNode: RSINode,
  atrNode: ATRNode,
  williamsRNode: WilliamsRNode,
  cciNode: CCINode,
  adxNode: ADXNode,
  compareNode: CompareNode,
  thresholdNode: ThresholdNode,
  divergenceNode: DivergenceNode,
  patternNode: PatternNode,
  buyNode: BuyNode,
  sellNode: SellNode,
  stopLossNode: StopLossNode,
  takeProfitNode: TakeProfitNode,
  positionSizeNode: PositionSizeNode,
  andNode: AndNode,
  orNode: OrNode,
  notNode: NotNode,
  crossoverNode: CrossoverNode,
  bollingerBandsNode: BollingerBandsNode,
  emaNode: EMANode,
  holdNode: HoldNode,
  macdNode: MACDNode,
  stochasticNode: StochasticNode,
  volumeNode: VolumeNode,
  labelNode: LabelNode,
};


// Node templates for the toolbar
const nodeTemplates = [
  // Data Nodes
  {
    type: 'priceNode',
    label: 'Price Data',
    category: 'data',
  },
  {
    type: 'timeNode',
    label: 'Time Filter',
    category: 'data',
  },
  {
    type: 'spreadNode',
    label: 'Spread Data',
    category: 'data',
  },
  // Indicator Nodes
  {
    type: 'smaNode',
    label: 'SMA',
    category: 'indicators',
  },
  {
    type: 'emaNode',
    label: 'EMA',
    category: 'indicators',
  },
  {
    type: 'rsiNode',
    label: 'RSI',
    category: 'indicators',
  },
  {
    type: 'atrNode',
    label: 'ATR',
    category: 'indicators',
  },
  {
    type: 'williamsRNode',
    label: 'Williams R',
    category: 'indicators',
  },
  {
    type: 'cciNode',
    label: 'CCI',
    category: 'indicators',
  },
  {
    type: 'adxNode',
    label: 'ADX',
    category: 'indicators',
  },
  {
    type: 'macdNode',
    label: 'MACD',
    category: 'indicators',
  },
  {
    type: 'bollingerBandsNode',
    label: 'Bollinger Bands',
    category: 'indicators',
  },
  {
    type: 'stochasticNode',
    label: 'Stochastic',
    category: 'indicators',
  },
  {
    type: 'volumeNode',
    label: 'Volume',
    category: 'indicators',
  },
  // Logic Nodes
  {
    type: 'compareNode',
    label: 'Compare',
    category: 'logic',
  },
  {
    type: 'thresholdNode',
    label: 'Threshold',
    category: 'logic',
  },
  {
    type: 'divergenceNode',
    label: 'Divergence',
    category: 'logic',
  },
  {
    type: 'patternNode',
    label: 'Pattern',
    category: 'logic',
  },
  {
    type: 'crossoverNode',
    label: 'Crossover',
    category: 'logic',
  },
  {
    type: 'andNode',
    label: 'AND',
    category: 'logic',
  },
  {
    type: 'orNode',
    label: 'OR',
    category: 'logic',
  },
  {
    type: 'notNode',
    label: 'NOT',
    category: 'logic',
  },
  // Action Nodes
  {
    type: 'buyNode',
    label: 'Buy Order',
    category: 'actions',
  },
  {
    type: 'sellNode',
    label: 'Sell Order',
    category: 'actions',
  },
  {
    type: 'stopLossNode',
    label: 'Stop Loss',
    category: 'actions',
  },
  {
    type: 'takeProfitNode',
    label: 'Take Profit',
    category: 'actions',
  },
  {
    type: 'positionSizeNode',
    label: 'Position Size',
    category: 'actions',
  },
  {
    type: 'holdNode',
    label: 'Hold',
    category: 'actions',
  },
  // Other Nodes
  {
    type: 'labelNode',
    label: 'Label',
    category: 'other',
  },
];



function InnerPage() {


  const [selectedStrategy, setSelectedStrategy] = useState('rsi');
  //const [flowConfig, setFlowConfig] = useState({
  //  nodes: BASIC_STRATEGY_TEMPLATES.rsi.initialNodes,
  //  edges: BASIC_STRATEGY_TEMPLATES.rsi.initialEdges,
  //});
  const [flowConfig, setFlowConfig] = useState({
      nodes: [],
      edges: [],
    });


  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [currentStrategyId, setCurrentStrategyId] = useState(null);
  const [currentStrategyMeta, setCurrentStrategyMeta] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [savedStrategies, setSavedStrategies] = useState([]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const {nodes, edges} = flowConfig;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  
  const reactFlowWrapper = useRef(null);
  const { screenToFlowPosition, project } = useReactFlow();

  // Handle URL parameters for auto-loading strategies and load saved strategies
  useEffect(() => {
    loadSavedStrategies();
    const loadParam = searchParams.get('load');
    if (loadParam) {
      // Auto-load strategy from URL parameter
      loadStrategyById(loadParam);
    }
  }, [searchParams]);

  const loadSavedStrategies = async () => {
    try {
      const response = await apiService.listStrategies({ include_templates: false });
      console.log('Loaded saved strategies:', response.strategies); // Debug log
      setSavedStrategies(response.strategies);
    } catch (error) {
      console.error('Failed to load saved strategies:', error);
      toast.error('Failed to load saved strategies');
    }
  };

  const loadStrategyById = async (strategyId) => {
    try {
      const strategy = await apiService.getStrategy(strategyId);
      if (strategy) {
        onLoadStrategy(strategy);
      } else {
        toast.error('Strategy not found');
      }
    } catch (error) {
      toast.error('Failed to load strategy');
      console.error('Failed to load strategy:', error);
    }
  };

  const onNodesChange = useCallback(changes => {
    setFlowConfig(cfg => ({
      ...cfg,
      nodes: applyNodeChanges(changes, cfg.nodes),
    }));
  }, []);

  const onEdgesChange = useCallback(changes => {
    setFlowConfig(cfg => ({
      ...cfg,
      edges: applyEdgeChanges(changes, cfg.edges),
    }));
  }, []);

  const onConnect = useCallback(params => {
    setFlowConfig(cfg => ({
      ...cfg,
      edges: addEdge(params, cfg.edges),
    }));
  }, []);

  const updateNodeData = useCallback((nodeId, newData) => {
    setFlowConfig(cfg => ({
      ...cfg,
      nodes: cfg.nodes.map(node =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node
      ),
    }));
  }, []);

  // Create nodeTypes with updateNodeData injected - memoized to prevent recreating on every render
  const nodeTypesWithData = useMemo(() => ({
    priceNode: (props) => <PriceNode {...props} updateNodeData={updateNodeData} />,
    timeNode: (props) => <TimeNode {...props} updateNodeData={updateNodeData} />,
    spreadNode: (props) => <SpreadNode {...props} updateNodeData={updateNodeData} />,
    smaNode: (props) => <SMANode {...props} updateNodeData={updateNodeData} />,
    rsiNode: (props) => <RSINode {...props} updateNodeData={updateNodeData} />,
    atrNode: (props) => <ATRNode {...props} updateNodeData={updateNodeData} />,
    williamsRNode: (props) => <WilliamsRNode {...props} updateNodeData={updateNodeData} />,
    cciNode: (props) => <CCINode {...props} updateNodeData={updateNodeData} />,
    adxNode: (props) => <ADXNode {...props} updateNodeData={updateNodeData} />,
    compareNode: (props) => <CompareNode {...props} updateNodeData={updateNodeData} />,
    thresholdNode: (props) => <ThresholdNode {...props} updateNodeData={updateNodeData} />,
    divergenceNode: (props) => <DivergenceNode {...props} updateNodeData={updateNodeData} />,
    patternNode: (props) => <PatternNode {...props} updateNodeData={updateNodeData} />,
    buyNode: (props) => <BuyNode {...props} updateNodeData={updateNodeData} />,
    sellNode: (props) => <SellNode {...props} updateNodeData={updateNodeData} />,
    stopLossNode: (props) => <StopLossNode {...props} updateNodeData={updateNodeData} />,
    takeProfitNode: (props) => <TakeProfitNode {...props} updateNodeData={updateNodeData} />,
    positionSizeNode: (props) => <PositionSizeNode {...props} updateNodeData={updateNodeData} />,
    andNode: (props) => <AndNode {...props} updateNodeData={updateNodeData} />,
    orNode: (props) => <OrNode {...props} updateNodeData={updateNodeData} />,
    notNode: (props) => <NotNode {...props} updateNodeData={updateNodeData} />,
    crossoverNode: (props) => <CrossoverNode {...props} updateNodeData={updateNodeData} />,
    bollingerBandsNode: (props) => <BollingerBandsNode {...props} updateNodeData={updateNodeData} />,
    emaNode: (props) => <EMANode {...props} updateNodeData={updateNodeData} />,
    holdNode: (props) => <HoldNode {...props} updateNodeData={updateNodeData} />,
    macdNode: (props) => <MACDNode {...props} updateNodeData={updateNodeData} />,
    stochasticNode: (props) => <StochasticNode {...props} updateNodeData={updateNodeData} />,
    volumeNode: (props) => <VolumeNode {...props} updateNodeData={updateNodeData} />,
    labelNode: (props) => <LabelNode {...props} updateNodeData={updateNodeData} />,
  }), [updateNodeData]);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const nodeData = JSON.parse(event.dataTransfer.getData('application/reactflow'));
      if (!nodeData) return;

      const position = screenToFlowPosition
        ? screenToFlowPosition({ x: event.clientX, y: event.clientY })
        : project({ x: event.clientX, y: event.clientY });

      const newNode = {
          id: crypto.randomUUID(),
          type: nodeData.type,
          position,
          data: { ...nodeData.data },
        };

        setFlowConfig((cfg) => ({
          ...cfg,
          nodes: [...cfg.nodes, newNode],
        }));
      }, 
    [screenToFlowPosition, project]
  );

  // Group nodes by category for better organization
  const groupedNodes = nodeTemplates.reduce((acc, node) => {
    if (!acc[node.category]) acc[node.category] = [];
    acc[node.category].push(node);
    return acc;
  }, {});

  const categoryColors = {
    data: 'bg-blue-500 hover:bg-blue-600',
    indicators: 'bg-green-500 hover:bg-green-600', 
    logic: 'bg-yellow-500 hover:bg-yellow-600',
    actions: 'bg-red-500 hover:bg-red-600',
    other: 'bg-gray-600 hover:bg-gray-700'
  };

  const categoryLabels = {
    data: 'Data',
    indicators: 'Indicators',
    logic: 'Logic',
    actions: 'Actions',
    other: 'Other'
  };

  const categoryIcons = {
    data: Database,
    indicators: BarChart3,
    logic: Settings,
    actions: Zap,
    other: Hash
  };


  const handleSaveStrategy = () => {
    setSaveDialogOpen(true);
  };

  const handleLoadTemplate = () => {
    setTemplateDialogOpen(true);
  };

  const onLoadStrategy = async (strategy) => {
    console.log('Loading strategy:', strategy); // Debug log
    try {
      // If strategy doesn't have json_tree, fetch the full strategy data
      let fullStrategy = strategy;
      if (!strategy.json_tree) {
        fullStrategy = await apiService.getStrategy(strategy.id);
      }
      
      setFlowConfig({
        nodes: fullStrategy.json_tree?.nodes || [],
        edges: fullStrategy.json_tree?.edges || [],
      });
      setCurrentStrategyId(fullStrategy.id);
      setCurrentStrategyMeta({
        id: fullStrategy.id,
        name: fullStrategy.name,
        description: fullStrategy.description,
        category: fullStrategy.category,
        tags: fullStrategy.tags,
      });
      toast.success(`Loaded strategy: ${fullStrategy.name}`);
    } catch (error) {
      console.error('Error loading strategy:', error);
      toast.error('Failed to load strategy');
    }
  };

  const onLoadTemplate = (templateKey, isComplex) => {
    const template = isComplex ? STRATEGY_TEMPLATES[templateKey] : BASIC_STRATEGY_TEMPLATES[templateKey];
    if (template) {
      setFlowConfig({
        nodes: template.initialNodes,
        edges: template.initialEdges,
      });
      setCurrentStrategyId(null);
      setCurrentStrategyMeta(null);
      setSelectedStrategy(templateKey);
    }
  };

  const handleNewStrategy = () => {
    setFlowConfig({
      nodes: [],
      edges: [],
    });
    setCurrentStrategyId(null);
    setCurrentStrategyMeta(null);
    toast.success('Started new strategy');
  };

  const handleCopyNode = (nodeId) => {
    const nodeToCopy = nodes.find(node => node.id === nodeId);
    if (nodeToCopy) {
      const newNode = {
        ...nodeToCopy,
        id: `${nodeToCopy.type}-${Date.now()}`,
        position: {
          x: nodeToCopy.position.x + 50,
          y: nodeToCopy.position.y + 50,
        },
      };
      
      setFlowConfig(cfg => ({
        ...cfg,
        nodes: [...cfg.nodes, newNode],
      }));
      
      toast.success('Node copied');
    }
  };

  const handleDeleteNode = (nodeId) => {
    // Remove the node and any connected edges
    setFlowConfig(cfg => ({
      nodes: cfg.nodes.filter(node => node.id !== nodeId),
      edges: cfg.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId),
    }));
    
    toast.success('Node deleted');
  };

  function preprocessFlowConfig(flowConfig) {
    const { nodes, edges } = flowConfig;

    // Initialize each node with empty inputs and outputs
    const nodeMap = nodes.reduce((acc, { id, type, data, position }) => {
      acc[id] = { id, type, data, position, inputs: [], outputs: [] };
      return acc;
    }, {});

    // Populate inputs and outputs based on edges
    edges.forEach(({ id, source, target, sourceHandle, targetHandle }) => {
      // Name connections by their handle or derive a default
      const outputName = sourceHandle || `${source}-out`;
      const inputName = targetHandle || `${target}-in`;

      // Add to source outputs
      if (nodeMap[source]) {
        nodeMap[source].outputs.push({ id, to: target, name: outputName });
      }
      // Add to target inputs
      if (nodeMap[target]) {
        nodeMap[target].inputs.push({ id, from: source, name: inputName });
      }
    });

    // Return as an array of node instances
    return Object.values(nodeMap);
  }



  useEffect(() => {
    console.log(preprocessFlowConfig(flowConfig));
  }, [flowConfig])


  const handleTestStrategy = async () => {
    try {
      // Check if we have nodes to test
      if (nodes.length === 0) {
        toast.error('Please add some nodes to test your strategy');
        return;
      }

      let strategyId = currentStrategyId;

      // If strategy is not saved yet, prompt to save it first
      if (!strategyId) {
        if (window.confirm('Strategy needs to be saved before testing. Save now?')) {
          // Auto-save the strategy with a default name
          const defaultName = `Test Strategy ${new Date().toLocaleString()}`;
          const saveData = {
            name: defaultName,
            description: 'Auto-saved for testing',
            category: 'custom',
            tags: ['test'],
            nodes,
            edges,
          };

          try {
            const result = await apiService.saveStrategy(saveData);
            strategyId = result.id;
            setCurrentStrategyId(strategyId);
            setCurrentStrategyMeta({
              id: strategyId,
              name: defaultName,
              description: 'Auto-saved for testing',
              category: 'custom',
              tags: ['test'],
            });
            await loadSavedStrategies(); // Refresh the dropdown
            toast.success('Strategy auto-saved for testing');
          } catch (error) {
            toast.error('Failed to save strategy: ' + error.message);
            return;
          }
        } else {
          return; // User cancelled
        }
      }

      // Navigate to backtest page with the strategy ID and type parameter
      navigate(`/backtest?strategy=${strategyId}&type=custom&autoRun=true`);
    } catch (error) {
      toast.error('Failed to test strategy: ' + error.message);
    }
  };


  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top header with strategy info and test button */}
      <div className="flex justify-between items-center p-4 border-gray-200">
        {/* Left side - Strategy dropdown */}
        <DropdownMenu classname="p-5">
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto p-0 flex flex-col items-start text-left hover:bg-transparent">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">
                  {currentStrategyMeta ? currentStrategyMeta.name : 'New Strategy'}
                </h2>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </div>
              <p className="text-sm text-gray-600">
                {currentStrategyMeta ? currentStrategyMeta.description : 'Build your custom strategy'}
              </p>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
            <DropdownMenuLabel>My Strategies</DropdownMenuLabel>
            {savedStrategies.length > 0 ? (
              savedStrategies.map((strategy) => (
                <DropdownMenuItem key={strategy.id} onClick={() => onLoadStrategy(strategy)}>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{strategy.name}</span>
                    <span className="text-xs text-gray-500">{strategy.description || 'No description'}</span>
                  </div>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>
                <span className="text-xs text-gray-400">No saved strategies yet</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        

      
      <div id="buttons" className="flex flex-row gap-2">

          <Button 
            onClick={handleNewStrategy}
            variant="outline"
            className="font-medium px-4 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          >
            <Plus size={18} />
            New
          </Button>

          <Button 
            onClick={handleLoadTemplate}
            variant="outline"
            className="font-medium px-4 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          >
            <FolderOpen size={18} />
            Templates
          </Button>

          <Button 
            onClick={handleSaveStrategy}
            className="bg-black text-white font-medium px-6 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          >
            <Save size={18} />
            Save
          </Button>

          {/* Right side - Test button */}
          <Button 
            onClick={handleTestStrategy}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-6 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          >
            <TrendingUp size={18} />
            Test Strategy Performance
          </Button>

        </div>
      </div>
      
      {/* ReactFlow diagram container - fills remaining space above toolbar */}
      <div 
        className="flex-1 overflow-hidden relative"
        onClick={() => setContextMenu(null)} // Close context menu on click
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypesWithData}
          className="w-full h-full"
          fitView
          onDrop={onDrop}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onNodeContextMenu={(event, node) => {
            event.preventDefault();
            setContextMenu({
              nodeId: node.id,
              x: event.clientX,
              y: event.clientY,
            });
          }}
          onEdgeClick={(event, edge) => {
            event.preventDefault();
            // Delete the clicked edge
            setFlowConfig(cfg => ({
              ...cfg,
              edges: cfg.edges.filter(e => e.id !== edge.id),
            }));
            toast.success('Edge deleted');
          }}
          onPaneClick={() => setContextMenu(null)}
          deleteKeyCode={46} // Enable delete key for nodes
          multiSelectionKeyCode={17} // Enable Ctrl for multi-selection
        >
          <Background />
          <Controls />
        </ReactFlow>
        
        {/* Context Menu */}
        {contextMenu && (
          <NodeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            nodeId={contextMenu.nodeId}
            onCopyNode={handleCopyNode}
            onDeleteNode={handleDeleteNode}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
      
      {/* Bottom toolbar - fixed height, spans full width of main pane */}
      <div id="toolbarContainer" className="h-20 flex justify-center items-center bg-gray-100 border-t border-gray-300 flex-shrink-0">
        <div id="toolbar" className="flex flex-row items-center justify-center gap-4 p-3">
          {Object.entries(groupedNodes).map(([category, nodes]) => (
            <Popover key={category}>
              <PopoverTrigger asChild>
                <button
                  className={`${categoryColors[category]} text-white px-4 py-1 rounded-lg shadow-md transition-all duration-200 flex items-center gap-2 font-medium text-sm`}
                >
                  {React.createElement(categoryIcons[category], { size: 16 })}
                  <span>{categoryLabels[category]}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto max-w-4xl p-4" side="top">
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {nodes.map((node) => (
                    <div
                      key={node.type}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('application/reactflow', JSON.stringify(node));
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      className={`${categoryColors[category].replace(' hover:bg-', ' bg-').replace('-600', '-500')} text-white px-3 py-2 rounded shadow cursor-move hover:opacity-80 text-sm whitespace-nowrap text-center transition-opacity duration-150 min-w-[100px]`}
                    >
                      {node.label}
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ))}
        </div>
      </div>

      {/* Strategy Management Dialogs */}
      <SaveStrategyDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        nodes={nodes}
        edges={edges}
        existingStrategy={currentStrategyMeta}
        setCurrentStrategyId={setCurrentStrategyId}
        setCurrentStrategyMeta={setCurrentStrategyMeta}
        onSaved={() => {
          loadSavedStrategies(); // Refresh the dropdown
        }}
      />

      <TemplateBrowserDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        basicTemplates={BASIC_STRATEGY_TEMPLATES}
        complexTemplates={STRATEGY_TEMPLATES}
        onLoadTemplate={onLoadTemplate}
      />
    </div>
  );
}

export default function BuildAlgorithmPage() {
  return (
    <div className="h-full w-full overflow-hidden">
      <ReactFlowProvider>
        <InnerPage />
      </ReactFlowProvider>
    </div>
  );
}
