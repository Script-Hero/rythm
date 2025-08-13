import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Clock, DollarSign } from 'lucide-react';

interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: Date | string | number;
  pnl?: number;
  status: 'OPEN' | 'CLOSED';
}

interface TradeAlertsProps {
  trades: Trade[];
}

export const TradeAlerts = ({ trades }: TradeAlertsProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatTime = (date: Date | string | number) => {
    try {
      if (date instanceof Date) {
        return date.toLocaleString();
      } else if (typeof date === 'number') {
        // Unix timestamp (seconds) - convert to milliseconds
        return new Date(date * 1000).toLocaleString();
      } else if (typeof date === 'string') {
        return new Date(date).toLocaleString();
      } else {
        return 'Invalid Date';
      }
    } catch (error) {
      console.warn('Error formatting timestamp:', date, error);
      return 'Invalid Date';
    }
  };

  // Calculate some statistics
  const totalTrades = trades.length;
  const openTrades = trades.filter(t => t.status === 'OPEN').length;
  const closedTrades = trades.filter(t => t.status === 'CLOSED').length;
  const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winningTrades = trades.filter(t => (t.pnl || 0) > 0).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Trade Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{totalTrades}</div>
                <div className="text-xs text-muted-foreground">Total Trades</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{openTrades}</div>
                <div className="text-xs text-muted-foreground">Open Positions</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{closedTrades}</div>
                <div className="text-xs text-muted-foreground">Closed Trades</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalPnL)}
                </div>
                <div className="text-xs text-muted-foreground">Total P&L</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Win Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trade History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No trades executed yet. Start the forward test to see live trading activity.
                    </TableCell>
                  </TableRow>
                ) : (
                  trades.map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell className="text-sm">
                        {formatTime(trade.timestamp)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {trade.symbol || 'UNKNOWN'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={trade.side === 'BUY' ? 'default' : 'secondary'}
                          className={trade.side === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                        >
                          {trade.side || 'UNKNOWN'}
                        </Badge>
                      </TableCell>
                      <TableCell>{trade.quantity || 0}</TableCell>
                      <TableCell>{formatCurrency(trade.price || 0)}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={trade.status === 'OPEN' ? 'outline' : 'secondary'}
                          className={trade.status === 'OPEN' ? 'border-blue-200 text-blue-800' : ''}
                        >
                          {trade.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {trade.pnl !== undefined && (
                          <span className={trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(trade.pnl)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};