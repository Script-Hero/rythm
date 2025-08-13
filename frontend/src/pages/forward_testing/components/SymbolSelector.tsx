import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, TrendingUp, DollarSign } from 'lucide-react';

interface SymbolSelectorProps {
  selectedSymbol: string;
  availableSymbols: string[];
  loadingSymbols: boolean;
  initialBalance: number;
  onSymbolChange: (symbol: string) => void;
  onBalanceChange: (balance: number) => void;
  disabled?: boolean;
}

export const SymbolSelector = ({
  selectedSymbol,
  availableSymbols,
  loadingSymbols,
  initialBalance,
  onSymbolChange,
  onBalanceChange,
  disabled = false
}: SymbolSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceInput, setBalanceInput] = useState(initialBalance.toString());

  const filteredSymbols = availableSymbols.filter(symbol =>
    symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBalanceSubmit = () => {
    const newBalance = parseFloat(balanceInput);
    if (!isNaN(newBalance) && newBalance > 0) {
      onBalanceChange(newBalance);
    } else {
      setBalanceInput(initialBalance.toString());
    }
  };

  const popularSymbols = ['BTC/USD', 'ETH/USD', 'LTC/USD', 'ADA/USD', 'DOT/USD'];
  const popularAvailable = popularSymbols.filter(symbol => availableSymbols.includes(symbol));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Trading Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Symbol Selection */}
        <div className="space-y-3">
          <Label>Trading Pair</Label>
          
          {/* Popular symbols for quick selection */}
          {popularAvailable.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Popular pairs:</div>
              <div className="flex flex-wrap gap-2">
                {popularAvailable.map(symbol => (
                  <Button
                    key={symbol}
                    variant={selectedSymbol === symbol ? "default" : "outline"}
                    size="sm"
                    onClick={() => onSymbolChange(symbol)}
                    disabled={disabled || loadingSymbols}
                  >
                    {symbol}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Symbol dropdown */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">All available pairs:</div>
            <Select
              value={selectedSymbol}
              onValueChange={onSymbolChange}
              disabled={disabled || loadingSymbols}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingSymbols ? "Loading symbols..." : "Select trading pair"} />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search symbols..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <ScrollArea className="h-48">
                  {filteredSymbols.length > 0 ? (
                    filteredSymbols.map(symbol => (
                      <SelectItem key={symbol} value={symbol}>
                        <div className="flex items-center justify-between w-full">
                          <span>{symbol}</span>
                          {popularSymbols.includes(symbol) && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Popular
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {loadingSymbols ? "Loading..." : "No symbols found"}
                    </div>
                  )}
                </ScrollArea>
              </SelectContent>
            </Select>
          </div>

          {/* Selected symbol display */}
          {selectedSymbol && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedSymbol}</Badge>
                <span className="text-sm text-muted-foreground">
                  Selected for live trading
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Initial Balance */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Initial Balance (USD)
          </Label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              onBlur={handleBalanceSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleBalanceSubmit()}
              placeholder="10000"
              min="100"
              max="1000000"
              step="100"
              disabled={disabled}
            />
            <Button
              variant="outline"
              onClick={handleBalanceSubmit}
              disabled={disabled}
            >
              Set
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            Starting capital for paper trading (minimum: $100)
          </div>
        </div>

        {/* Trading Info */}
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="text-sm">
            <div className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
              🔴 Live Market Data
            </div>
            <div className="text-yellow-700 dark:text-yellow-300">
              This will use real-time market data from live exchanges. 
              All trades are simulated with paper money for safe testing.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};