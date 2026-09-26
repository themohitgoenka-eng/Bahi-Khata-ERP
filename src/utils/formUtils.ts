/**
 * Form and DOM focus navigation utilities
 */

export const focusNextFormElement = (currentEl: HTMLElement, backwards = false): boolean => {
  if (typeof document === 'undefined') return false;

  const focusableSelectors = [
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  const allFocusable = Array.from(document.querySelectorAll<HTMLElement>(focusableSelectors)).filter(
    (el) => {
      // Must be visible and not hidden
      return el.offsetParent !== null && !el.closest('[aria-hidden="true"]') && el.style.display !== 'none';
    }
  );

  const currentIndex = allFocusable.indexOf(currentEl);
  if (currentIndex >= 0) {
    const nextIndex = backwards ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex >= 0 && nextIndex < allFocusable.length) {
      const nextEl = allFocusable[nextIndex];
      nextEl.focus();
      if (nextEl instanceof HTMLInputElement && (nextEl.type === 'text' || nextEl.type === 'number')) {
        nextEl.select();
      }
      return true;
    }
  }
  return false;
};
