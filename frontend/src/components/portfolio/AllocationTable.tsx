import React, { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  ShoppingCart,
  Wallet,
  Eye,
  TableIcon
} from "lucide-react"

export interface PositionData {
  id: string
  symbol: string
  name: string
  account: string
  quantity: number
  price: number
  value: number
  weight: number
  dayChange: number
  dayChangePercent: number
  totalReturn: number
  totalReturnPercent: number
  lastUpdated: Date
}

interface AllocationTableProps {
  data?: PositionData[]
  onBuy?: (symbol: string) => void
  onSell?: (symbol: string) => void
  onViewDetails?: (position: PositionData) => void
}

type SortField = keyof PositionData
type SortDirection = 'asc' | 'desc'

// Mock data for development
const mockPositions: PositionData[] = [
  {
    id: '1',
    symbol: 'BTC',
    name: 'Bitcoin',
    account: 'Coinbase',
    quantity: 0.5,
    price: 45000,
    value: 22500,
    weight: 28.5,
    dayChange: 720,
    dayChangePercent: 3.2,
    totalReturn: 2500,
    totalReturnPercent: 12.5,
    lastUpdated: new Date()
  },
  {
    id: '2',
    symbol: 'ETH',
    name: 'Ethereum',
    account: 'Coinbase',
    quantity: 10,
    price: 3200,
    value: 32000,
    weight: 20.3,
    dayChange: -480,
    dayChangePercent: -1.5,
    totalReturn: -800,
    totalReturnPercent: -2.4,
    lastUpdated: new Date()
  },
  {
    id: '3',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    account: 'E*TRADE',
    quantity: 150,
    price: 185.50,
    value: 27825,
    weight: 15.8,
    dayChange: 222.60,
    dayChangePercent: 0.8,
    totalReturn: 1825,
    totalReturnPercent: 7.0,
    lastUpdated: new Date()
  },
  {
    id: '4',
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    account: 'E*TRADE',
    quantity: 50,
    price: 245.20,
    value: 12260,
    weight: 11.4,
    dayChange: 257.34,
    dayChangePercent: 2.1,
    totalReturn: -740,
    totalReturnPercent: -5.7,
    lastUpdated: new Date()
  },
  {
    id: '5',
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    account: 'Paper Trading',
    quantity: 25,
    price: 520.30,
    value: 13007.50,
    weight: 9.2,
    dayChange: 390.23,
    dayChangePercent: 3.1,
    totalReturn: 2007.50,
    totalReturnPercent: 18.2,
    lastUpdated: new Date()
  }
]

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const formatPercentage = (value: number) => {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

const formatQuantity = (quantity: number) => {
  return quantity.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  })
}

export function AllocationTable({
  data = mockPositions,
  onBuy,
  onSell,
  onViewDetails
}: AllocationTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('value')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (field !== sortField) {
      return <ArrowUpDown className="h-4 w-4" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />
  }

  const filteredAndSortedData = React.useMemo(() => {
    let filtered = data.filter(position =>
      position.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      position.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      position.account.toLowerCase().includes(searchQuery.toLowerCase())
    )

    filtered.sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }
      
      return 0
    })

    return filtered
  }, [data, searchQuery, sortField, sortDirection])

  const totalValue = data.reduce((sum, position) => sum + position.value, 0)

  return (
    <Card className="border-0 bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm">
              <TableIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Portfolio Positions</CardTitle>
              <p className="text-sm text-gray-500">
                {filteredAndSortedData.length} positions • Total value: {formatCurrency(totalValue)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search positions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-100">
                <TableHead className="w-24">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('symbol')}
                    className="h-8 p-2 font-medium"
                  >
                    Symbol
                    {getSortIcon('symbol')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('name')}
                    className="h-8 p-2 font-medium"
                  >
                    Asset
                    {getSortIcon('name')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('account')}
                    className="h-8 p-2 font-medium"
                  >
                    Account
                    {getSortIcon('account')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('quantity')}
                    className="h-8 p-2 font-medium"
                  >
                    Quantity
                    {getSortIcon('quantity')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('price')}
                    className="h-8 p-2 font-medium"
                  >
                    Price
                    {getSortIcon('price')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('value')}
                    className="h-8 p-2 font-medium"
                  >
                    Value
                    {getSortIcon('value')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('weight')}
                    className="h-8 p-2 font-medium"
                  >
                    Weight
                    {getSortIcon('weight')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('dayChangePercent')}
                    className="h-8 p-2 font-medium"
                  >
                    Day Change
                    {getSortIcon('dayChangePercent')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('totalReturnPercent')}
                    className="h-8 p-2 font-medium"
                  >
                    Total Return
                    {getSortIcon('totalReturnPercent')}
                  </Button>
                </TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.map((position) => (
                <TableRow
                  key={position.id}
                  className="border-gray-50 hover:bg-gray-50/50 transition-colors"
                >
                  <TableCell className="font-mono font-medium">
                    {position.symbol}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-gray-900">{position.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {position.account}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatQuantity(position.quantity)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(position.price)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(position.value)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {position.weight.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-1">
                      {position.dayChangePercent >= 0 ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <div className="text-right">
                        <p className={`font-mono text-sm ${
                          position.dayChangePercent >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatPercentage(position.dayChangePercent)}
                        </p>
                        <p className={`font-mono text-xs ${
                          position.dayChange >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {formatCurrency(Math.abs(position.dayChange))}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-1">
                      {position.totalReturnPercent >= 0 ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <div className="text-right">
                        <p className={`font-mono text-sm ${
                          position.totalReturnPercent >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatPercentage(position.totalReturnPercent)}
                        </p>
                        <p className={`font-mono text-xs ${
                          position.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {formatCurrency(Math.abs(position.totalReturn))}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewDetails?.(position)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onBuy?.(position.symbol)}>
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          Buy More
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onSell?.(position.symbol)}>
                          <Wallet className="mr-2 h-4 w-4" />
                          Sell Position
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredAndSortedData.length === 0 && (
          <div className="text-center py-12">
            <TableIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No positions found</h3>
            <p className="text-gray-500">
              {searchQuery ? 'Try adjusting your search terms' : 'Start trading to see your positions here'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}