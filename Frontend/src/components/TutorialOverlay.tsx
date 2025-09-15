import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './ui/Button';

interface TutorialStep {
  id: string;
  target: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'wait' | 'gesture';
  duration?: number;
}

interface TutorialOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  steps: TutorialStep[];
  currentView: 'vista1' | 'vista2' | 'vista3';
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  isOpen,
  onClose,
  steps: _steps,
  currentView
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightElement, setHighlightElement] = useState<Element | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  // Tutorial steps for different views
  const tutorialSteps: Record<string, TutorialStep[]> = {
    vista1: [
      {
        id: 'welcome',
        target: 'header',
        title: '¡Bienvenido a Vista 1!',
        content: 'Aprende a reconocer vocales (A, E, I, O, U) usando gestos de mano.',
        position: 'bottom'
      },
      {
        id: 'camera',
        target: '.camera-container, video',
        title: 'Cámara Web',
        content: 'Coloca tu mano frente a la cámara. Asegúrate de tener buena iluminación.',
        position: 'bottom',
        action: 'wait',
        duration: 3000
      },
      {
        id: 'hand-status',
        target: '.hand-status-indicator',
        title: 'Estado de la Mano',
        content: 'Este indicador te muestra si tu mano está siendo detectada correctamente.',
        position: 'right'
      },
      {
        id: 'training',
        target: '.training-controls',
        title: 'Entrenamiento',
        content: 'Selecciona una vocal y haz el gesto correspondiente. Luego haz clic en "Registrar Muestra".',
        position: 'top',
        action: 'click'
      },
      {
        id: 'recognition',
        target: '.recognition-display',
        title: 'Reconocimiento',
        content: 'Una vez entrenado, el sistema reconocerá automáticamente tus gestos.',
        position: 'left'
      }
    ],
    vista2: [
      {
        id: 'welcome',
        target: 'header',
        title: '¡Bienvenido a Vista 2!',
        content: 'Sistema avanzado para reconocer todo el alfabeto (A-Z + Ñ).',
        position: 'bottom'
      },
      {
        id: 'letter-select',
        target: '.letter-selector',
        title: 'Selector de Letra',
        content: 'Elige la letra que quieres entrenar o practicar.',
        position: 'bottom'
      },
      {
        id: 'batch-training',
        target: '.batch-controls',
        title: 'Entrenamiento por Lotes',
        content: 'Entrena múltiples muestras de una vez para mejor precisión.',
        position: 'top'
      },
      {
        id: 'model-training',
        target: '.model-controls',
        title: 'Entrenamiento del Modelo',
        content: 'Construye el modelo de reconocimiento con tus muestras.',
        position: 'left'
      },
      {
        id: 'live-recognition',
        target: '.prediction-display',
        title: 'Reconocimiento en Vivo',
        content: 'Ve las predicciones en tiempo real con niveles de confianza.',
        position: 'right'
      }
    ],
    vista3: [
      {
        id: 'coming-soon',
        target: 'header',
        title: 'Vista 3 - Próximamente',
        content: 'Esta vista estará disponible en futuras actualizaciones.',
        position: 'bottom'
      }
    ]
  };

  // Memoize to keep a stable reference across renders and avoid re-running effects
  const activeSteps = useMemo(() => tutorialSteps[currentView] || [], [currentView]);

  // Reset to first step every time the overlay opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setHighlightElement(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const updateHighlight = () => {
      const step = activeSteps[currentStep];
      if (!step) return;

      const element = document.querySelector(step.target);
      if (!element) {
        // If target not found, keep previous state and do not trigger updates
        return;
      }
      setHighlightElement(element);
      updateTooltipPosition(element, step.position);
    };

    updateHighlight();
    
    // Re-calculate position on resize
    const handleResize = () => updateHighlight();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  // Depend on currentStep, isOpen and currentView (activeSteps is memoized by currentView)
  }, [currentStep, isOpen, currentView]);

  const updateTooltipPosition = (element: Element, position: string) => {
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    let x = 0, y = 0;

    switch (position) {
      case 'top':
        x = rect.left + scrollLeft + rect.width / 2;
        y = rect.top + scrollTop - 20;
        break;
      case 'bottom':
        x = rect.left + scrollLeft + rect.width / 2;
        y = rect.bottom + scrollTop + 20;
        break;
      case 'left':
        x = rect.left + scrollLeft - 20;
        y = rect.top + scrollTop + rect.height / 2;
        break;
      case 'right':
        x = rect.right + scrollLeft + 20;
        y = rect.top + scrollTop + rect.height / 2;
        break;
    }

    setTooltipPosition({ x, y });
  };

  const nextStep = () => {
    if (currentStep < activeSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTutorial = () => {
    localStorage.setItem(`tutorial-completed-${currentView}`, 'true');
    onClose();
  };

  if (!isOpen) return null;

  const currentStepData = activeSteps[currentStep] || {
    id: 'fallback',
    target: 'header',
    title: 'Ayuda',
    content: 'Usa los controles y sigue las indicaciones para comenzar.',
    position: 'bottom' as const
  };


  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="tutorial-overlay"
      >
        {/* Dark overlay */}
        <div className="tutorial-backdrop" onClick={onClose} />

        {/* Highlight spotlight */}
        {highlightElement && (
          <motion.div
            className="tutorial-spotlight"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              left: highlightElement.getBoundingClientRect().left + window.scrollX,
              top: highlightElement.getBoundingClientRect().top + window.scrollY,
              width: highlightElement.getBoundingClientRect().width,
              height: highlightElement.getBoundingClientRect().height,
            }}
          />
        )}

        {/* Tooltip */}
        <motion.div
          className={`tutorial-tooltip position-${currentStepData.position}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
          }}
        >
          <div className="tooltip-header">
            <h3 className="tooltip-title">{currentStepData.title}</h3>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          
          <p className="tooltip-content">{currentStepData.content}</p>
          
          <div className="tooltip-footer">
            <div className="step-indicator">
              {currentStep + 1} de {activeSteps.length}
            </div>
            
            <div className="tooltip-actions">
              <Button
                onClick={skipTutorial}
                variant="ghost"
                size="small"
              >
                Saltar
              </Button>
              
              {currentStep > 0 && (
                <Button
                  onClick={prevStep}
                  variant="secondary"
                  size="small"
                >
                  Anterior
                </Button>
              )}
              
              <Button
                onClick={nextStep}
                variant="primary"
                size="small"
              >
                {currentStep === activeSteps.length - 1 ? 'Finalizar' : 'Siguiente'}
              </Button>
            </div>
          </div>
        </motion.div>

        <style>{`
          .tutorial-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 9999;
            pointer-events: none;
          }

          .tutorial-backdrop {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            pointer-events: all;
          }

          .tutorial-spotlight {
            position: absolute;
            border-radius: 8px;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5),
                        0 0 0 9999px rgba(0, 0, 0, 0.7);
            pointer-events: none;
            z-index: 10000;
          }

          .tutorial-tooltip {
            position: absolute;
            background: var(--surface);
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            max-width: 320px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
            pointer-events: all;
            z-index: 10001;
            transform-origin: center;
          }

          .tutorial-tooltip.position-top {
            transform: translateX(-50%) translateY(-100%);
          }

          .tutorial-tooltip.position-bottom {
            transform: translateX(-50%) translateY(0);
          }

          .tutorial-tooltip.position-left {
            transform: translateX(-100%) translateY(-50%);
          }

          .tutorial-tooltip.position-right {
            transform: translateX(0) translateY(-50%);
          }

          .tooltip-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          }

          .tooltip-title {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: var(--text);
          }

          .close-button {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--subtext);
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .close-button:hover {
            color: var(--text);
          }

          .tooltip-content {
            margin: 0 0 16px 0;
            color: var(--subtext);
            line-height: 1.5;
            font-size: 14px;
          }

          .tooltip-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .step-indicator {
            font-size: 12px;
            color: var(--subtext);
            font-weight: 500;
          }

          .tooltip-actions {
            display: flex;
            gap: 8px;
          }

          /* Arrow indicators */
          .tutorial-tooltip.position-top::after {
            content: '';
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 8px solid transparent;
            border-top-color: var(--surface);
          }

          .tutorial-tooltip.position-bottom::after {
            content: '';
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 8px solid transparent;
            border-bottom-color: var(--surface);
          }

          .tutorial-tooltip.position-left::after {
            content: '';
            position: absolute;
            left: 100%;
            top: 50%;
            transform: translateY(-50%);
            border: 8px solid transparent;
            border-left-color: var(--surface);
          }

          .tutorial-tooltip.position-right::after {
            content: '';
            position: absolute;
            right: 100%;
            top: 50%;
            transform: translateY(-50%);
            border: 8px solid transparent;
            border-right-color: var(--surface);
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
};

export default TutorialOverlay;
