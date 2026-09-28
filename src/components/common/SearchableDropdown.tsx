import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Plus, X, Check } from 'lucide-react';
import { matchesAdvancedSearch, smartCompare } from '../../utils/searchUtils';
import { focusNextFormElement } from '../../utils/formUtils';

export interface SearchableOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
  original?: any;
}

export interface SearchableDropdownProps {
  id?: string;
  value: string;
  onChange: (value: string, selectedOption?: SearchableOption) => void;
  options: SearchableOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  // Inline Add Action (User rule: +Add placed right under Select option)
  addOptionLabel?: string;
  onAddOption?: () => void;
  // Custom text option (e.g. "+ Type Custom Item...")
  customOptionLabel?: string;
  onCustomOption?: () => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  addOptionLabel,
  onAddOption,
  customOptionLabel,
  onCustomOption,
  onFocus,
  onBlur,
  onKeyDown,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 240,
  });

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value || opt.label === value);
  }, [options, value]);

  // Sync display text with selected value when closed
  useEffect(() => {
    if (!isOpen) {
      setSearchText(selectedOption ? selectedOption.label : value || '');
    }
  }, [value, selectedOption, isOpen]);

  // Reposition floating menu
  const updatePosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 240),
      });
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen]);

  // Filter options using Advanced Multi-Token Search (matches 2nd word, 3rd word, any order)
  const filteredOptions = useMemo(() => {
    // Unified ordering: numbers before alphabets, natural numeric-aware within each group
    const sortOpts = (arr: SearchableOption[]) =>
      [...arr].sort((a, b) => smartCompare(a.label, b.label));

    // If search text matches the selected item label exactly, show all options
    if (selectedOption && searchText.trim() === selectedOption.label.trim()) {
      return sortOpts(options);
    }
    const query = searchText.trim();
    if (!query) return sortOpts(options);

    return sortOpts(
      options.filter((opt) => {
        const targetText = `${opt.label} ${opt.subLabel || ''} ${opt.badge || ''}`;
        return matchesAdvancedSearch(targetText, query);
      })
    );
  }, [options, searchText, selectedOption]);

  // Build combined navigation list: [AddOption?, CustomOption?, ...FilteredOptions]
  const navItems = useMemo(() => {
    const list: Array<{ type: 'ADD' | 'CUSTOM' | 'OPTION'; data?: SearchableOption }> = [];
    if (addOptionLabel && onAddOption) {
      list.push({ type: 'ADD' });
    }
    if (customOptionLabel && onCustomOption) {
      list.push({ type: 'CUSTOM' });
    }
    filteredOptions.forEach((opt) => {
      list.push({ type: 'OPTION', data: opt });
    });
    return list;
  }, [addOptionLabel, onAddOption, customOptionLabel, onCustomOption, filteredOptions]);

  // Set activeIndex when items or value change: prioritize matched fetched value
  useEffect(() => {
    if (value) {
      const matchIdx = navItems.findIndex(
        (it) => it.type === 'OPTION' && (it.data?.value === value || it.data?.label === value)
      );
      if (matchIdx >= 0) {
        setActiveIndex(matchIdx);
        return;
      }
    }
    const firstOptionIdx = navItems.findIndex((it) => it.type === 'OPTION');
    setActiveIndex(firstOptionIdx >= 0 ? firstOptionIdx : 0);
  }, [navItems, value, searchText]);

  // Auto-scroll active item into view during keyboard arrow navigation
  useEffect(() => {
    if (!isOpen || activeIndex < 0 || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const activeEl = container.querySelector(`[data-nav-index="${activeIndex}"]`) as HTMLElement;
    if (activeEl) {
      const containerTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const containerBottom = containerTop + containerHeight;
      const elTop = activeEl.offsetTop;
      const elHeight = activeEl.offsetHeight;
      const elBottom = elTop + elHeight;

      if (elTop < containerTop) {
        container.scrollTop = elTop;
      } else if (elBottom > containerBottom) {
        container.scrollTop = elBottom - containerHeight;
      }
    }
  }, [activeIndex, isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelectOption = (opt: SearchableOption) => {
    onChange(opt.value, opt);
    setSearchText(opt.label);
    setIsOpen(false);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    updatePosition();
    setIsOpen(true);
    if (value) {
      const matchIdx = navItems.findIndex(
        (it) => it.type === 'OPTION' && (it.data?.value === value || it.data?.label === value)
      );
      if (matchIdx >= 0) {
        setActiveIndex(matchIdx);
      }
    }
    // Select all text so user can immediately type to replace / search
    e.target.select();
    if (onFocus) onFocus(e);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(0);
        return;
      }
      if (navItems.length === 0) return;
      setActiveIndex((prev) => (prev + 1 < navItems.length ? prev + 1 : 0));
      return;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(navItems.length > 0 ? navItems.length - 1 : 0);
        return;
      }
      if (navItems.length === 0) return;
      setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : navItems.length - 1));
      return;
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setActiveIndex((prev) => Math.min(prev + 5, Math.max(0, navItems.length - 1)));
      return;
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setActiveIndex((prev) => Math.max(prev - 5, 0));
      return;
    } else if (e.key === 'Home' && isOpen) {
      e.preventDefault();
      setActiveIndex(0);
      return;
    } else if (e.key === 'End' && isOpen) {
      e.preventDefault();
      setActiveIndex(Math.max(0, navItems.length - 1));
      return;
    } else if (e.key === 'Enter') {
      if (isOpen && navItems.length > 0 && activeIndex >= 0 && activeIndex < navItems.length) {
        e.preventDefault();
        const activeItem = navItems[activeIndex];
        if (activeItem.type === 'ADD' && onAddOption) {
          setIsOpen(false);
          onAddOption();
        } else if (activeItem.type === 'CUSTOM' && onCustomOption) {
          setIsOpen(false);
          onCustomOption();
        } else if (activeItem.type === 'OPTION' && activeItem.data) {
          handleSelectOption(activeItem.data);
        }
        return;
      }
    } else if (e.key === 'Tab') {
      if (isOpen) {
        if (navItems.length > 0 && activeIndex >= 0 && activeIndex < navItems.length) {
          const activeItem = navItems[activeIndex];
          if (activeItem.type === 'OPTION' && activeItem.data) {
            e.preventDefault();
            handleSelectOption(activeItem.data);
            const currentTarget = inputRef.current;
            setTimeout(() => {
              if (currentTarget) {
                focusNextFormElement(currentTarget, e.shiftKey);
              }
            }, 15);
            return;
          }
        }
        // If activeIndex is on ADD or CUSTOM, NEVER open modal on Tab!
        // Simply close the dropdown and move focus forward!
        e.preventDefault();
        setIsOpen(false);
        const currentTarget = inputRef.current;
        setTimeout(() => {
          if (currentTarget) {
            focusNextFormElement(currentTarget, e.shiftKey);
          }
        }, 15);
        return;
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
      setSearchText(selectedOption ? selectedOption.label : value || '');
      return;
    }

    if (onKeyDown) onKeyDown(e);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Combobox Trigger Input */}
      <div className="relative flex items-center w-full">
        <input
          ref={inputRef}
          id={id}
          type="text"
          disabled={disabled}
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={handleInputFocus}
          onBlur={onBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className={`w-full h-[30px] sm:h-[32px] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] hover:border-[rgba(112,185,245,0.4)] focus:border-[#2588E8] rounded-lg px-2.5 pr-7 text-xs text-[#FFFFFF] font-semibold placeholder-[#7F98AE] focus:outline-hidden transition cursor-text ${
            disabled ? 'opacity-50 cursor-not-allowed bg-[rgba(8,24,40,0.50)] backdrop-blur-xl' : ''
          } ${buttonClassName}`}
        />

        <div className="absolute right-1.5 flex items-center gap-0.5 text-[#7F98AE] pointer-events-none">
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-[#2588E8]' : ''
            }`}
          />
        </div>
      </div>

      {/* Floating Dropdown List via Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={listRef}
            data-dropdown-open="true"
            style={{
              position: 'absolute',
              top: `${coords.top + 3}px`,
              left: `${coords.left}px`,
              width: `${Math.max(coords.width, 260)}px`,
            }}
            className={`z-[99999999] bg-[rgba(8,27,46,0.98)] backdrop-blur-[24px] border border-[rgba(112,185,245,0.30)] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.60)] overflow-hidden flex flex-col text-[#FFFFFF] text-xs animate-in fade-in zoom-in-95 duration-100 ${dropdownClassName}`}
          >
            {/* Quick Summary Bar */}
            <div className="px-3 py-1.5 bg-[rgba(18,48,76,0.55)] border-b border-[rgba(112,185,245,0.25)] flex items-center justify-between text-[10px] text-[#7F98AE] font-mono shrink-0">
              <span className="flex items-center gap-1">
                <Search className="w-2.5 h-2.5 text-[#2588E8]" />
                Type any word (1st, 2nd, 3rd) to filter
              </span>
              <span>{filteredOptions.length} found</span>
            </div>

            {/* Pinned Action Buttons (ADD / CUSTOM) — kept OUTSIDE the scroll area
                so they never overlap each other or scroll under one another. */}
            {((addOptionLabel && onAddOption) || (customOptionLabel && onCustomOption)) && (
              <div className="shrink-0 flex flex-col border-b border-[rgba(112,185,245,0.25)]">
                {/* + Add Option */}
                {addOptionLabel && onAddOption && (
                  <button
                    type="button"
                    data-nav-index={navItems.findIndex((it) => it.type === 'ADD')}
                    onClick={() => {
                      setIsOpen(false);
                      onAddOption();
                    }}
                    onMouseEnter={() => {
                      const idx = navItems.findIndex((it) => it.type === 'ADD');
                      if (idx >= 0) setActiveIndex(idx);
                    }}
                    className={`w-full px-3 py-1.5 text-left flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition cursor-pointer ${
                      activeIndex === navItems.findIndex((it) => it.type === 'ADD')
                        ? 'ring-1 ring-amber-400 bg-amber-500/25'
                        : ''
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>{addOptionLabel}</span>
                  </button>
                )}

                {/* + Custom Option */}
                {customOptionLabel && onCustomOption && (
                  <button
                    type="button"
                    data-nav-index={navItems.findIndex((it) => it.type === 'CUSTOM')}
                    onClick={() => {
                      setIsOpen(false);
                      onCustomOption();
                    }}
                    onMouseEnter={() => {
                      const idx = navItems.findIndex((it) => it.type === 'CUSTOM');
                      if (idx >= 0) setActiveIndex(idx);
                    }}
                    className={`w-full px-3 py-1.5 text-left flex items-center gap-2 text-xs font-bold text-[#2588E8] bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.2)] transition cursor-pointer ${
                      (addOptionLabel && onAddOption) ? 'border-t border-[rgba(112,185,245,0.20)]' : ''
                    } ${
                      activeIndex === navItems.findIndex((it) => it.type === 'CUSTOM')
                        ? 'ring-1 ring-[#2588E8] bg-[rgba(57,167,255,0.25)]'
                        : ''
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>{customOptionLabel}</span>
                  </button>
                )}
              </div>
            )}

            {/* Scrollable Items Container */}
            <div
              ref={scrollContainerRef}
              className="relative max-h-60 overflow-y-auto divide-y divide-[rgba(112,185,245,0.15)]/40 py-1"
            >
              {/* Filtered Master Items */}
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => {
                  const navIdx = navItems.findIndex(
                    (it) => it.type === 'OPTION' && it.data?.value === opt.value
                  );
                  const isHighlighted = navIdx === activeIndex;
                  const isSelected = opt.value === value || opt.label === value;

                  return (
                    <div
                      key={opt.value}
                      data-nav-index={navIdx}
                      onClick={() => handleSelectOption(opt)}
                      onMouseEnter={() => {
                        if (navIdx >= 0) setActiveIndex(navIdx);
                      }}
                      className={`px-3 py-1.5 cursor-pointer flex items-center justify-between transition ${
                        isHighlighted
                          ? 'bg-[rgba(37,136,232,0.30)] text-white font-bold ring-1 ring-[#2588E8]/50'
                          : isSelected
                          ? 'bg-[rgba(18,48,76,0.60)] text-[#2588E8] font-semibold'
                          : 'text-[#E1ECE5] hover:bg-[rgba(45,120,180,0.20)]'
                      }`}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="truncate text-xs">{opt.label}</span>
                        {opt.subLabel && (
                          <span className="text-[10px] text-[#7F98AE] font-mono truncate">
                            {opt.subLabel}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {opt.badge && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] text-[#2588E8]">
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#2588E8]" />}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-3 text-center text-[#7F98AE] text-xs">
                  <p>No matching results for &quot;{searchText}&quot;</p>
                  {addOptionLabel && onAddOption && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onAddOption();
                      }}
                      className="mt-1.5 text-xs text-amber-400 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Add as new item
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
