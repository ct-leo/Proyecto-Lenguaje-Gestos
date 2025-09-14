import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface HandStatusIndicatorProps {
  hasHands: boolean;
  confidence: number;
  isProcessing?: boolean;
  detectedLetter?: string | null;
}

const HandStatusIndicator: React.FC<HandStatusIndicatorProps> = ({
  hasHands,
  confidence,
  isProcessing = false,
  detectedLetter
}) => {
  const getStatusColor = () => {
    if (!hasHands) return '#ef4444'; // red-500
    if (confidence < 0.3) return '#f59e0b'; // amber-500
    if (confidence < 0.7) return '#3b82f6'; // blue-500
    return '#10b981'; // emerald-500
  };

  const getStatusText = () => {
    if (isProcessing) return 'Procesando...';
    if (!hasHands) return 'Sin mano detectada';
    if (confidence < 0.3) return 'Posición inestable';
    if (confidence < 0.7) return 'Buena detección';
    return 'Excelente detección';
  };

  return (
    <div className="hand-status-indicator">
      <div className="status-header">
        <motion.div 
          className="status-dot"
          animate={{ 
            backgroundColor: getStatusColor(),
            scale: hasHands ? [1, 1.2, 1] : 1
          }}
          transition={{ 
            backgroundColor: { duration: 0.3 },
            scale: { duration: 0.6, repeat: hasHands ? Infinity : 0 }
          }}
        />
        <span className="status-text">{getStatusText()}</span>
      </div>

      <AnimatePresence>
        {hasHands && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="confidence-section"
          >
            <div className="confidence-label">
              Confianza: {Math.round(confidence * 100)}%
            </div>
            <div className="confidence-bar">
              <motion.div 
                className="confidence-fill"
                initial={{ width: 0 }}
                animate={{ width: `${confidence * 100}%` }}
                transition={{ duration: 0.3 }}
                style={{ backgroundColor: getStatusColor() }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detectedLetter && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="detected-letter-badge"
          >
            <span className="letter">{detectedLetter}</span>
            <span className="label">Detectada</span>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .hand-status-indicator {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .status-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          box-shadow: 0 0 8px rgba(0, 0, 0, 0.2);
        }

        .status-text {
          font-weight: 500;
          color: var(--text);
          font-size: 14px;
        }

        .confidence-section {
          margin-top: 12px;
        }

        .confidence-label {
          font-size: 12px;
          color: var(--subtext);
          margin-bottom: 6px;
        }

        .confidence-bar {
          height: 6px;
          background: var(--border);
          border-radius: 3px;
          overflow: hidden;
        }

        .confidence-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .detected-letter-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          padding: 8px 12px;
          background: var(--primary);
          color: white;
          border-radius: 8px;
          font-weight: 600;
        }

        .letter {
          font-size: 18px;
          font-weight: 700;
        }

        .label {
          font-size: 12px;
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
};

export default HandStatusIndicator;
