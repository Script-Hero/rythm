import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

const SearchableSelect = ({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Search...", 
  loading = false,
  onSearch,
  searchDelay = 300,
  disabled = false,
  className = "",
  maxHeight = "200px",
  showClearButton = true,
  renderOption = null,
  renderValue = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Filter options based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredOptions(options);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = options.filter(option => {
      const searchText = typeof option === 'string' ? option : 
                        (option.label || option.name || option.display || option.symbol || '');
      return searchText.toLowerCase().includes(query);
    });
    
    setFilteredOptions(filtered);
    setHighlightedIndex(-1);
  }, [searchQuery, options]);
  
  // Handle external search with debouncing
  useEffect(() => {
    if (!onSearch || !searchQuery.trim()) return;
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      onSearch(searchQuery);
    }, searchDelay);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, onSearch, searchDelay]);
  
  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);
  
  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
        break;
    }
  };
  
  const handleSelect = (option) => {
    const optionValue = typeof option === 'string' ? option : 
                       (option.value || option.code || option.symbol || option);
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  };
  
  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };
  
  const getDisplayValue = () => {
    if (!value) return '';
    
    if (renderValue) {
      return renderValue(value);
    }
    
    // Find the selected option
    const selectedOption = options.find(option => {
      const optionValue = typeof option === 'string' ? option : 
                         (option.value || option.code || option.symbol || option);
      return optionValue === value;
    });
    
    if (selectedOption) {
      return typeof selectedOption === 'string' ? selectedOption : 
             (selectedOption.label || selectedOption.display || selectedOption.name || value);
    }
    
    return value;
  };
  
  const defaultRenderOption = (option, index) => {
    const isString = typeof option === 'string';
    const optionValue = isString ? option : (option.value || option.code || option.symbol || option);
    const optionLabel = isString ? option : (option.label || option.display || option.name || optionValue);
    const isSelected = optionValue === value;
    const isHighlighted = index === highlightedIndex;
    
    return (
      <div
        key={optionValue}
        className={`px-3 py-2 cursor-pointer text-sm ${
          isHighlighted ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
        } ${isSelected ? 'bg-blue-100 font-medium' : ''} hover:bg-gray-50`}
        onClick={() => handleSelect(option)}
        onMouseEnter={() => setHighlightedIndex(index)}
      >
        <div className="flex items-center justify-between">
          <span>{optionLabel}</span>
          {isSelected && <Check className="h-4 w-4 text-blue-600" />}
        </div>
        {!isString && option.description && (
          <div className="text-xs text-gray-500 mt-1">{option.description}</div>
        )}
      </div>
    );
  };
  
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Main select button */}
      <button
        type="button"
        className={`w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          disabled ? 'bg-gray-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      >
        <div className="flex items-center justify-between">
          <span className={`block truncate ${!value ? 'text-gray-500' : 'text-gray-900'}`}>
            {value ? getDisplayValue() : placeholder}
          </span>
          <div className="flex items-center space-x-1">
            {value && showClearButton && !disabled && (
              <X 
                className="h-4 w-4 text-gray-400 hover:text-gray-600" 
                onClick={handleClear}
              />
            )}
            <ChevronDown 
              className={`h-4 w-4 text-gray-400 transition-transform ${
                isOpen ? 'transform rotate-180' : ''
              }`} 
            />
          </div>
        </div>
      </button>
      
      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>
          
          {/* Options list */}
          <div className="max-h-60 overflow-auto" style={{ maxHeight }}>
            {loading ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                Loading...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                {searchQuery ? 'No results found' : 'No options available'}
              </div>
            ) : (
              filteredOptions.map((option, index) => 
                renderOption ? renderOption(option, index, {
                  isSelected: (typeof option === 'string' ? option : (option.value || option.code || option.symbol)) === value,
                  isHighlighted: index === highlightedIndex,
                  onSelect: () => handleSelect(option),
                  onHighlight: () => setHighlightedIndex(index)
                }) : defaultRenderOption(option, index)
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;