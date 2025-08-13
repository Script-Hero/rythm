import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface SessionFiltersProps {
  searchTerm: string;
  onSearchChange: (search: string) => void;
  statusFilter: 'ALL' | 'RUNNING' | 'PAUSED' | 'STOPPED';
  onStatusFilterChange: (status: 'ALL' | 'RUNNING' | 'PAUSED' | 'STOPPED') => void;
}

export const SessionFilters: React.FC<SessionFiltersProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}) => {
  const statusOptions: Array<'ALL' | 'RUNNING' | 'PAUSED' | 'STOPPED'> = [
    'ALL', 'RUNNING', 'PAUSED', 'STOPPED'
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search sessions..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <div className="flex gap-2">
        {statusOptions.map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => onStatusFilterChange(status)}
          >
            {status}
          </Button>
        ))}
      </div>
    </div>
  );
};