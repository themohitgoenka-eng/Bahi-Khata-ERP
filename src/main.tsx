import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {QueryProvider} from './providers/QueryProvider';
import './index.css';

// Global input listener: Automatically converts any user input to CAPITAL LETTERS (Uppercase)
// regardless of Caps Lock on/off
if (typeof window !== 'undefined') {
  document.addEventListener(
    'input',
    (e) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (!target) return;
      const tag = target.tagName ? target.tagName.toUpperCase() : '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;

      if (tag === 'INPUT') {
        const type = (target.getAttribute('type') || 'text').toLowerCase();
        if (
          [
            'password',
            'number',
            'date',
            'datetime-local',
            'time',
            'checkbox',
            'radio',
            'file',
            'color',
            'range',
          ].includes(type)
        ) {
          return;
        }
      }

      const currentVal = target.value;
      if (typeof currentVal === 'string' && /[a-z]/.test(currentVal)) {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const upperVal = currentVal.toUpperCase();

        const proto = tag === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if (descriptor && descriptor.set) {
          descriptor.set.call(target, upperVal);
        } else {
          target.value = upperVal;
        }

        if (start !== null && end !== null) {
          target.setSelectionRange(start, end);
        }
      }
    },
    true // Capture phase: runs before React synthetic event listeners
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>,
);
