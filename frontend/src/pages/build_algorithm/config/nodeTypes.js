// Node Type Imports
import PriceNode from '../../../components/nodes/data/PriceNode.jsx';
import ConstantNode from '../../../components/nodes/data/ConstantNode.jsx';
import TimeNode from '../../../components/nodes/data/TimeNode.jsx';
import SpreadNode from '../../../components/nodes/data/SpreadNode.jsx';
import SMANode from '../../../components/nodes/indicators/SMANode.jsx';
import RSINode from '../../../components/nodes/indicators/RSINode.jsx';
import ATRNode from '../../../components/nodes/indicators/ATRNode.jsx';
import WilliamsRNode from '../../../components/nodes/indicators/WilliamsRNode.jsx';
import CCINode from '../../../components/nodes/indicators/CCINode.jsx';
import ADXNode from '../../../components/nodes/indicators/ADXNode.jsx';
import CompareNode from '../../../components/nodes/logic/CompareNode.jsx';
import ThresholdNode from '../../../components/nodes/logic/ThresholdNode.jsx';
import DivergenceNode from '../../../components/nodes/logic/DivergenceNode.jsx';
import PatternNode from '../../../components/nodes/logic/PatternNode.jsx';
import BuyNode from '../../../components/nodes/actions/BuyNode.jsx';
import SellNode from '../../../components/nodes/actions/SellNode.jsx';
import StopLossNode from '../../../components/nodes/actions/StopLossNode.jsx';
import TakeProfitNode from '../../../components/nodes/actions/TakeProfitNode.jsx';
import PositionSizeNode from '../../../components/nodes/actions/PositionSizeNode.jsx';
import AndNode from '../../../components/nodes/logic/AndNode.jsx';
import OrNode from '../../../components/nodes/logic/OrNode.jsx';
import NotNode from '../../../components/nodes/logic/NotNode.jsx';
import CrossoverNode from "../../../components/nodes/logic/CrossoverNode.jsx";
import BollingerBandsNode from '../../../components/nodes/indicators/BollingerBandsNode.jsx';
import EMANode from '../../../components/nodes/indicators/EMANode.jsx';
import HoldNode from '../../../components/nodes/actions/HoldNode.jsx';
import MACDNode from '../../../components/nodes/indicators/MACDNode.jsx';
import StochasticNode from "../../../components/nodes/indicators/StochasticNode.jsx";
import VolumeNode from "../../../components/nodes/indicators/VolumeNode.jsx";
import LabelNode from '../../../components/nodes/other/LabelNode.jsx';

export const nodeTypes = {
  priceNode: PriceNode,
  constantNode: ConstantNode,
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
