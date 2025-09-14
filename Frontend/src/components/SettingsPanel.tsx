import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './ui/Button';
import Modal from './ui/Modal';
import Stack from './ui/Stack';

interface AppSettings {
  camera: {
    resolution: '480p' | '720p' | '1080p';
    fps: 15 | 30 | 60;
    mirror: boolean;
    brightness: number;
    contrast: number;
  };
  recognition: {
    sensitivity: number;
    minConfidence: number;
    smoothing: boolean;
    debounceMs: number;
    maxProcessingRate: number;
  };
  accessibility: {
    highContrast: boolean;
    largeText: boolean;
    voiceEnabled: boolean;
    voiceSpeed: number;
    voiceVolume: number;
    reducedMotion: boolean;
    keyboardNavigation: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'neo';
    showFPS: boolean;
    showDebugInfo: boolean;
    compactMode: boolean;
    autoHideControls: boolean;
  };
  performance: {
    enableOptimizations: boolean;
    maxCacheSize: number;
    preloadModels: boolean;
    lowPowerMode: boolean;
  };
}

const defaultSettings: AppSettings = {
  camera: {
    resolution: '720p',
    fps: 30,
    mirror: true,
    brightness: 0,
    contrast: 0,
  },
  recognition: {
    sensitivity: 0.7,
    minConfidence: 0.5,
    smoothing: true,
    debounceMs: 100,
    maxProcessingRate: 10,
  },
  accessibility: {
    highContrast: false,
    largeText: false,
    voiceEnabled: true,
    voiceSpeed: 1.0,
    voiceVolume: 0.8,
    reducedMotion: false,
    keyboardNavigation: true,
  },
  ui: {
    theme: 'dark',
    showFPS: false,
    showDebugInfo: false,
    compactMode: false,
    autoHideControls: false,
  },
  performance: {
    enableOptimizations: true,
    maxCacheSize: 100,
    preloadModels: false,
    lowPowerMode: false,
  },
};

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: AppSettings) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  onSettingsChange
}) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [activeTab, setActiveTab] = useState<keyof AppSettings>('camera');
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('app-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  }, []);

  const updateSetting = <T extends keyof AppSettings, K extends keyof AppSettings[T]>(
    category: T,
    key: K,
    value: AppSettings[T][K]
  ) => {
    const newSettings = {
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value
      }
    };
    setSettings(newSettings);
    setHasChanges(true);
  };

  const saveSettings = () => {
    localStorage.setItem('app-settings', JSON.stringify(settings));
    onSettingsChange(settings);
    setHasChanges(false);
    
    // Apply settings immediately
    applySettings(settings);
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    setHasChanges(true);
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gestos-settings.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        setSettings({ ...defaultSettings, ...imported });
        setHasChanges(true);
      } catch (error) {
        alert('Error al importar configuración: archivo inválido');
      }
    };
    reader.readAsText(file);
  };

  const tabs = [
    { key: 'camera', label: 'Cámara', icon: '📷' },
    { key: 'recognition', label: 'Reconocimiento', icon: '🤖' },
    { key: 'accessibility', label: 'Accesibilidad', icon: '♿' },
    { key: 'ui', label: 'Interfaz', icon: '🎨' },
    { key: 'performance', label: 'Rendimiento', icon: '⚡' },
  ] as const;

  return (
    <Modal open={isOpen} onClose={onClose} title="Configuración">
      <div className="settings-panel">
        {/* Tabs */}
        <div className="settings-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="settings-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'camera' && (
                <CameraSettings settings={settings.camera} onUpdate={(key, value) => updateSetting('camera', key, value)} />
              )}
              {activeTab === 'recognition' && (
                <RecognitionSettings settings={settings.recognition} onUpdate={(key, value) => updateSetting('recognition', key, value)} />
              )}
              {activeTab === 'accessibility' && (
                <AccessibilitySettings settings={settings.accessibility} onUpdate={(key, value) => updateSetting('accessibility', key, value)} />
              )}
              {activeTab === 'ui' && (
                <UISettings settings={settings.ui} onUpdate={(key, value) => updateSetting('ui', key, value)} />
              )}
              {activeTab === 'performance' && (
                <PerformanceSettings settings={settings.performance} onUpdate={(key, value) => updateSetting('performance', key, value)} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="settings-actions">
          <div className="action-group">
            <input
              type="file"
              accept=".json"
              onChange={importSettings}
              style={{ display: 'none' }}
              id="import-settings"
            />
            <Button
              onClick={() => document.getElementById('import-settings')?.click()}
              variant="ghost"
              size="small"
            >
              Importar
            </Button>
            <Button
              onClick={exportSettings}
              variant="ghost"
              size="small"
            >
              Exportar
            </Button>
            <Button
              onClick={resetSettings}
              variant="ghost"
              size="small"
            >
              Resetear
            </Button>
          </div>

          <div className="action-group">
            <Button onClick={onClose} variant="secondary">
              Cancelar
            </Button>
            <Button
              onClick={saveSettings}
              variant="primary"
              disabled={!hasChanges}
            >
              Guardar Cambios
            </Button>
          </div>
        </div>

        <style>{`
          .settings-panel {
            width: 100%;
            max-width: 600px;
            height: 70vh;
            display: flex;
            flex-direction: column;
          }

          .settings-tabs {
            display: flex;
            border-bottom: 1px solid var(--border);
            margin-bottom: 20px;
            overflow-x: auto;
          }

          .tab {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            border: none;
            background: none;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
            white-space: nowrap;
          }

          .tab:hover {
            background: var(--surface);
          }

          .tab.active {
            border-bottom-color: var(--primary);
            color: var(--primary);
          }

          .tab-icon {
            font-size: 16px;
          }

          .tab-label {
            font-size: 14px;
            font-weight: 500;
          }

          .settings-content {
            flex: 1;
            overflow-y: auto;
            padding-right: 8px;
          }

          .settings-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 20px;
            border-top: 1px solid var(--border);
            margin-top: 20px;
          }

          .action-group {
            display: flex;
            gap: 8px;
          }
        `}</style>
      </div>
    </Modal>
  );
};

// Individual setting components
const CameraSettings: React.FC<{
  settings: AppSettings['camera'];
  onUpdate: (key: keyof AppSettings['camera'], value: any) => void;
}> = ({ settings, onUpdate }) => (
  <Stack gap={16}>
    <div className="setting-group">
      <label>Resolución</label>
      <select value={settings.resolution} onChange={(e) => onUpdate('resolution', e.target.value)}>
        <option value="480p">480p (640x480)</option>
        <option value="720p">720p (1280x720)</option>
        <option value="1080p">1080p (1920x1080)</option>
      </select>
    </div>

    <div className="setting-group">
      <label>FPS</label>
      <select value={settings.fps} onChange={(e) => onUpdate('fps', parseInt(e.target.value))}>
        <option value={15}>15 FPS</option>
        <option value={30}>30 FPS</option>
        <option value={60}>60 FPS</option>
      </select>
    </div>

    <div className="setting-group">
      <label>
        <input
          type="checkbox"
          checked={settings.mirror}
          onChange={(e) => onUpdate('mirror', e.target.checked)}
        />
        Espejo horizontal
      </label>
    </div>

    <div className="setting-group">
      <label>Brillo: {settings.brightness}</label>
      <input
        type="range"
        min="-100"
        max="100"
        value={settings.brightness}
        onChange={(e) => onUpdate('brightness', parseInt(e.target.value))}
      />
    </div>

    <div className="setting-group">
      <label>Contraste: {settings.contrast}</label>
      <input
        type="range"
        min="-100"
        max="100"
        value={settings.contrast}
        onChange={(e) => onUpdate('contrast', parseInt(e.target.value))}
      />
    </div>
  </Stack>
);

const RecognitionSettings: React.FC<{
  settings: AppSettings['recognition'];
  onUpdate: (key: keyof AppSettings['recognition'], value: any) => void;
}> = ({ settings, onUpdate }) => (
  <Stack gap={16}>
    <div className="setting-group">
      <label>Sensibilidad: {Math.round(settings.sensitivity * 100)}%</label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={settings.sensitivity}
        onChange={(e) => onUpdate('sensitivity', parseFloat(e.target.value))}
      />
    </div>

    <div className="setting-group">
      <label>Confianza mínima: {Math.round(settings.minConfidence * 100)}%</label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={settings.minConfidence}
        onChange={(e) => onUpdate('minConfidence', parseFloat(e.target.value))}
      />
    </div>

    <div className="setting-group">
      <label>
        <input
          type="checkbox"
          checked={settings.smoothing}
          onChange={(e) => onUpdate('smoothing', e.target.checked)}
        />
        Suavizado de resultados
      </label>
    </div>

    <div className="setting-group">
      <label>Debounce (ms): {settings.debounceMs}</label>
      <input
        type="range"
        min="50"
        max="500"
        step="50"
        value={settings.debounceMs}
        onChange={(e) => onUpdate('debounceMs', parseInt(e.target.value))}
      />
    </div>

    <div className="setting-group">
      <label>Tasa máxima de procesamiento: {settings.maxProcessingRate} FPS</label>
      <input
        type="range"
        min="5"
        max="30"
        step="5"
        value={settings.maxProcessingRate}
        onChange={(e) => onUpdate('maxProcessingRate', parseInt(e.target.value))}
      />
    </div>
  </Stack>
);

const AccessibilitySettings: React.FC<{
  settings: AppSettings['accessibility'];
  onUpdate: (key: keyof AppSettings['accessibility'], value: any) => void;
}> = ({ settings, onUpdate }) => (
  <Stack gap={16}>
    <div className="setting-group">
      <label>
        <input
          type="checkbox"
          checked={settings.highContrast}
          onChange={(e) => onUpdate('highContrast', e.target.checked)}
        />
        Alto contraste
      </label>
    </div>

    <div className="setting-group">
      <label>
        <input
          type="checkbox"
          checked={settings.largeText}
          onChange={(e) => onUpdate('largeText', e.target.checked)}
        />
        Texto grande
      </label>
    </div>

    <div className="setting-group">
      <label>
        <input
          type="checkbox"
          checked={settings.voiceEnabled}
          onChange={(e) => onUpdate('voiceEnabled', e.target.checked)}
        />
        Síntesis de voz
      </label>
    </div>

    <div className="setting-group">
      <label>Velocidad de voz: {settings.voiceSpeed}x</label>
      <input
        type="range"
        min="0.5"
        max="2"
        step="0.1"
        value={settings.voiceSpeed}
        onChange={(e) => onUpdate('voiceSpeed', parseFloat(e.target.value))}
        disabled={!settings.voiceEnabled}
      />
    </div>

    <div className="setting-group">
      <label>Volumen: {Math.round(settings.voiceVolume * 100)}%</label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={settings.voiceVolume}
        onChange={(e) => onUpdate('voiceVolume', parseFloat(e.target.value))}
        disabled={!settings.voiceEnabled}
      />
    </div>

    <div className="setting-group">
      <label>
        <input
          type="checkbox"
          checked={settings.reducedMotion}
          onChange={(e) => onUpdate('reducedMotion', e.target.checked)}
        />
        Reducir animaciones
      </label>
    </div>

    <div className="setting-group">
      <label>
        <input
          type="checkbox"
          checked={settings.keyboardNavigation}
          onChange={(e) => onUpdate('keyboardNavigation', e.target.checked)}
        />
        Navegación por teclado
      </label>
    </div>
  </Stack>
);

const UISettings: React.FC<{
  settings: AppSettings['ui'];
  onUpdate: (key: keyof AppSettings['ui'], value: any) => void;
}> = ({ settings, onUpdate }) => (
  <Stack gap={16}>
    <div className="setting-group">
      <label>Tema</label>
      <select value={settings.theme} onChange={(e) => onUpdate('theme', e.target.value)}>
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
        <option value="neo">Espacial</option>
      </select>
    </div>

    <div className="setting-group">
      <label>
        <input
          type="checkbox"
          checked={settings.showFPS}
          onChange={(e) => onUpdate('showFPS', e.target.checked)}
        />
        Mostrar FPS
      </label>
    </div>

    <div className="setting-group">
      <label>
        <input
          type="checkbox"
          checked={settings.showDebugInfo}
          onChange={(e) => onUpdate('showDebugInfo', e.target.checked)}
        />
        Información de debug
      </label>
    </div>

    <div className="setting-group">
      <label>
        <input
          type="checkbox"
          checked={settings.compactMode}
          onChange={(e) => onUpdate('compactMode', e.target.checked)}
        />
        Modo compacto
      </label>
    </div>

    <div className="setting-group">
      <label>
        <input
          type="checkbox"
          checked={settings.autoHideControls}
          onChange={(e) => onUpdate('autoHideControls', e.target.checked)}
        />
        Ocultar controles automáticamente
      </label>
    </div>
  </Stack>
);

const PerformanceSettings: React.FC<{
  settings: AppSettings['performance'];
  onUpdate: (key: keyof AppSettings['performance'], value: any) => void;
}> = ({ settings, onUpdate }) => (
  <Stack gap={16}>
    <div className="setting-group">
      <label>
        <input
          type="checkbox"
          checked={settings.enableOptimizations}
          onChange={(e) => onUpdate('enableOptimizations', e.target.checked)}
        />
        Optimizaciones avanzadas
      </label>
    </div>

    <div className="setting-group">
      <label>Tamaño máximo de caché: {settings.maxCacheSize}</label>
      <input
        type="range"
        min="50"
        max="500"
        step="50"
        value={settings.maxCacheSize}
        onChange={(e) => onUpdate('maxCacheSize', parseInt(e.target.value))}
      />
    </div>

    <div className="setting-group">
      <label>
        <input
          type="checkbox"
          checked={settings.preloadModels}
          onChange={(e) => onUpdate('preloadModels', e.target.checked)}
        />
        Precargar modelos
      </label>
    </div>

    <div className="setting-group">
      <label>
        <input
          type="checkbox"
          checked={settings.lowPowerMode}
          onChange={(e) => onUpdate('lowPowerMode', e.target.checked)}
        />
        Modo de bajo consumo
      </label>
    </div>
  </Stack>
);

// Apply settings to the DOM
function applySettings(settings: AppSettings) {
  const root = document.documentElement;
  
  // Apply accessibility settings
  if (settings.accessibility.highContrast) {
    root.classList.add('high-contrast');
  } else {
    root.classList.remove('high-contrast');
  }
  
  if (settings.accessibility.largeText) {
    root.classList.add('large-text');
  } else {
    root.classList.remove('large-text');
  }
  
  if (settings.accessibility.reducedMotion) {
    root.classList.add('reduced-motion');
  } else {
    root.classList.remove('reduced-motion');
  }
  
  // Apply UI settings
  if (settings.ui.compactMode) {
    root.classList.add('compact-mode');
  } else {
    root.classList.remove('compact-mode');
  }
}

export default SettingsPanel;
export type { AppSettings };
