import { useEffect, useCallback, useRef } from 'react';

interface KeyboardNavigationOptions {
  onCapture?: () => void;
  onReset?: () => void;
  onToggleCamera?: () => void;
  onNextLetter?: () => void;
  onPrevLetter?: () => void;
  onCloseModal?: () => void;
  onToggleHelp?: () => void;
  onToggleSettings?: () => void;
  disabled?: boolean;
}

export const useKeyboardNavigation = (options: KeyboardNavigationOptions = {}) => {
  const {
    onCapture,
    onReset,
    onToggleCamera,
    onNextLetter,
    onPrevLetter,
    onCloseModal,
    onToggleHelp,
    onToggleSettings,
    disabled = false
  } = options;

  const activeElementRef = useRef<HTMLElement | null>(null);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (disabled) return;

    // Don't interfere with typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Prevent default for handled keys
    const handledKeys = [' ', 'r', 'R', 'c', 'C', 'h', 'H', 's', 'S', 'ArrowLeft', 'ArrowRight', 'Escape'];
    if (handledKeys.includes(e.key)) {
      e.preventDefault();
    }

    switch (e.key) {
      case ' ': // Spacebar para capturar
        onCapture?.();
        announceAction('Capturando gesto');
        break;
        
      case 'r':
      case 'R': // R para resetear
        onReset?.();
        announceAction('Reseteando entrenamiento');
        break;
        
      case 'c':
      case 'C': // C para toggle cámara
        onToggleCamera?.();
        announceAction('Alternando cámara');
        break;
        
      case 'ArrowLeft': // Flecha izquierda para letra anterior
        onPrevLetter?.();
        announceAction('Letra anterior');
        break;
        
      case 'ArrowRight': // Flecha derecha para siguiente letra
        onNextLetter?.();
        announceAction('Siguiente letra');
        break;
        
      case 'Escape': // ESC para cerrar modales
        onCloseModal?.();
        announceAction('Cerrando modal');
        break;
        
      case 'h':
      case 'H': // H para ayuda
        onToggleHelp?.();
        announceAction('Alternando ayuda');
        break;
        
      case 's':
      case 'S': // S para configuración
        onToggleSettings?.();
        announceAction('Alternando configuración');
        break;
        
      case '?': // ? para mostrar atajos
        showKeyboardShortcuts();
        break;
    }
  }, [disabled, onCapture, onReset, onToggleCamera, onNextLetter, onPrevLetter, onCloseModal, onToggleHelp, onToggleSettings]);

  // Focus management
  const focusElement = useCallback((selector: string) => {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.focus();
      activeElementRef.current = element;
      announceAction(`Enfocando ${element.getAttribute('aria-label') || element.textContent || 'elemento'}`);
    }
  }, []);

  const focusNext = useCallback(() => {
    const focusableElements = document.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    
    const currentIndex = Array.from(focusableElements).indexOf(activeElementRef.current as Element);
    const nextIndex = (currentIndex + 1) % focusableElements.length;
    const nextElement = focusableElements[nextIndex] as HTMLElement;
    
    if (nextElement) {
      nextElement.focus();
      activeElementRef.current = nextElement;
    }
  }, []);

  const focusPrev = useCallback(() => {
    const focusableElements = document.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    
    const currentIndex = Array.from(focusableElements).indexOf(activeElementRef.current as Element);
    const prevIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
    const prevElement = focusableElements[prevIndex] as HTMLElement;
    
    if (prevElement) {
      prevElement.focus();
      activeElementRef.current = prevElement;
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  return {
    focusElement,
    focusNext,
    focusPrev
  };
};

// Announce actions for screen readers
function announceAction(message: string) {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

// Show keyboard shortcuts modal
function showKeyboardShortcuts() {
  const shortcuts = [
    { key: 'Espacio', action: 'Capturar gesto' },
    { key: 'R', action: 'Resetear entrenamiento' },
    { key: 'C', action: 'Alternar cámara' },
    { key: '← →', action: 'Navegar letras' },
    { key: 'Esc', action: 'Cerrar modal' },
    { key: 'H', action: 'Mostrar/ocultar ayuda' },
    { key: 'S', action: 'Abrir configuración' },
    { key: '?', action: 'Mostrar atajos' }
  ];

  const modal = document.createElement('div');
  modal.className = 'keyboard-shortcuts-modal';
  modal.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-content">
        <h2>Atajos de Teclado</h2>
        <div class="shortcuts-list">
          ${shortcuts.map(({ key, action }) => `
            <div class="shortcut-item">
              <kbd class="shortcut-key">${key}</kbd>
              <span class="shortcut-action">${action}</span>
            </div>
          `).join('')}
        </div>
        <button class="close-shortcuts">Cerrar (Esc)</button>
      </div>
    </div>
    <style>
      .keyboard-shortcuts-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .modal-content {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      }
      
      .modal-content h2 {
        margin: 0 0 20px 0;
        font-size: 20px;
        font-weight: 600;
        text-align: center;
      }
      
      .shortcuts-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
      }
      
      .shortcut-item {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .shortcut-key {
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        padding: 4px 8px;
        font-family: monospace;
        font-size: 12px;
        font-weight: 600;
        min-width: 60px;
        text-align: center;
      }
      
      .shortcut-action {
        color: #4b5563;
        font-size: 14px;
      }
      
      .close-shortcuts {
        width: 100%;
        padding: 12px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
      }
      
      .close-shortcuts:hover {
        background: #2563eb;
      }
      
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    </style>
  `;

  const closeModal = () => {
    document.body.removeChild(modal);
    document.removeEventListener('keydown', handleEscape);
  };

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };

  modal.querySelector('.close-shortcuts')?.addEventListener('click', closeModal);
  modal.querySelector('.modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  });

  document.addEventListener('keydown', handleEscape);
  document.body.appendChild(modal);
  
  // Focus the close button
  (modal.querySelector('.close-shortcuts') as HTMLElement)?.focus();
}

export default useKeyboardNavigation;
