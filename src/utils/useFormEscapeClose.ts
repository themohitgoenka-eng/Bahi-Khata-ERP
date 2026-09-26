import { useEffect } from 'react';

interface UseFormEscapeCloseProps {
  isOpen: boolean;
  onAttemptClose: () => void;
  ignoreEscape?: boolean;
}

/**
 * Hook to intercept the Escape key on open modal forms and trigger confirmation.
 * Safely ignores Escape if a submodal or dropdown popup is currently open.
 */
export const useFormEscapeClose = ({
  isOpen,
  onAttemptClose,
  ignoreEscape = false,
}: UseFormEscapeCloseProps) => {
  useEffect(() => {
    if (!isOpen || ignoreEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // If a dropdown portal is currently active, let the dropdown handle its own Escape first
        const openDropdown = document.querySelector('[data-dropdown-open="true"]');
        if (openDropdown) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        onAttemptClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, ignoreEscape, onAttemptClose]);
};
