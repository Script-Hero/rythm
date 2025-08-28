"""
Base node system for strategy compilation.
Ported and enhanced from Beta1 architecture.
"""

import time
import structlog
from abc import ABC, abstractmethod
from collections import deque
from typing import Any, Dict, List, Optional, Set, Tuple
from decimal import Decimal

# Configure structured logging
logger = structlog.get_logger("strategy_nodes")

# Node registry
NODE_REGISTRY: Dict[str, type] = {}


def register_node(node_type: str):
    """Decorator to register node types."""
    def decorator(cls):
        NODE_REGISTRY[node_type] = cls
        cls.node_type = node_type
        return cls
    return decorator


class Node(ABC):
    """
    Base class for all strategy nodes.
    Enhanced from Beta1 with better typing and async support.
    """
    
    inputs: Tuple[str, ...] = ()
    outputs: Tuple[str, ...] = ()
    
    def __init__(self, node_id: str, data: Dict[str, Any], position: Dict[str, float]):
        self.id = node_id
        self.data = data
        self.position = position
        self.state = {}  # Node-specific state
        self.last_update = 0
        
        logger.info("🧩 Node initialized", 
                   node_id=node_id,
                   node_type=getattr(self, 'node_type', type(self).__name__),
                   data_keys=list(data.keys()),
                   inputs=self.inputs,
                   outputs=self.outputs)
    
    @abstractmethod
    def compute(self, **inputs) -> Dict[str, Any]:
        """Compute node outputs from inputs."""
        pass
    
    def reset_state(self):
        """Reset node state."""
        old_state = dict(self.state)
        self.state = {}
        self.last_update = 0
        
        logger.info("🔄 Node state reset", 
                   node_id=self.id,
                   node_type=getattr(self, 'node_type', type(self).__name__),
                   old_state_keys=list(old_state.keys()))
    
    def get_state_summary(self) -> Dict[str, Any]:
        """Get summary of node state for debugging."""
        return {
            "id": self.id,
            "type": self.node_type,
            "state_keys": list(self.state.keys()),
            "last_update": self.last_update
        }


# Data Nodes
@register_node("timeNode")
class TimeNode(Node):
    inputs = ()
    outputs = ("time-out",)
    
    def compute(self, **inputs) -> Dict[str, Any]:
        logger.info("⏰ TimeNode computing", 
                   node_id=self.id,
                   inputs_received=list(inputs.keys()))
        
        time_type = self.data.get("timeType", "hour")
        current_time = time.time()
        
        if time_type == "hour":
            time_value = int((current_time % 86400) // 3600)  # Hour of day (0-23)
        elif time_type == "minute":
            time_value = int((current_time % 3600) // 60)  # Minute of hour (0-59)
        elif time_type == "day_of_week":
            time_value = int((current_time // 86400) % 7)  # Day of week (0-6)
        else:
            time_value = int(current_time)  # Unix timestamp
        
        result = {"time-out": Decimal(str(time_value))}
        logger.info("⏰ TimeNode result", result=result)
        return result


@register_node("spreadNode")
class SpreadNode(Node):
    inputs = ("bid-in", "ask-in")
    outputs = ("spread-out",)
    
    def compute(self, bid_in=None, ask_in=None, **inputs) -> Dict[str, Any]:
        if bid_in is None or ask_in is None:
            return {"spread-out": None}
        
        spread = float(ask_in) - float(bid_in)
        return {"spread-out": Decimal(str(spread))}


# Data Nodes
@register_node("constantNode")
class ConstantNode(Node):
    inputs = ()
    outputs = ("value-out",)

    def compute(self, **inputs) -> Dict[str, Any]:
        value = self.data.get("value", 0)
        try:
            # Normalize numeric to Decimal via string to preserve precision
            numeric = Decimal(str(value))
            return {"value-out": numeric}
        except Exception:
            # Fallback: return raw value (e.g., string constants)
            return {"value-out": value}

@register_node("priceNode")
class PriceNode(Node):
    inputs = ()
    outputs = ("price-out",)
    
    def compute(self, **inputs) -> Dict[str, Any]:
        logger.debug("💰 PriceNode computing", 
                   node_id=self.id,
                   inputs_received=list(inputs.keys()),
                   inputs_content={k: str(v) for k, v in inputs.items()})
        
        # Get market data from inputs (passed by backtesting/forward testing engine)
        market_data = inputs.get("market_data")
        if market_data:
            # Only price type is configurable in the node - symbol/interval chosen at test level
            price_type = self.data.get("priceType", "close")
            
            # Extract price based on type
            if price_type == "close":
                price_value = market_data.get("close", market_data.get("price", 0))
            elif price_type == "open":
                price_value = market_data.get("open", market_data.get("price", 0))
            elif price_type == "high":
                price_value = market_data.get("high", market_data.get("price", 0))
            elif price_type == "low":
                price_value = market_data.get("low", market_data.get("price", 0))
            else:
                price_value = market_data.get("price", market_data.get("close", 0))
            
            result = {"price-out": Decimal(str(price_value))}
            logger.debug("💰 PriceNode using market data", 
                       price_type=price_type,
                       price_value=price_value,
                       result=result)
            return result
        
        # Fallback for compilation testing - use mock data
        price_type = self.data.get("priceType", "close")
        
        logger.debug("💰 PriceNode using fallback for compilation test", 
                   price_type=price_type,
                   node_data=self.data)
        
        result = {"price-out": Decimal('100.0')}
        logger.debug("💰 PriceNode returning mock data for compilation", result=result)
        return result


@register_node("volumeNode") 
class VolumeNode(Node):
    inputs = ()
    outputs = ("volume-out",)
    
    def compute(self, **inputs) -> Dict[str, Any]:
        logger.debug("📊 VolumeNode computing", 
                   node_id=self.id,
                   inputs_received=list(inputs.keys()),
                   inputs_content={k: str(v) for k, v in inputs.items()})
        
        # Get market data from inputs (passed by backtesting/forward testing engine)
        market_data = inputs.get("market_data")
        if market_data:
            volume_value = market_data.get("volume", 0)
            result = {"volume-out": Decimal(str(volume_value))}
            logger.debug("📊 VolumeNode using market data", 
                       volume_value=volume_value,
                       result=result)
            return result
        
        # Fallback for compilation testing - use mock data
        logger.debug("📊 VolumeNode using fallback for compilation test", 
                   node_data=self.data)
        
        result = {"volume-out": Decimal('1000.0')}
        logger.debug("📊 VolumeNode returning mock data for compilation", result=result)
        return result


# Indicator Nodes
@register_node("smaNode")
class SMANode(Node):
    inputs = ("price-in",)
    outputs = ("sma-out",)
    
    def compute(self, price_in=None, **inputs) -> Dict[str, Any]:
        logger.debug("📈 SMANode computing", 
                   node_id=self.id,
                   price_in=str(price_in),
                   inputs_received=list(inputs.keys()),
                   current_state_keys=list(self.state.keys()))
        
        if price_in is None:
            logger.warning("⚠️ SMANode received None price input", node_id=self.id)
            return {"sma-out": None}
        
        period = int(self.data.get("period", 20))
        logger.debug("📈 SMANode configuration", 
                   node_id=self.id,
                   period=period,
                   node_data=self.data)
        
        prices = self.state.setdefault("prices", deque(maxlen=period))
        old_len = len(prices)
        
        prices.append(float(price_in))
        logger.debug("📈 SMANode price added", 
                   node_id=self.id,
                   new_price=float(price_in),
                   prices_count_before=old_len,
                   prices_count_after=len(prices),
                   prices_window=list(prices))
        
        if len(prices) >= period:
            sma = sum(prices) / len(prices)
            result = {"sma-out": Decimal(str(sma))}
            logger.debug("✅ SMANode calculated SMA", 
                       node_id=self.id,
                       sma_value=sma,
                       prices_used=len(prices),
                       result=result)
            return result
        
        logger.debug("⏳ SMANode waiting for more prices", 
                   node_id=self.id,
                   current_count=len(prices),
                   needed_count=period)
        return {"sma-out": None}


@register_node("emaNode")
class EMANode(Node):
    inputs = ("price-in",)
    outputs = ("ema-out",)
    
    def compute(self, price_in=None, **inputs) -> Dict[str, Any]:
        if price_in is None:
            return {"ema-out": None}
        
        period = int(self.data.get("period", 20))
        alpha = 2.0 / (period + 1)
        
        current_price = float(price_in)
        prev_ema = self.state.get("prev_ema")
        
        if prev_ema is None:
            ema = current_price
        else:
            ema = alpha * current_price + (1 - alpha) * prev_ema
        
        self.state["prev_ema"] = ema
        return {"ema-out": Decimal(str(ema))}


@register_node("rsiNode")
class RSINode(Node):
    inputs = ("price-in",)
    outputs = ("rsi-out",)
    
    def compute(self, price_in=None, **inputs) -> Dict[str, Any]:
        if price_in is None:
            return {"rsi-out": None}
        
        period = int(self.data.get("period", 14))
        prices = self.state.setdefault("prices", deque(maxlen=period + 1))
        
        prices.append(float(price_in))
        
        if len(prices) < 2:
            return {"rsi-out": None}
        
        # Calculate gains and losses
        gains = []
        losses = []
        
        for i in range(1, len(prices)):
            change = prices[i] - prices[i-1]
            gains.append(max(0, change))
            losses.append(max(0, -change))
        
        if len(gains) >= period:
            avg_gain = sum(gains[-period:]) / period
            avg_loss = sum(losses[-period:]) / period
            
            if avg_loss == 0:
                rsi = 100
            else:
                rs = avg_gain / avg_loss
                rsi = 100 - (100 / (1 + rs))
            
            return {"rsi-out": Decimal(str(rsi))}
        
        return {"rsi-out": None}


@register_node("williamsRNode")
class WilliamsRNode(Node):
    inputs = ("high-in", "low-in", "close-in")
    outputs = ("williams-r-out",)
    
    def compute(self, high_in=None, low_in=None, close_in=None, **inputs) -> Dict[str, Any]:
        if any(x is None for x in [high_in, low_in, close_in]):
            return {"williams-r-out": None}
        
        period = int(self.data.get("period", 14))
        
        highs = self.state.setdefault("highs", deque(maxlen=period))
        lows = self.state.setdefault("lows", deque(maxlen=period))
        closes = self.state.setdefault("closes", deque(maxlen=period))
        
        highs.append(float(high_in))
        lows.append(float(low_in))
        closes.append(float(close_in))
        
        if len(closes) < period:
            return {"williams-r-out": None}
        
        highest_high = max(highs)
        lowest_low = min(lows)
        current_close = closes[-1]
        
        if highest_high == lowest_low:
            williams_r = -50  # Default when no range
        else:
            williams_r = ((highest_high - current_close) / (highest_high - lowest_low)) * -100
        
        return {"williams-r-out": Decimal(str(williams_r))}


@register_node("cciNode")
class CCINode(Node):
    inputs = ("high-in", "low-in", "close-in")
    outputs = ("cci-out",)
    
    def compute(self, high_in=None, low_in=None, close_in=None, **inputs) -> Dict[str, Any]:
        if any(x is None for x in [high_in, low_in, close_in]):
            return {"cci-out": None}
        
        period = int(self.data.get("period", 20))
        
        # Calculate Typical Price
        typical_price = (float(high_in) + float(low_in) + float(close_in)) / 3
        
        typical_prices = self.state.setdefault("typical_prices", deque(maxlen=period))
        typical_prices.append(typical_price)
        
        if len(typical_prices) < period:
            return {"cci-out": None}
        
        # Calculate SMA of typical prices
        sma_tp = sum(typical_prices) / len(typical_prices)
        
        # Calculate mean deviation
        mean_deviation = sum(abs(tp - sma_tp) for tp in typical_prices) / len(typical_prices)
        
        if mean_deviation == 0:
            cci = 0
        else:
            cci = (typical_price - sma_tp) / (0.015 * mean_deviation)
        
        return {"cci-out": Decimal(str(cci))}


# Additional Technical Indicators
@register_node("atrNode")
class ATRNode(Node):
    inputs = ("high-in", "low-in", "close-in")
    outputs = ("atr-out",)
    
    def compute(self, high_in=None, low_in=None, close_in=None, **inputs) -> Dict[str, Any]:
        if any(x is None for x in [high_in, low_in, close_in]):
            return {"atr-out": None}
        
        period = int(self.data.get("period", 14))
        
        # Store OHLC data
        highs = self.state.setdefault("highs", deque(maxlen=period + 1))
        lows = self.state.setdefault("lows", deque(maxlen=period + 1))
        closes = self.state.setdefault("closes", deque(maxlen=period + 1))
        
        highs.append(float(high_in))
        lows.append(float(low_in))
        closes.append(float(close_in))
        
        if len(closes) < 2:
            return {"atr-out": None}
        
        # Calculate True Range
        prev_close = closes[-2]
        current_high = highs[-1]
        current_low = lows[-1]
        
        tr1 = current_high - current_low
        tr2 = abs(current_high - prev_close)
        tr3 = abs(current_low - prev_close)
        
        true_range = max(tr1, tr2, tr3)
        
        # Store TR values
        tr_values = self.state.setdefault("tr_values", deque(maxlen=period))
        tr_values.append(true_range)
        
        if len(tr_values) < period:
            return {"atr-out": None}
        
        # Calculate ATR (Simple Moving Average of True Range)
        atr = sum(tr_values) / len(tr_values)
        
        return {"atr-out": Decimal(str(atr))}


@register_node("adxNode")
class ADXNode(Node):
    inputs = ("high-in", "low-in", "close-in")
    outputs = ("adx-out", "di-plus-out", "di-minus-out")
    
    def compute(self, high_in=None, low_in=None, close_in=None, **inputs) -> Dict[str, Any]:
        if any(x is None for x in [high_in, low_in, close_in]):
            return {"adx-out": None, "di-plus-out": None, "di-minus-out": None}
        
        period = int(self.data.get("period", 14))
        
        # Store OHLC data
        highs = self.state.setdefault("highs", deque(maxlen=period + 5))
        lows = self.state.setdefault("lows", deque(maxlen=period + 5))
        closes = self.state.setdefault("closes", deque(maxlen=period + 5))
        
        highs.append(float(high_in))
        lows.append(float(low_in))
        closes.append(float(close_in))
        
        if len(closes) < 2:
            return {"adx-out": None, "di-plus-out": None, "di-minus-out": None}
        
        # Calculate directional movement
        high_diff = highs[-1] - highs[-2]
        low_diff = lows[-2] - lows[-1]
        
        plus_dm = high_diff if high_diff > low_diff and high_diff > 0 else 0
        minus_dm = low_diff if low_diff > high_diff and low_diff > 0 else 0
        
        # Calculate True Range (simplified)
        tr = max(
            highs[-1] - lows[-1],
            abs(highs[-1] - closes[-2]),
            abs(lows[-1] - closes[-2])
        )
        
        # Store DM and TR values
        plus_dms = self.state.setdefault("plus_dms", deque(maxlen=period))
        minus_dms = self.state.setdefault("minus_dms", deque(maxlen=period))
        tr_values = self.state.setdefault("tr_values", deque(maxlen=period))
        
        plus_dms.append(plus_dm)
        minus_dms.append(minus_dm)
        tr_values.append(tr)
        
        if len(tr_values) < period:
            return {"adx-out": None, "di-plus-out": None, "di-minus-out": None}
        
        # Calculate smoothed averages
        sum_plus_dm = sum(plus_dms)
        sum_minus_dm = sum(minus_dms)
        sum_tr = sum(tr_values)
        
        if sum_tr == 0:
            return {"adx-out": None, "di-plus-out": None, "di-minus-out": None}
        
        # Calculate DI+ and DI-
        di_plus = (sum_plus_dm / sum_tr) * 100
        di_minus = (sum_minus_dm / sum_tr) * 100
        
        # Calculate DX
        if di_plus + di_minus == 0:
            dx = 0
        else:
            dx = (abs(di_plus - di_minus) / (di_plus + di_minus)) * 100
        
        # Store DX values for ADX calculation
        dx_values = self.state.setdefault("dx_values", deque(maxlen=period))
        dx_values.append(dx)
        
        # Calculate ADX
        if len(dx_values) < period:
            adx = None
        else:
            adx = sum(dx_values) / len(dx_values)
        
        return {
            "adx-out": Decimal(str(adx)) if adx is not None else None,
            "di-plus-out": Decimal(str(di_plus)),
            "di-minus-out": Decimal(str(di_minus))
        }


@register_node("stochasticNode")
class StochasticNode(Node):
    inputs = ("high-in", "low-in", "close-in")
    outputs = ("k-out", "d-out")
    
    def compute(self, high_in=None, low_in=None, close_in=None, **inputs) -> Dict[str, Any]:
        if any(x is None for x in [high_in, low_in, close_in]):
            return {"k-out": None, "d-out": None}
        
        k_period = int(self.data.get("kPeriod", 14))
        d_period = int(self.data.get("dPeriod", 3))
        
        # Store OHLC data
        highs = self.state.setdefault("highs", deque(maxlen=k_period))
        lows = self.state.setdefault("lows", deque(maxlen=k_period))
        closes = self.state.setdefault("closes", deque(maxlen=k_period))
        
        highs.append(float(high_in))
        lows.append(float(low_in))
        closes.append(float(close_in))
        
        if len(closes) < k_period:
            return {"k-out": None, "d-out": None}
        
        # Calculate %K
        highest_high = max(highs)
        lowest_low = min(lows)
        current_close = closes[-1]
        
        if highest_high == lowest_low:
            k_value = 50  # Default when no range
        else:
            k_value = ((current_close - lowest_low) / (highest_high - lowest_low)) * 100
        
        # Store %K values for %D calculation
        k_values = self.state.setdefault("k_values", deque(maxlen=d_period))
        k_values.append(k_value)
        
        # Calculate %D (SMA of %K)
        if len(k_values) < d_period:
            d_value = None
        else:
            d_value = sum(k_values) / len(k_values)
        
        return {
            "k-out": Decimal(str(k_value)),
            "d-out": Decimal(str(d_value)) if d_value is not None else None
        }


# Logic Nodes
@register_node("compareNode")
class CompareNode(Node):
    inputs = ("value1-in", "value2-in")
    outputs = ("result-out",)
    
    def compute(self, value1_in=None, value2_in=None, **inputs) -> Dict[str, Any]:
        logger.debug("⚖️ CompareNode computing", 
                   node_id=self.id,
                   value1_in=str(value1_in),
                   value2_in=str(value2_in),
                   inputs_received=list(inputs.keys()))
        
        if value1_in is None or value2_in is None:
            logger.warning("⚠️ CompareNode received None inputs", 
                         node_id=self.id,
                         value1_in=value1_in,
                         value2_in=value2_in)
            return {"result-out": False}
        
        operator = self.data.get("operator", "greater_than")
        logger.debug("⚖️ CompareNode configuration", 
                   node_id=self.id,
                   operator=operator,
                   node_data=self.data)
        
        try:
            val1 = float(value1_in)
            val2 = float(value2_in)
            
            logger.debug("⚖️ CompareNode values converted", 
                       node_id=self.id,
                       val1=val1,
                       val2=val2,
                       operator=operator)
            
            if operator == "greater_than":
                result = val1 > val2
            elif operator == "less_than":
                result = val1 < val2
            elif operator == "equal":
                result = abs(val1 - val2) < 1e-8
            elif operator == "greater_equal":
                result = val1 >= val2
            elif operator == "less_equal":
                result = val1 <= val2
            else:
                logger.warning("⚠️ Unknown operator", 
                             node_id=self.id,
                             operator=operator)
                result = False
            
            logger.debug("✅ CompareNode result", 
                       node_id=self.id,
                       val1=val1,
                       operator=operator,
                       val2=val2,
                       result=result,
                       comparison=f"{val1} {operator} {val2} = {result}")
            
            return {"result-out": result}
        except (ValueError, TypeError) as e:
            logger.error("❌ CompareNode conversion error", 
                        node_id=self.id,
                        value1_in=value1_in,
                        value2_in=value2_in,
                        error=str(e))
            return {"result-out": False}


@register_node("andNode")
class AndNode(Node):
    inputs = ("input1-in", "input2-in")
    outputs = ("result-out",)
    
    def compute(self, input1_in=None, input2_in=None, **inputs) -> Dict[str, Any]:
        result = bool(input1_in) and bool(input2_in)
        return {"result-out": result}


@register_node("orNode")
class OrNode(Node):
    inputs = ("input1-in", "input2-in")
    outputs = ("result-out",)
    
    def compute(self, input1_in=None, input2_in=None, **inputs) -> Dict[str, Any]:
        result = bool(input1_in) or bool(input2_in)
        return {"result-out": result}


@register_node("notNode")
class NotNode(Node):
    inputs = ("input-in",)
    outputs = ("result-out",)
    
    def compute(self, input_in=None, **inputs) -> Dict[str, Any]:
        result = not bool(input_in)
        return {"result-out": result}


# Additional Indicator Nodes
@register_node("macdNode")
class MACDNode(Node):
    inputs = ("price-in",)
    outputs = ("macd-out", "signal-out", "histogram-out")
    
    def compute(self, price_in=None, **inputs) -> Dict[str, Any]:
        if price_in is None:
            return {"macd-out": None, "signal-out": None, "histogram-out": None}
        
        fast_period = int(self.data.get("fastPeriod", 12))
        slow_period = int(self.data.get("slowPeriod", 26))
        signal_period = int(self.data.get("signalPeriod", 9))
        
        # Store price history
        prices = self.state.setdefault("prices", deque(maxlen=slow_period * 3))
        prices.append(float(price_in))
        
        if len(prices) < slow_period:
            return {"macd-out": None, "signal-out": None, "histogram-out": None}
        
        # Calculate EMAs
        fast_ema = self._calculate_ema(prices, fast_period, self.state.get("fast_ema"))
        slow_ema = self._calculate_ema(prices, slow_period, self.state.get("slow_ema"))
        
        self.state["fast_ema"] = fast_ema
        self.state["slow_ema"] = slow_ema
        
        # MACD line
        macd = fast_ema - slow_ema
        
        # Store MACD history for signal calculation
        macd_history = self.state.setdefault("macd_history", deque(maxlen=signal_period * 2))
        macd_history.append(macd)
        
        # Signal line (EMA of MACD)
        if len(macd_history) >= signal_period:
            signal = self._calculate_ema(macd_history, signal_period, self.state.get("signal_ema"))
            self.state["signal_ema"] = signal
            histogram = macd - signal
        else:
            signal = None
            histogram = None
        
        return {
            "macd-out": Decimal(str(macd)),
            "signal-out": Decimal(str(signal)) if signal else None,
            "histogram-out": Decimal(str(histogram)) if histogram else None
        }
    
    def _calculate_ema(self, values, period, prev_ema=None):
        """Calculate EMA with previous value"""
        if not values:
            return 0
        
        alpha = 2.0 / (period + 1)
        current = values[-1]
        
        if prev_ema is None:
            # Start with SMA
            if len(values) >= period:
                return sum(list(values)[-period:]) / period
            else:
                return sum(values) / len(values)
        
        return alpha * current + (1 - alpha) * prev_ema


@register_node("bollingerBandsNode")
class BollingerBandsNode(Node):
    inputs = ("price-in",)
    outputs = ("middle-out", "upper-out", "lower-out")
    
    def compute(self, price_in=None, **inputs) -> Dict[str, Any]:
        if price_in is None:
            return {"middle-out": None, "upper-out": None, "lower-out": None}
        
        period = int(self.data.get("period", 20))
        std_dev = float(self.data.get("deviation", 2))
        
        prices = self.state.setdefault("prices", deque(maxlen=period))
        prices.append(float(price_in))
        
        if len(prices) < period:
            return {"middle-out": None, "upper-out": None, "lower-out": None}
        
        # Calculate SMA (middle band)
        middle = sum(prices) / len(prices)
        
        # Calculate standard deviation
        variance = sum((p - middle) ** 2 for p in prices) / len(prices)
        std = variance ** 0.5
        
        # Calculate bands
        upper = middle + (std_dev * std)
        lower = middle - (std_dev * std)
        
        return {
            "middle-out": Decimal(str(middle)),
            "upper-out": Decimal(str(upper)),
            "lower-out": Decimal(str(lower))
        }


@register_node("crossoverNode")
class CrossoverNode(Node):
    inputs = ("fast-in", "slow-in")
    outputs = ("cross-out",)
    
    def compute(self, fast_in=None, slow_in=None, **inputs) -> Dict[str, Any]:
        if fast_in is None or slow_in is None:
            return {"cross-out": False}
        
        prev_fast = self.state.get("prev_fast")
        prev_slow = self.state.get("prev_slow")
        
        cross = False
        if prev_fast is not None and prev_slow is not None:
            cross_type = self.data.get("crossType", "above")
            
            if cross_type == "above":
                # Fast line crosses above slow line
                cross = prev_fast <= prev_slow and float(fast_in) > float(slow_in)
            else:  # "below"
                # Fast line crosses below slow line
                cross = prev_fast >= prev_slow and float(fast_in) < float(slow_in)
        
        # Update state
        self.state["prev_fast"] = float(fast_in)
        self.state["prev_slow"] = float(slow_in)
        
        return {"cross-out": cross}


@register_node("thresholdNode")
class ThresholdNode(Node):
    inputs = ("value-in",)
    outputs = ("above-out", "below-out")
    
    def compute(self, value_in=None, **inputs) -> Dict[str, Any]:
        if value_in is None:
            return {"above-out": False, "below-out": False}
        
        threshold = float(self.data.get("threshold", 50))
        value = float(value_in)
        
        return {
            "above-out": value > threshold,
            "below-out": value < threshold
        }


@register_node("divergenceNode")
class DivergenceNode(Node):
    inputs = ("price-in", "indicator-in")
    outputs = ("divergence-out",)
    
    def compute(self, price_in=None, indicator_in=None, **inputs) -> Dict[str, Any]:
        if price_in is None or indicator_in is None:
            return {"divergence-out": False}
        
        period = int(self.data.get("period", 5))
        
        prices = self.state.setdefault("prices", deque(maxlen=period))
        indicators = self.state.setdefault("indicators", deque(maxlen=period))
        
        prices.append(float(price_in))
        indicators.append(float(indicator_in))
        
        if len(prices) < period:
            return {"divergence-out": False}
        
        # Simple divergence detection: price going up while indicator going down (or vice versa)
        price_trend = prices[-1] - prices[0]
        indicator_trend = indicators[-1] - indicators[0]
        
        # Bullish divergence: price down, indicator up
        # Bearish divergence: price up, indicator down
        divergence = (price_trend * indicator_trend) < 0 and abs(price_trend) > 0.01
        
        return {"divergence-out": divergence}


@register_node("patternNode")
class PatternNode(Node):
    inputs = ("price-in",)
    outputs = ("pattern-out",)
    
    def compute(self, price_in=None, **inputs) -> Dict[str, Any]:
        if price_in is None:
            return {"pattern-out": False}
        
        pattern_type = self.data.get("patternType", "double_top")
        lookback = int(self.data.get("lookback", 10))
        
        prices = self.state.setdefault("prices", deque(maxlen=lookback * 2))
        prices.append(float(price_in))
        
        if len(prices) < lookback:
            return {"pattern-out": False}
        
        # Simple pattern detection (placeholder)
        if pattern_type == "double_top":
            # Look for two peaks with similar heights
            recent_prices = list(prices)[-lookback:]
            max_price = max(recent_prices)
            peaks = [i for i, p in enumerate(recent_prices) if p >= max_price * 0.98]
            pattern_detected = len(peaks) >= 2
        else:
            pattern_detected = False
        
        return {"pattern-out": pattern_detected}


# Enhanced Action Nodes
@register_node("buyNode")
class BuyNode(Node):
    inputs = ("trigger-in",)
    outputs = ("signal-out",)
    
    def compute(self, trigger_in=None, **inputs) -> Dict[str, Any]:
        logger.debug("🟢 BuyNode computing", 
                   node_id=self.id,
                   trigger_in=trigger_in,
                   inputs_received=list(inputs.keys()),
                   node_data=self.data)
        
        if trigger_in:
            quantity = self.data.get("quantity", 100)
            order_type = self.data.get("orderType", "market")
            
            signal = {
                "action": "BUY",
                "quantity": quantity,
                "order_type": order_type
            }
            
            logger.debug("🎯 BuyNode generating BUY signal", 
                       node_id=self.id,
                       signal=signal,
                       trigger_value=trigger_in)
            
            return {"signal-out": signal}
        
        logger.debug("⏸️ BuyNode not triggered", 
                   node_id=self.id,
                   trigger_in=trigger_in)
        return {"signal-out": None}


@register_node("sellNode")
class SellNode(Node):
    inputs = ("trigger-in",)
    outputs = ("signal-out",)
    
    def compute(self, trigger_in=None, **inputs) -> Dict[str, Any]:
        logger.debug("🔴 SellNode computing", 
                   node_id=self.id,
                   trigger_in=trigger_in,
                   inputs_received=list(inputs.keys()),
                   node_data=self.data)
        
        if trigger_in:
            quantity = self.data.get("quantity", 100)
            order_type = self.data.get("orderType", "market")
            
            signal = {
                "action": "SELL", 
                "quantity": quantity,
                "order_type": order_type
            }
            
            logger.debug("🎯 SellNode generating SELL signal", 
                       node_id=self.id,
                       signal=signal,
                       trigger_value=trigger_in)
            
            return {"signal-out": signal}
        
        logger.debug("⏸️ SellNode not triggered", 
                   node_id=self.id,
                   trigger_in=trigger_in)
        return {"signal-out": None}


@register_node("holdNode")
class HoldNode(Node):
    inputs = ("trigger-in", "condition-in")
    outputs = ("hold-out",)
    
    def compute(self, trigger_in=None, condition_in=None, **inputs) -> Dict[str, Any]:
        hold_type = self.data.get("holdType", "indefinite")
        
        # Start holding if triggered
        if trigger_in:
            self.state["active"] = True
            if hold_type == "duration":
                duration = self.data.get("duration", 1)
                # For now, use simple counter - in real implementation would use timestamps
                self.state["hold_counter"] = 0
                self.state["hold_duration"] = duration
        
        # Check if still holding
        is_holding = False
        if self.state.get("active"):
            if hold_type == "indefinite":
                is_holding = True
            elif hold_type == "duration":
                counter = self.state.get("hold_counter", 0)
                duration = self.state.get("hold_duration", 1)
                is_holding = counter < duration
                self.state["hold_counter"] = counter + 1
                if counter >= duration:
                    self.state["active"] = False
            elif hold_type == "condition":
                # Hold until condition becomes true
                is_holding = not bool(condition_in)
                if condition_in:
                    self.state["active"] = False
        
        return {"hold-out": is_holding}


# Risk Management Nodes
@register_node("stopLossNode")
class StopLossNode(Node):
    inputs = ("trigger-in", "price-in")
    outputs = ("stop-triggered",)
    
    def compute(self, trigger_in=None, price_in=None, **inputs) -> Dict[str, Any]:
        if trigger_in and price_in is not None:
            # Arm the stop loss
            self.state["armed"] = True
            self.state["entry_price"] = float(price_in)
            self.state["triggered"] = False
        
        if not self.state.get("armed") or price_in is None:
            return {"stop-triggered": False}
        
        if self.state.get("triggered"):
            return {"stop-triggered": True}
        
        entry_price = self.state["entry_price"]
        current_price = float(price_in)
        stop_type = self.data.get("stopType", "fixed_percent")
        stop_value = self.data.get("stopValue", 5)
        
        triggered = False
        
        if stop_type == "fixed_percent":
            loss_percent = ((entry_price - current_price) / entry_price) * 100
            triggered = loss_percent >= stop_value
        elif stop_type == "fixed_amount":
            loss_amount = entry_price - current_price
            triggered = loss_amount >= stop_value
        elif stop_type == "trailing_percent":
            # Track highest price since entry
            highest = self.state.get("highest_price", entry_price)
            if current_price > highest:
                highest = current_price
                self.state["highest_price"] = highest
            
            trailing_stop = highest * (1 - stop_value / 100)
            triggered = current_price <= trailing_stop
        
        if triggered:
            self.state["triggered"] = True
        
        return {"stop-triggered": triggered}


@register_node("takeProfitNode")
class TakeProfitNode(Node):
    inputs = ("trigger-in", "price-in")
    outputs = ("profit-triggered",)
    
    def compute(self, trigger_in=None, price_in=None, **inputs) -> Dict[str, Any]:
        if trigger_in and price_in is not None:
            # Arm the take profit
            self.state["armed"] = True
            self.state["entry_price"] = float(price_in)
            self.state["triggered"] = False
        
        if not self.state.get("armed") or price_in is None:
            return {"profit-triggered": False}
        
        if self.state.get("triggered"):
            return {"profit-triggered": True}
        
        entry_price = self.state["entry_price"]
        current_price = float(price_in)
        profit_type = self.data.get("profitType", "fixed_percent")
        profit_value = self.data.get("profitValue", 10)
        
        triggered = False
        
        if profit_type == "fixed_percent":
            profit_percent = ((current_price - entry_price) / entry_price) * 100
            triggered = profit_percent >= profit_value
        elif profit_type == "fixed_amount":
            profit_amount = current_price - entry_price
            triggered = profit_amount >= profit_value
        
        if triggered:
            self.state["triggered"] = True
        
        return {"profit-triggered": triggered}


@register_node("positionSizeNode")
class PositionSizeNode(Node):
    inputs = ("trigger-in", "price-in")
    outputs = ("size-out",)
    
    def compute(self, trigger_in=None, price_in=None, **inputs) -> Dict[str, Any]:
        if not trigger_in or price_in is None:
            return {"size-out": 0}
        
        size_type = self.data.get("sizeType", "fixed")
        size_value = self.data.get("sizeValue", 100)
        
        if size_type == "fixed":
            position_size = size_value
        elif size_type == "percent_portfolio":
            # This would normally get portfolio value from context
            portfolio_value = float(self.data.get("portfolioValue", 10000))
            position_size = (portfolio_value * size_value / 100) / float(price_in)
        elif size_type == "risk_based":
            # Risk-based sizing (simplified)
            risk_amount = float(self.data.get("riskAmount", 100))
            stop_loss_pct = float(self.data.get("stopLossPct", 2))
            position_size = risk_amount / (float(price_in) * stop_loss_pct / 100)
        else:
            position_size = size_value
        
        return {"size-out": Decimal(str(max(0, position_size)))}


@register_node("labelNode")
class LabelNode(Node):
    inputs = ()
    outputs = ("label-out",)
    
    def compute(self, **inputs) -> Dict[str, Any]:
        # Label node is for UI organization only, passes through a constant value
        label_text = self.data.get("labelText", "Label")
        label_value = self.data.get("labelValue", 1)
        
        return {"label-out": Decimal(str(label_value))}


def get_available_nodes() -> Dict[str, Dict[str, Any]]:
    """Get all available node types with their metadata."""
    nodes_info = {}
    
    for node_type, node_class in NODE_REGISTRY.items():
        nodes_info[node_type] = {
            "name": node_type,
            "class_name": node_class.__name__,
            "inputs": list(node_class.inputs),
            "outputs": list(node_class.outputs),
            "category": _get_node_category(node_type)
        }
    
    return nodes_info

def _get_node_category(node_type: str) -> str:
    """Categorize nodes for UI organization."""
    if node_type in ["priceNode", "volumeNode", "timeNode", "constantNode"]:
        return "data"
    elif node_type in ["smaNode", "emaNode", "rsiNode", "macdNode", "bollingerBandsNode", 
                       "atrNode", "adxNode", "stochasticNode"]:
        return "indicators"
    elif node_type in ["compareNode", "andNode", "orNode", "notNode", "crossoverNode"]:
        return "logic"
    elif node_type in ["buyNode", "sellNode", "holdNode"]:
        return "actions"
    elif node_type in ["stopLossNode", "takeProfitNode"]:
        return "risk_management"
    elif node_type in ["labelNode"]:
        return "other"
    else:
        return "other"
