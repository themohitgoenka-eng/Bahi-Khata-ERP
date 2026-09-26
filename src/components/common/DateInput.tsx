import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import {
  formatDateDisplay,
  parseDisplayToISO,
  parseFlexibleDate,
  getTodayISO,
  getDaysInMonth,
} from '../../utils/dateUtils';

export interface DateInputProps {
  value?: string; // ISO (YYYY-MM-DD) or DD/MM/YYYY
  onChange: (isoDate: string) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  min?: string;
  max?: string;
  showIcon?: boolean;
  placeholder?: string;
}

/**
 * Format raw typed string with auto-slashes for DD/MM/YYYY
 */
function applyDateMask(input: string, prevValue: string): string {
  // Allow user to delete slashes freely
  if (input.length < prevValue.length) {
    return input;
  }

  // Replace any non-alphanumeric except slashes and dashes
  let cleaned = input.replace(/[^\d/.\-]/g, '');

  // Convert dots/dashes to slashes
  cleaned = cleaned.replace(/[.\-]/g, '/');

  // Handle auto-padding when user explicitly types '/'
  // e.g. "5/" -> "05/", "15/8/" -> "15/08/"
  const slashSegments = cleaned.split('/');
  if (slashSegments.length === 2 && slashSegments[0].length === 1 && cleaned.endsWith('/')) {
    cleaned = `0${slashSegments[0]}/`;
  } else if (slashSegments.length === 3 && slashSegments[1].length === 1 && cleaned.endsWith('/')) {
    cleaned = `${slashSegments[0]}/0${slashSegments[1]}/`;
  }

  // Continuous digits auto-formatting (e.g. 15082026)
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length > 8) {
    const limited = digitsOnly.slice(0, 8);
    return `${limited.slice(0, 2)}/${limited.slice(2, 4)}/${limited.slice(4, 8)}`;
  }

  // If user is just typing digits without slashes
  if (!cleaned.includes('/')) {
    if (digitsOnly.length >= 5) {
      return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4)}`;
    }
    if (digitsOnly.length >= 3) {
      return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
    }
    if (digitsOnly.length === 2) {
      const dayNum = parseInt(digitsOnly, 10);
      // Auto-insert slash after 2 valid day digits
      if (dayNum >= 1 && dayNum <= 31) {
        return `${digitsOnly}/`;
      }
    }
  } else {
    // If it has slashes, format sections
    const parts = cleaned.split('/');
    if (parts[0] && parts[0].length === 2 && parts.length === 2 && parts[1].length === 2) {
      return `${parts[0]}/${parts[1]}/`;
    }
  }

  // Max 10 chars (DD/MM/YYYY)
  return cleaned.slice(0, 10);
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  id,
  name,
  disabled = false,
  required = false,
  autoFocus = false,
  className = '',
  size = 'md',
  min,
  max,
  showIcon = true,
  placeholder = 'DD/MM/YYYY',
}) => {
  // Compute initial display text
  const getInitialDisplay = useCallback(() => {
    if (!value) return formatDateDisplay(getTodayISO());
    return formatDateDisplay(value);
  }, [value]);

  const [displayText, setDisplayText] = useState<string>(getInitialDisplay());
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenDateRef = useRef<HTMLInputElement>(null);

  // Keep track of the last committed ISO string to avoid rewriting user text during normal renders
  const lastCommittedIsoRef = useRef<string>(value ? parseDisplayToISO(value) : getTodayISO());

  // Sync with external prop value if changed outside
  useEffect(() => {
    const incomingIso = value ? parseDisplayToISO(value) : getTodayISO();
    if (incomingIso !== lastCommittedIsoRef.current) {
      lastCommittedIsoRef.current = incomingIso;
      setDisplayText(formatDateDisplay(incomingIso));
    }
  }, [value]);

  // Handle autofocus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  // Commit text to ISO and notify parent
  const commitValue = useCallback(
    (textToParse: string) => {
      const parsed = parseFlexibleDate(textToParse);
      setDisplayText(parsed.display);
      lastCommittedIsoRef.current = parsed.iso;
      onChange(parsed.iso);
    },
    [onChange]
  );

  // Handle typing input
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const masked = applyDateMask(rawVal, displayText);
    setDisplayText(masked);

    // If fully formed DD/MM/YYYY (10 chars), automatically commit without needing blur
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(masked)) {
      const parsed = parseFlexibleDate(masked);
      if (parsed.isValid) {
        lastCommittedIsoRef.current = parsed.iso;
        onChange(parsed.iso);
      }
    }
  };

  // Keyboard navigation & shortcuts (Tally-style)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    // Enter key -> Commit and keep focus / submit
    if (e.key === 'Enter') {
      commitValue(displayText);
      return;
    }

    // 't' or 'T' -> Today's date
    if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      const todayIso = getTodayISO();
      const todayDisplay = formatDateDisplay(todayIso);
      setDisplayText(todayDisplay);
      lastCommittedIsoRef.current = todayIso;
      onChange(todayIso);
      inputRef.current?.select();
      return;
    }

    // Up Arrow or '+' -> Add 1 day
    if (e.key === 'ArrowUp' || e.key === '+') {
      e.preventDefault();
      const parsed = parseFlexibleDate(displayText);
      const currDate = new Date(parsed.iso);
      if (!isNaN(currDate.getTime())) {
        currDate.setDate(currDate.getDate() + 1);
        const y = currDate.getFullYear();
        const m = String(currDate.getMonth() + 1).padStart(2, '0');
        const d = String(currDate.getDate()).padStart(2, '0');
        const nextIso = `${y}-${m}-${d}`;
        const nextDisplay = `${d}/${m}/${y}`;
        setDisplayText(nextDisplay);
        lastCommittedIsoRef.current = nextIso;
        onChange(nextIso);
      }
      return;
    }

    // Down Arrow or '-' -> Subtract 1 day (only if input is not empty)
    if (e.key === 'ArrowDown' || (e.key === '-' && displayText.length >= 8)) {
      e.preventDefault();
      const parsed = parseFlexibleDate(displayText);
      const currDate = new Date(parsed.iso);
      if (!isNaN(currDate.getTime())) {
        currDate.setDate(currDate.getDate() - 1);
        const y = currDate.getFullYear();
        const m = String(currDate.getMonth() + 1).padStart(2, '0');
        const d = String(currDate.getDate()).padStart(2, '0');
        const prevIso = `${y}-${m}-${d}`;
        const prevDisplay = `${d}/${m}/${y}`;
        setDisplayText(prevDisplay);
        lastCommittedIsoRef.current = prevIso;
        onChange(prevIso);
      }
      return;
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    e.target.select();
  };

  const handleBlur = () => {
    setIsFocused(false);
    commitValue(displayText);
  };

  // Native Date Picker sync
  const handleNativePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedIso = e.target.value;
    if (selectedIso) {
      const display = formatDateDisplay(selectedIso);
      setDisplayText(display);
      lastCommittedIsoRef.current = selectedIso;
      onChange(selectedIso);
    }
  };

  // Styling based on size
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs h-7',
    md: 'px-2.5 py-1 text-xs h-[34px]',
    lg: 'px-3 py-1.5 text-sm h-10',
  }[size];

  const currentIso = lastCommittedIsoRef.current;

  return (
    <div
      className={`relative inline-flex items-center bg-slate-950 border border-slate-700/90 rounded-lg text-slate-100 font-mono transition-all shadow-xs ${
        isFocused
          ? 'border-indigo-500 ring-1 ring-indigo-500/80'
          : 'hover:border-slate-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-900' : ''} ${sizeClasses} ${className}`}
      id={id}
    >
      {/* Hidden native form inputs for form compatibility */}
      <input type="hidden" name={name} value={currentIso} required={required} />

      {/* Single Unified Text Input */}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayText}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={10}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="w-full bg-transparent font-bold text-white tracking-wider focus:outline-none placeholder:text-slate-500 selection:bg-indigo-600 selection:text-white"
      />

      {/* Calendar Picker Icon button */}
      {showIcon && (
        <div className="relative ml-1.5 flex items-center shrink-0">
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => {
              if (hiddenDateRef.current) {
                if ('showPicker' in HTMLInputElement.prototype) {
                  try {
                    hiddenDateRef.current.showPicker();
                  } catch {
                    hiddenDateRef.current.click();
                  }
                } else {
                  hiddenDateRef.current.click();
                }
              }
            }}
            className="text-slate-400 hover:text-indigo-400 active:text-indigo-300 transition-colors p-0.5 rounded cursor-pointer"
            title="Open Calendar Picker"
          >
            <Calendar className="w-3.5 h-3.5 stroke-[2]" />
          </button>

          {/* Hidden native date input for native picker triggering */}
          <input
            ref={hiddenDateRef}
            type="date"
            tabIndex={-1}
            value={currentIso}
            min={min}
            max={max}
            onChange={handleNativePickerChange}
            className="absolute -top-1 -right-1 opacity-0 w-4 h-4 pointer-events-none"
          />
        </div>
      )}
    </div>
  );
};
