import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import './Select.css';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string> {
  id?: string;
  name?: string;
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean | string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'subtle' | 'status';
  searchable?: boolean;
  searchPlaceholder?: string;
  renderValue?: (selectedOption: SelectOption<T> | undefined) => React.ReactNode;
}

export function Select<T extends string = string>({
  id: customId,
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  options,
  placeholder = 'Select an option…',
  disabled = false,
  required = false,
  error = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  size = 'md',
  variant = 'default',
  searchable = false,
  searchPlaceholder = 'Search…',
  renderValue,
}: SelectProps<T>) {
  const generatedId = useId();
  const selectId = customId || `toranly-select-${generatedId}`;
  const listboxId = `toranly-listbox-${generatedId}`;

  // Controlled vs Uncontrolled state
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState<T | undefined>(
    defaultValue !== undefined ? defaultValue : (options[0]?.value as T | undefined)
  );
  const selectedValue = isControlled ? controlledValue : internalValue;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Active option
  const selectedOption = useMemo(
    () => options.find((o) => o.value === selectedValue),
    [options, selectedValue]
  );

  // Filtered options if searchable
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
  }, [options, searchable, searchQuery]);

  // Determine top vs bottom placement based on viewport space
  const updatePlacement = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // If less than 240px below and more room above, flip to top
    if (spaceBelow < 240 && spaceAbove > spaceBelow) {
      setPlacement('top');
    } else {
      setPlacement('bottom');
    }
  };

  // Open/Close toggle
  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePlacement();
      setSearchQuery('');
      const currentIndex = filteredOptions.findIndex((o) => o.value === selectedValue);
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Handle selection
  const handleSelect = (option: SelectOption<T>) => {
    if (option.disabled) return;
    if (!isControlled) {
      setInternalValue(option.value);
    }
    onChange?.(option.value);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  // Outside click listener
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchable) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, searchable]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && menuRef.current) {
      const highlightedEl = menuRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`
      ) as HTMLElement | null;
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ': {
        // Space in search input should type space, not select
        if (e.key === ' ' && searchable && document.activeElement === searchInputRef.current) {
          return;
        }
        e.preventDefault();
        if (!isOpen) {
          toggleOpen();
        } else if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        if (!isOpen) {
          toggleOpen();
        } else {
          setHighlightedIndex((prev) => {
            let next = prev + 1;
            while (next < filteredOptions.length && filteredOptions[next]?.disabled) {
              next++;
            }
            return next < filteredOptions.length ? next : prev;
          });
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (!isOpen) {
          toggleOpen();
        } else {
          setHighlightedIndex((prev) => {
            let next = prev - 1;
            while (next >= 0 && filteredOptions[next]?.disabled) {
              next--;
            }
            return next >= 0 ? next : prev;
          });
        }
        break;
      }
      case 'Escape': {
        if (isOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(false);
          buttonRef.current?.focus();
        }
        break;
      }
      case 'Tab': {
        if (isOpen) {
          setIsOpen(false);
        }
        break;
      }
      case 'Home': {
        if (isOpen) {
          e.preventDefault();
          setHighlightedIndex(0);
        }
        break;
      }
      case 'End': {
        if (isOpen) {
          e.preventDefault();
          setHighlightedIndex(filteredOptions.length - 1);
        }
        break;
      }
    }
  };

  // Status variant class
  const statusClass =
    variant === 'status' && selectedValue ? `is-status-${selectedValue}` : '';

  return (
    <div
      ref={containerRef}
      className={`toranly-select-root size-${size} variant-${variant} ${statusClass} ${
        isOpen ? 'is-open' : ''
      } ${disabled ? 'is-disabled' : ''} ${error ? 'is-error' : ''} ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden input for form integration */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={selectedValue || ''}
          required={required}
        />
      )}

      {/* Trigger Button */}
      <button
        ref={buttonRef}
        id={selectId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={toggleOpen}
        className={`toranly-select-trigger ${buttonClassName}`}
      >
        <span className="toranly-select-label-wrap">
          {renderValue ? (
            renderValue(selectedOption)
          ) : selectedOption ? (
            <>
              {selectedOption.icon && (
                <span className="toranly-select-item-icon" aria-hidden="true">
                  {selectedOption.icon}
                </span>
              )}
              <span className="toranly-select-label-text">
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span className="toranly-select-item-badge">
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : (
            <span className="toranly-select-placeholder">{placeholder}</span>
          )}
        </span>

        <span className="toranly-select-chevron-wrap" aria-hidden="true">
          <ChevronDown
            size={16}
            strokeWidth={2}
            className={`toranly-select-chevron ${isOpen ? 'is-rotated' : ''}`}
          />
        </span>
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={selectId}
          className={`toranly-select-menu placement-${placement} ${menuClassName}`}
        >
          {/* Optional Search Input */}
          {searchable && (
            <div className="toranly-select-search-box">
              <Search size={14} className="toranly-select-search-icon" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                className="toranly-select-search-input"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label="Filter options"
              />
            </div>
          )}

          {/* Options List */}
          <div className="toranly-select-options-list">
            {filteredOptions.length === 0 ? (
              <div className="toranly-select-empty-msg">No options found</div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === selectedValue;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled}
                    data-index={idx}
                    disabled={opt.disabled}
                    className={`toranly-select-option ${
                      isSelected ? 'is-selected' : ''
                    } ${isHighlighted ? 'is-highlighted' : ''} ${
                      opt.disabled ? 'is-disabled' : ''
                    }`}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    <span className="toranly-select-option-content">
                      {opt.icon && (
                        <span className="toranly-select-option-icon" aria-hidden="true">
                          {opt.icon}
                        </span>
                      )}
                      <span className="toranly-select-option-texts">
                        <span className="toranly-select-option-title">{opt.label}</span>
                        {opt.sublabel && (
                          <span className="toranly-select-option-sublabel">
                            {opt.sublabel}
                          </span>
                        )}
                      </span>
                      {opt.badge && (
                        <span className="toranly-select-option-badge">
                          {opt.badge}
                        </span>
                      )}
                    </span>

                    {isSelected && (
                      <span className="toranly-select-check" aria-hidden="true">
                        <Check size={15} strokeWidth={2.2} />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

