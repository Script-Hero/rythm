import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { apiService } from '../../services/api';
import { STRATEGY_CATEGORIES } from '../../types/strategy';
import { toast } from 'sonner';

interface SaveStrategyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: any[];
  edges: any[];
  existingStrategy?: {
    id: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
  };
  onSaved?: () => void;
  setCurrentStrategyMeta: (newStrategy: any) => void;
  setCurrentStrategyId: (newStrategyId: string) => void;

}

export function SaveStrategyDialog({
  open,
  onOpenChange,
  nodes,
  edges,
  existingStrategy,
  onSaved,
  setCurrentStrategyMeta,
  setCurrentStrategyId,

}: SaveStrategyDialogProps) {
  const [formData, setFormData] = useState({
    name: existingStrategy?.name || '',
    description: existingStrategy?.description || '',
    category: existingStrategy?.category || 'custom',
    tags: existingStrategy?.tags || [],
  });
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);

  const isEditing = !!existingStrategy;

  // Update form data when existingStrategy changes
  useEffect(() => {
    if (existingStrategy) {
      setFormData({
        name: existingStrategy.name || '',
        description: existingStrategy.description || '',
        category: existingStrategy.category || 'custom',
        tags: existingStrategy.tags || [],
      });
    } else {
      // Reset form for new strategies
      setFormData({
        name: '',
        description: '',
        category: 'custom',
        tags: [],
      });
    }
  }, [existingStrategy]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Strategy name is required');
      return;
    }

    if (nodes.length === 0) {
      toast.error('Strategy must contain at least one node');
      return;
    }

    setLoading(true);
    try {
      const saveData = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        tags: formData.tags,
        nodes,
        edges,
        ...(isEditing && { id: existingStrategy.id }),
      };

      let result;
      if (isEditing) {
        result = await apiService.updateStrategy(existingStrategy.id, saveData);
      } else {
        result = await apiService.saveStrategy(saveData);
      }

      toast.success(result.message || `Strategy ${isEditing ? 'updated' : 'saved'} successfully`);
      onOpenChange(false);
      onSaved?.(); // Call the callback to refresh the parent component
      setCurrentStrategyMeta(saveData);
      setCurrentStrategyId(result.id);
      
      
      // Reset form if creating new strategy
      if (!isEditing) {
        setFormData({
          name: '',
          description: '',
          category: 'custom',
          tags: [],
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save strategy');
    } finally {
      setLoading(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Strategy' : 'Save Strategy'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update your strategy details and configuration.'
              : 'Give your strategy a name and description to save it for later use.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Strategy Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter strategy name..."
              className="col-span-3"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your strategy..."
              className="col-span-3"
              rows={3}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {STRATEGY_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag..."
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button type="button" onClick={addTag} variant="outline" size="sm">
                Add
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          
          <div className="text-sm text-muted-foreground">
            Strategy contains {nodes ? nodes.length : 0} nodes and {edges ? edges.length : 0} connections.
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (isEditing ? 'Updating...' : 'Saving...') : (isEditing ? 'Update Strategy' : 'Save Strategy')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}