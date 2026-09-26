import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, UserPlus, X, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { FullLedgerMasterModal } from './master/FullLedgerMasterModal';
import { focusNextFormElement } from '../utils/formUtils';

export interface PartySelectDropdownProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  inputClassName?: string;
  filterType?: 'DEBTOR' | 'CREDITOR' | 'ALL';
}

export type PartyNavItem =
  | { type: 'ADD'; id: '__ADD_PARTY__' }
  | { type: 'CUSTOM'; id: '__CUSTOM_PARTY__'; name: string }
  | {
      type: 'OPTION';
      id: string;
      name: string;
      subType?: string;
      city?: string;
      phone?: string;
      balance?: number;
    };

export const PartySelectDropdown: React.FC<PartySelectDropdownProps> = ({
  value,
  onChange,
  placeholder = 'Select or type customer / party name...',
  required = false,
  disabled = false,
  inputClassName,
  filterType = 'ALL',
}) => {
  const { ledgers } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync external value
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Default common parties in stone/granite/marble industry
  const defaultParties = [
    { name: 'GANPATI GRANITES & TILES', type: 'Sundry Debtors', phone: '9829012345', city: 'Jaipur' },
    { name: 'SHREE SHYAM MARBLE TRADERS', type: 'Sundry Debtors', phone: '9414012345', city: 'Kishangarh' },
    { name: 'RAJASTHAN STONES CO.', type: 'Sundry Debtors', phone: '9828054321', city: 'Makrana' },
    { name: 'JAI BHAWANI ENTERPRISES', type: 'Sundry Debtors', phone: '9782001122', city: 'Udaipur' },
    { name: 'MARWAR CERAMICS & SANITARY', type: 'Sundry Debtors', phone: '9413009988', city: 'Jodhpur' },
    { name: 'MAHALAXMI STONE IMPEX', type: 'Sundry Creditors', phone: '9928114455', city: 'Bangalore' },
    { name: 'ASHAPURA TILES & EXPORTS', type: 'Sundry Creditors', phone: '9829443322', city: 'Ahmedabad' },
  ];

  // Merge app ledgers with fallback defaults
  const partiesList = useMemo(() => {
    const list: Array<{ name: string; type: string; phone?: string; city?: string; balance?: number }> = [];
    const seen = new Set<string>();

    if (ledgers && ledgers.length > 0) {
      ledgers.forEach((l) => {
        if (!seen.has(l.name.toUpperCase())) {
          seen.add(l.name.toUpperCase());
          list.push({
            name: l.name,
            type: l.type ? l.type.replace('_', ' ') : 'Account Ledger',
            phone: l.phone,
            city: l.city,
            balance: l.currentBalance,
          });
        }
      });
    }

    defaultParties.forEach((p) => {
      if (!seen.has(p.name.toUpperCase())) {
        seen.add(p.name.toUpperCase());
        list.push(p);
      }
    });

    return list;
  }, [ledgers]);

  // Filter based on advanced multi-token search (matches 2nd word, 3rd word, or any tokens)
  const filteredParties = useMemo(() => {
    const term = inputValue.trim().toLowerCase();
    if (!term) return partiesList;
    const tokens = term.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return partiesList;
    return partiesList.filter((p) => {
      const combined = `${p.name} ${p.city || ''} ${p.phone || ''} ${p.type || ''}`.toLowerCase();
      return tokens.every((tok) => combined.includes(tok));
    });
  }, [partiesList, inputValue]);

  // Check if typed value is custom
  const showCustomOption = useMemo(() => {
    const trimmed = inputValue.trim().toUpperCase();
    return trimmed !== '' && !partiesList.some((p) => p.name.toUpperCase() === trimmed);
  }, [inputValue, partiesList]);

  // Unified navigation items: Add Party at index 0, followed by Custom (if typed), then filtered parties
  const navItems = useMemo<PartyNavItem[]>(() => {
    const list: PartyNavItem[] = [];

    // Index 0: + Add Party Button
    list.push({ type: 'ADD', id: '__ADD_PARTY__' });

    // Index 1 (if typed non-matching text): Custom party
    if (showCustomOption) {
      list.push({
        type: 'CUSTOM',
        id: '__CUSTOM_PARTY__',
        name: inputValue.trim().toUpperCase(),
      });
    }

    // Filtered Parties
    filteredParties.forEach((p) => {
      list.push({
        type: 'OPTION',
        id: p.name,
        name: p.name,
        subType: p.type,
        city: p.city,
        phone: p.phone,
        balance: p.balance,
      });
    });

    return list;
  }, [showCustomOption, inputValue, filteredParties]);

  const [activeIndex, setActiveIndex] = useState<number>(() => {
    const firstOptionIdx = navItems.findIndex((it) => it.type === 'OPTION');
    return firstOptionIdx >= 0 ? firstOptionIdx : 0;
  });

  // Keep active index synced when party search changes:
  // If inputValue matches an option, highlight that option; otherwise highlight the first option or ADD.
  useEffect(() => {
    const trimmed = inputValue.trim().toUpperCase();
    if (trimmed) {
      const matchIdx = navItems.findIndex(
        (it) => it.type === 'OPTION' && it.name.toUpperCase() === trimmed
      );
      if (matchIdx >= 0) {
        setActiveIndex(matchIdx);
        return;
      }
    }
    const firstOptionIdx = navItems.findIndex((it) => it.type === 'OPTION');
    if (firstOptionIdx >= 0) {
      setActiveIndex(firstOptionIdx);
    } else {
      setActiveIndex(0);
    }
  }, [filteredParties, showCustomOption]);

  // Auto-scroll the highlighted item into view
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && scrollContainerRef.current) {
      if (activeIndex === 0) {
        scrollContainerRef.current.scrollTop = 0;
        return;
      }
      const container = scrollContainerRef.current;
      const el = container.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement;
      if (el) {
        const containerTop = container.scrollTop;
        const visibleHeight = container.clientHeight;
        const containerBottom = containerTop + visibleHeight;
        const elTop = el.offsetTop - container.offsetTop;
        const elHeight = el.offsetHeight;
        const elBottom = elTop + elHeight;

        if (elTop < containerTop) {
          container.scrollTop = elTop;
        } else if (elBottom > containerBottom) {
          container.scrollTop = elBottom - visibleHeight;
        }
      }
    }
  }, [activeIndex, isOpen]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setInputValue(nextVal);
    onChange(nextVal);
    if (!isOpen) setIsOpen(true);
  };

  const handleSelectParty = (name: string) => {
    setInputValue(name);
    onChange(name);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
        const firstOptionIdx = navItems.findIndex((it) => it.type === 'OPTION');
        setActiveIndex(firstOptionIdx >= 0 ? firstOptionIdx : 0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (navItems.length === 0) return;
      setActiveIndex((prev) => (prev + 1 < navItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (navItems.length === 0) return;
      setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : navItems.length - 1));
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 5, Math.max(0, navItems.length - 1)));
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 5, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(Math.max(0, navItems.length - 1));
    } else if (e.key === 'Enter') {
      if (navItems.length > 0 && activeIndex >= 0 && activeIndex < navItems.length) {
        e.preventDefault();
        e.stopPropagation();
        const activeItem = navItems[activeIndex];
        if (activeItem.type === 'ADD') {
          setIsOpen(false);
          setIsQuickCreateOpen(true);
        } else if (activeItem.type === 'CUSTOM') {
          handleSelectParty(activeItem.name);
        } else if (activeItem.type === 'OPTION') {
          handleSelectParty(activeItem.name);
        }
      }
    } else if (e.key === 'Tab') {
      if (isOpen) {
        if (navItems.length > 0 && activeIndex >= 0 && activeIndex < navItems.length) {
          const activeItem = navItems[activeIndex];
          if (activeItem.type === 'OPTION' || activeItem.type === 'CUSTOM') {
            e.preventDefault();
            e.stopPropagation();
            handleSelectParty(activeItem.name);
            const currentTarget = inputRef.current;
            setTimeout(() => {
              if (currentTarget) {
                focusNextFormElement(currentTarget, e.shiftKey);
              }
            }, 15);
            return;
          }
        }
        // If activeIndex is on ADD, never trigger modal on Tab! Just close and advance focus.
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
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputValue('');
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Combobox Trigger Input - Clean standard appearance matching Item Field */}
      <div className="relative flex items-center w-full">
        <input
          ref={inputRef}
          id="party_select_input"
          type="text"
          required={required}
          disabled={disabled}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsOpen(true);
            inputRef.current?.select();
          }}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className={`w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border rounded px-3 py-2 pr-12 text-xs text-[#FFFFFF] placeholder-[#7F98AE] font-medium transition-colors outline-none ${
            isOpen ? 'border-[#2588E8] ring-1 ring-[#2588E8]/50' : 'border-[rgba(112,185,245,0.25)] hover:border-[rgba(112,185,245,0.4)]'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-[rgba(8,24,40,0.50)]' : ''} ${inputClassName || ''}`}
        />

        <div className="absolute right-2 flex items-center gap-1 text-[#7F98AE]">
          {inputValue && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-1 hover:text-[#FFFFFF] rounded hover:bg-[rgba(57,167,255,0.15)] transition-colors"
              title="Clear party"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => {
              setIsOpen((prev) => !prev);
              inputRef.current?.focus();
            }}
            className="p-1 hover:text-[#2588E8] rounded transition-colors"
            title="Toggle party list"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-[#2588E8]' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Suggestions Dropdown Menu */}
      {isOpen && (
        <div
          data-dropdown-open="true"
          className="absolute left-0 right-0 top-full mt-1 z-50 bg-[rgba(8,27,46,0.98)] backdrop-blur-[24px] border border-[rgba(112,185,245,0.30)] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.60)] overflow-hidden flex flex-col text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Quick Header Summary */}
          <div className="px-3 py-1.5 bg-[rgba(18,48,76,0.55)] border-b border-[rgba(112,185,245,0.25)] flex items-center justify-between text-[10px] text-[#7F98AE] font-mono shrink-0">
            <span className="flex items-center gap-1">
              <Search className="w-3 h-3 text-[#2588E8]" />
              <span>Parties ({filteredParties.length})</span>
            </span>
            <span className="text-[9px] text-[#7F98AE] opacity-80">↑↓ Arrow • Enter Select</span>
          </div>

          {/* Sticky + Add Party Button at top of dropdown (never disappears on scroll!) */}
          <div className="sticky top-0 z-20 bg-[rgba(8,27,46,0.98)] border-b border-[rgba(112,185,245,0.25)] shrink-0">
            <button
              type="button"
              data-index={0}
              onClick={(e) => {
                e.stopPropagation();
                setIsQuickCreateOpen(true);
                setIsOpen(false);
              }}
              onMouseEnter={() => setActiveIndex(0)}
              className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition cursor-pointer ${
                activeIndex === 0
                  ? 'ring-1 ring-amber-400 bg-amber-500/25 text-amber-300'
                  : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <Plus className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>+ Add party/Customer</span>
              </div>
              {activeIndex === 0 && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                  ↵ Enter
                </span>
              )}
            </button>
          </div>

          {/* Scrollable Container for all party options */}
          <div
            ref={scrollContainerRef}
            className="overflow-y-auto max-h-56 divide-y divide-[rgba(112,185,245,0.15)]/40"
          >
            {navItems.map((item, idx) => {
              if (item.type === 'ADD') return null; // rendered in sticky header above
              const isActive = idx === activeIndex;

              if (item.type === 'CUSTOM') {
                return (
                  <div
                    key={item.id}
                    data-index={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelectParty(item.name)}
                    className={`p-2.5 cursor-pointer flex items-center justify-between transition-colors border-b border-amber-500/20 ${
                      isActive
                        ? 'bg-amber-500/25 text-amber-200 ring-1 ring-amber-500/50'
                        : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <UserPlus className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">Use &ldquo;{item.name}&rdquo;</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActive && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-white/10 text-amber-200 font-mono">
                          ↵ Enter
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 uppercase font-mono font-bold">
                        Custom Party
                      </span>
                    </div>
                  </div>
                );
              }

              // Normal Party Option
              const isSelected = item.name.toUpperCase() === inputValue.trim().toUpperCase();
              return (
                <div
                  key={item.id}
                  data-index={idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleSelectParty(item.name)}
                  className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40'
                      : isSelected
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'hover:bg-[rgba(45,120,180,0.20)] text-[#F1F7FC]'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-white truncate flex items-center gap-1.5">
                      <span>{item.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5 font-mono">
                      <span className="px-1 py-0.2 rounded bg-white/5 text-amber-400/90">{item.subType}</span>
                      {item.city && <span>• {item.city}</span>}
                      {item.phone && <span>• {item.phone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.balance !== undefined && (
                      <div className="text-[10px] font-mono text-right text-gray-400">
                        ₹{Math.abs(item.balance).toLocaleString('en-IN')}
                      </div>
                    )}
                    {isActive && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-white/10 text-amber-200 font-mono">
                        ↵ Enter
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredParties.length === 0 && !showCustomOption && (
              <div className="p-3 text-center text-xs text-gray-400">
                No matching parties. Press &quot;+ Add Party&quot; above to create one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Original Ledger / Party Master Modal */}
      <FullLedgerMasterModal
        isOpen={isQuickCreateOpen}
        initialName={inputValue.trim()}
        defaultGroupId={filterType === 'CREDITOR' ? 'grp-sundry-creditors' : 'grp-sundry-debtors'}
        onClose={() => {
          setIsQuickCreateOpen(false);
          setTimeout(() => inputRef.current?.focus(), 60);
        }}
        onCreated={(createdLedger) => {
          setInputValue(createdLedger.name);
          onChange(createdLedger.name);
          setIsQuickCreateOpen(false);
          setTimeout(() => inputRef.current?.focus(), 60);
        }}
      />
    </div>
  );
};
