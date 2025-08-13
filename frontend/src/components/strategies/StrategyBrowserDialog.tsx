import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Calendar, Tag, Copy, Trash2, Edit, Play } from 'lucide-react';
import { apiService } from '../../services/api';
import type { Strategy } from '../../types/strategy';
import { STRATEGY_CATEGORIES } from '../../types/strategy';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { getBasicTemplateList } from '../../pages/build_algorithm/basic-templates';
import { getTemplateList } from '../../pages/build_algorithm/complex-templates';

interface StrategyBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadStrategy?: (strategy: Strategy) => void;
  onEditStrategy?: (strategy: Strategy) => void;
  mode?: 'load' | 'browse';
}

export function StrategyBrowserDialog({
  open,
  onOpenChange,
  onLoadStrategy,
  onEditStrategy,
  mode = 'load',
}: StrategyBrowserDialogProps) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [allStrategies, setAllStrategies] = useState<Strategy[]>([]);
  const [filteredStrategies, setFilteredStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [includeTemplates, setIncludeTemplates] = useState(true);

  // Get template strategies
  const basicTemplates = getBasicTemplateList();
  const complexTemplates = getTemplateList();
  const allTemplates = [...basicTemplates, ...complexTemplates];

  useEffect(() => {
    if (open) {
      loadStrategies();
    }
  }, [open, categoryFilter]);

  useEffect(() => {
    combineAndFilterStrategies();
  }, [strategies, searchQuery, categoryFilter, includeTemplates]);

  const loadStrategies = async () => {
    setLoading(true);
    try {
      // Only get database strategies, not templates
      const response = await apiService.listStrategies({
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        include_templates: false,
      });
      setStrategies(Array.isArray(response.strategies) ? response.strategies : []);
    } catch (error) {
      toast.error('Failed to load strategies');
      console.error('Failed to load strategies:', error);
    } finally {
      setLoading(false);
    }
  };

  const combineAndFilterStrategies = () => {
    let combined = Array.isArray(strategies) ? [...strategies] : [];

    // Add template strategies if includeTemplates is true
    if (includeTemplates) {
      const templateStrategies = allTemplates.map((template) => ({
        id: template.key,
        name: template.name,
        description: template.description,
        category: 'template',
        tags: [],
        version: '1.0',
        is_template: true,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }));
      combined = [...combined, ...templateStrategies];
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      combined = combined.filter((strategy) => 
        strategy.category === categoryFilter || 
        (strategy.is_template && categoryFilter === 'template')
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      combined = combined.filter(
        (strategy) =>
          strategy.name.toLowerCase().includes(query) ||
          strategy.description.toLowerCase().includes(query) ||
          strategy.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    setFilteredStrategies(combined);
  };

  const handleLoadStrategy = (strategy: Strategy) => {
    onLoadStrategy?.(strategy);
    onOpenChange(false);
    toast.success(`Loaded strategy: ${strategy.name}`);
  };

  const handleEditStrategy = (strategy: Strategy) => {
    onEditStrategy?.(strategy);
    onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[600px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'load' ? 'Load Strategy' : 'Browse Strategies'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'load' 
              ? 'Select a strategy to load into the builder.'
              : 'View and manage your saved strategies.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search strategies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
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
            <Button
              variant={includeTemplates ? "default" : "outline"}
              onClick={() => setIncludeTemplates(!includeTemplates)}
              size="sm"
            >
              Templates
            </Button>
          </div>

          {/* Strategy List */}
          <ScrollArea className="h-[400px] pr-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading strategies...
              </div>
            ) : filteredStrategies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No strategies found matching your search.' : 'No strategies found.'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredStrategies.map((strategy) => (
                  <Card key={strategy.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {strategy.name}
                            {strategy.is_template && (
                              <Badge variant="secondary" className="text-xs">Template</Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {strategy.description || 'No description provided'}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1">
                          {mode === 'load' && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleLoadStrategy(strategy)}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Load
                            </Button>
                          )}
                          {onEditStrategy && !strategy.is_template && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditStrategy(strategy)}
                            >
                              <Edit className="h-4 w-4" />
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
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(strategy.updated_at)}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {strategy.category}
                          </Badge>
                          <span>v{strategy.version}</span>
                        </div>
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}