import { useState, useEffect, useCallback } from 'react';

interface UseTableKeyboardNavigationOptions {
  totalRows: number;
  tableId?: string;
  enabled?: boolean;
  onEnter?: (index: number) => void;
  initialIndex?: number;
}

export function useTableKeyboardNavigation({
  totalRows,
  tableId = 'default-table',
  enabled = true,
  onEnter,
  initialIndex = 0,
}: UseTableKeyboardNavigationOptions) {
  const [selectedIndex, setSelectedIndex] = useState<number>(initialIndex);

  // Keep index within bounds whenever totalRows changes
  useEffect(() => {
    if (totalRows <= 0) {
      setSelectedIndex(-1);
    } else if (selectedIndex >= totalRows) {
      setSelectedIndex(totalRows - 1);
    } else if (selectedIndex < 0 && totalRows > 0) {
      setSelectedIndex(0);
    }
  }, [totalRows, selectedIndex]);

  // Handle Arrow navigation
  useEffect(() => {
    if (!enabled || totalRows <= 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in form controls or within a modal dialog
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest('[role="dialog"]') ||
          target.closest('.modal-container'))
      ) {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, totalRows - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setSelectedIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setSelectedIndex(totalRows - 1);
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < totalRows && onEnter) {
          e.preventDefault();
          onEnter(selectedIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, totalRows, selectedIndex, onEnter]);

  // Scroll into view whenever selectedIndex changes
  useEffect(() => {
    if (selectedIndex >= 0) {
      const selector = `[data-table-id="${tableId}"][data-row-idx="${selectedIndex}"]`;
      const el = document.querySelector(selector);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, tableId]);

  const getRowProps = useCallback(
    (index: number) => {
      const isSelected = index === selectedIndex;
      return {
        'data-table-id': tableId,
        'data-row-idx': index,
        onClick: () => setSelectedIndex(index),
        className: isSelected
          ? 'bg-[#123356] ring-2 ring-inset ring-[#2588E8] border-l-4 border-l-[#2588E8] text-[#FFFFFF] shadow-md font-semibold transition-colors duration-150'
          : 'hover:bg-[#123356]/40 transition-colors duration-150',
      };
    },
    [selectedIndex, tableId]
  );

  return {
    selectedIndex,
    setSelectedIndex,
    getRowProps,
  };
}
