import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Plus, 
  Edit, 
  Copy, 
  Trash2, 
  Calendar, 
  Tag, 
  BarChart3,
  Settings,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import type { Strategy } from '../../types/strategy';
import { STRATEGY_CATEGORIES } from '../../types/strategy';
import { StrategyBrowserDialog } from '../../components/strategies/StrategyBrowserDialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type SortField = 'name' | 'updated_at' | 'created_at' | 'category';
type SortDirection = 'asc' | 'desc';

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [filteredStrategies, setFilteredStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [includeTemplates, setIncludeTemplates] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [stats, setStats] = useState({
    total_strategies: 0,
    custom_strategies: 0,
    templates: 0,
    categories: [],
  });

  const navigate = useNavigate();

  useEffect(() => {
    loadStrategies();
    loadStats();
  }, [categoryFilter, includeTemplates]);

  useEffect(() => {
    filterStrategies();
  }, [strategies, searchQuery, sortField, sortDirection]);

  const loadStrategies = async () => {
    setLoading(true);
    try {
      const response = await apiService.listStrategies({
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        include_templates: includeTemplates,
      });
      setStrategies(response.strategies);
    } catch (error) {
      toast.error('Failed to load strategies');
      console.error('Failed to load strategies:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await apiService.getStrategyStats();
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const filterStrategies = () => {
    let filtered = strategies;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (strategy) =>
          strategy.name.toLowerCase().includes(query) ||
          strategy.description.toLowerCase().includes(query) ||
          strategy.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    filtered = filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'category':
          aVal = a.category;
          bVal = b.category;
          break;
        case 'created_at':
          aVal = new Date(a.created_at);
          bVal = new Date(b.created_at);
          break;
        case 'updated_at':
        default:
          aVal = new Date(a.updated_at);
          bVal = new Date(b.updated_at);
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredStrategies(filtered);
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (field !== sortField) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />;
  };

  const handleCreateNew = () => {
    navigate('/builder');
  };

  const handleEditStrategy = (strategy: Strategy) => {
    navigate(`/builder?load=${strategy.id}`);
  };

  const handleBacktestStrategy = (strategy: Strategy) => {
    navigate(`/backtest?strategy=${strategy.id}`);
  };

  const handleDuplicateStrategy = async (strategy: Strategy) => {
    try {
      const newName = `${strategy.name} (Copy)`;
      await apiService.duplicateStrategy(strategy.id, newName);
      toast.success('Strategy duplicated successfully');
      loadStrategies();
    } catch (error) {
      toast.error('Failed to duplicate strategy');
    }
  };

  const handleDeleteStrategy = async (strategy: Strategy) => {
    if (window.confirm(`Are you sure you want to delete "${strategy.name}"?`)) {
      try {
        await apiService.deleteStrategy(strategy.id);
        toast.success('Strategy deleted successfully');
        loadStrategies();
        loadStats();
      } catch (error) {
        toast.error('Failed to delete strategy');
      }
    }
  };

  const formatDate = (dateString: string) => {
    try {
      // Parse as UTC and format relative to local time
      const date = new Date(dateString + (dateString.includes('Z') ? '' : 'Z'));
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Strategy Management</h1>
            <p className="text-gray-600 mt-1">Create, edit, and manage your trading strategies</p>
          </div>
          <Button onClick={handleCreateNew} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
            <Plus className="h-4 w-4 mr-2" />
            Create New Strategy
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Strategies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_strategies}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Custom Strategies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.custom_strategies}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.templates}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.categories.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filter Strategies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search strategies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {STRATEGY_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Sort By</label>
                <Select value={sortField} onValueChange={(value: SortField) => setSortField(value)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated_at">Last Updated</SelectItem>
                    <SelectItem value="created_at">Created Date</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                className="mb-0"
              >
                {getSortIcon(sortField)}
              </Button>
              <Button
                variant={includeTemplates ? "default" : "outline"}
                onClick={() => setIncludeTemplates(!includeTemplates)}
              >
                Include Templates
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Strategy List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Strategies ({filteredStrategies.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading strategies...
              </div>
            ) : filteredStrategies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No strategies found matching your search.' : 'No strategies found.'}
                {!searchQuery && (
                  <div className="mt-4">
                    <Button onClick={handleCreateNew} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Strategy
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {filteredStrategies.map((strategy) => (
                    <Card key={strategy.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{strategy.name}</CardTitle>
                              {strategy.is_template && (
                                <Badge variant="secondary">Template</Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {strategy.category}
                              </Badge>
                            </div>
                            <CardDescription>
                              {strategy.description || 'No description provided'}
                            </CardDescription>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(strategy.updated_at)}
                              </div>
                              <span>v{strategy.version}</span>
                              {strategy.tags.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Tag className="h-3 w-3" />
                                  <div className="flex gap-1">
                                    {strategy.tags.slice(0, 3).map((tag) => (
                                      <Badge key={tag} variant="secondary" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                    {strategy.tags.length > 3 && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{strategy.tags.length - 3}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleBacktestStrategy(strategy)}
                            >
                              <BarChart3 className="h-4 w-4 mr-1" />
                              Backtest
                            </Button>
                            {!strategy.is_template && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditStrategy(strategy)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDuplicateStrategy(strategy)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            {!strategy.is_template && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteStrategy(strategy)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}