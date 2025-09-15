import React, { Component, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import Button from './ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorType: 'mediapipe' | 'camera' | 'general' | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    let errorType: State['errorType'] = 'general';
    
    if (error.message.includes('MediaPipe') || error.message.includes('hands')) {
      errorType = 'mediapipe';
    } else if (error.message.includes('camera') || error.message.includes('getUserMedia')) {
      errorType = 'camera';
    }

    return {
      hasError: true,
      error,
      errorType
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error para debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  getErrorContent() {
    const { errorType } = this.state;

    switch (errorType) {
      case 'mediapipe':
        return {
          title: 'Error de MediaPipe',
          message: 'Hubo un problema al cargar el sistema de reconocimiento de manos.',
          suggestions: [
            'Verifica tu conexión a internet',
            'Recarga la página',
            'Prueba con un navegador diferente'
          ],
          icon: '🤖'
        };
      
      case 'camera':
        return {
          title: 'Error de Cámara',
          message: 'No se pudo acceder a la cámara de tu dispositivo.',
          suggestions: [
            'Permite el acceso a la cámara en tu navegador',
            'Verifica que no haya otras aplicaciones usando la cámara',
            'Prueba recargando la página'
          ],
          icon: '📷'
        };
      
      default:
        return {
          title: 'Error Inesperado',
          message: 'Algo salió mal. Por favor, intenta nuevamente.',
          suggestions: [
            'Recarga la página',
            'Limpia la caché del navegador',
            'Contacta al soporte si el problema persiste'
          ],
          icon: '⚠️'
        };
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorContent = this.getErrorContent();

      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="error-boundary"
        >
          <div className="error-content">
            <div className="error-icon">{errorContent.icon}</div>
            <h2 className="error-title">{errorContent.title}</h2>
            <p className="error-message">{errorContent.message}</p>
            
            <div className="error-suggestions">
              <h3>Posibles soluciones:</h3>
              <ul>
                {errorContent.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>

            <div className="error-actions">
              <Button onClick={this.handleRetry} variant="primary">
                Intentar Nuevamente
              </Button>
              <Button onClick={this.handleReload} variant="secondary">
                Recargar Página
              </Button>
            </div>

            {import.meta.env.MODE === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Detalles técnicos (desarrollo)</summary>
                <pre className="error-stack">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>

          <style>{`
            .error-boundary {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 400px;
              padding: 20px;
              background: var(--surface);
              border: 1px solid var(--border);
              border-radius: 12px;
              margin: 20px 0;
            }

            .error-content {
              text-align: center;
              max-width: 500px;
            }

            .error-icon {
              font-size: 48px;
              margin-bottom: 16px;
            }

            .error-title {
              color: var(--text);
              margin-bottom: 8px;
              font-size: 24px;
              font-weight: 600;
            }

            .error-message {
              color: var(--subtext);
              margin-bottom: 24px;
              font-size: 16px;
              line-height: 1.5;
            }

            .error-suggestions {
              text-align: left;
              margin-bottom: 24px;
              padding: 16px;
              background: var(--background);
              border-radius: 8px;
              border: 1px solid var(--border);
            }

            .error-suggestions h3 {
              margin: 0 0 12px 0;
              font-size: 14px;
              font-weight: 600;
              color: var(--text);
            }

            .error-suggestions ul {
              margin: 0;
              padding-left: 20px;
            }

            .error-suggestions li {
              margin-bottom: 4px;
              color: var(--subtext);
              font-size: 14px;
            }

            .error-actions {
              display: flex;
              gap: 12px;
              justify-content: center;
              flex-wrap: wrap;
            }

            .error-details {
              margin-top: 24px;
              text-align: left;
            }

            .error-details summary {
              cursor: pointer;
              color: var(--subtext);
              font-size: 12px;
              margin-bottom: 8px;
            }

            .error-stack {
              background: #1a1a1a;
              color: #ff6b6b;
              padding: 12px;
              border-radius: 4px;
              font-size: 11px;
              overflow-x: auto;
              white-space: pre-wrap;
              max-height: 200px;
              overflow-y: auto;
            }
          `}</style>
        </motion.div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
