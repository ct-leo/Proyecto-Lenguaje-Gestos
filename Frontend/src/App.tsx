import { useState } from 'react';
import './App.css';
import Tabs from './components/ui/Tabs';
import Vista1 from './pages/Vista1';
import Vista2 from './pages/Vista2';
import Vista3 from './pages/Vista3';
import { applyTheme, getTheme, type ThemeName } from './lib/theme';
import NeoAmbient from './components/NeoAmbient';
import ErrorBoundary from './components/ErrorBoundary';
import TutorialOverlay from './components/TutorialOverlay';
import SettingsPanel, { type AppSettings } from './components/SettingsPanel';
import Button from './components/ui/Button';
import useKeyboardNavigation from './hooks/useKeyboardNavigation';

function App() {
  const [tab, setTab] = useState<'vista1' | 'vista2' | 'vista3'>('vista1');
  const [theme, setTheme] = useState<ThemeName>(() => getTheme());
  const [showTutorial, setShowTutorial] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [_settings, setSettings] = useState<AppSettings | null>(null);

  // Previously auto-opened the tutorial for first-time users.
  // To avoid shading the entire page on initial load, we will no longer auto-open it.
  // Users can open the tutorial manually via the "Ayuda" button or keyboard shortcut.
  // useEffect(() => {
  //   const hasSeenTutorial = localStorage.getItem(`tutorial-completed-${tab}`);
  //   if (!hasSeenTutorial) {
  //     setShowTutorial(true);
  //   }
  // }, [tab]);

  // Keyboard navigation setup
  useKeyboardNavigation({
    onToggleHelp: () => setShowTutorial(true),
    onToggleSettings: () => setShowSettings(true),
    onCloseModal: () => {
      setShowTutorial(false);
      setShowSettings(false);
    },
    onNextLetter: () => {
      const tabs = ['vista1', 'vista2', 'vista3'] as const;
      const currentIndex = tabs.indexOf(tab);
      const nextIndex = (currentIndex + 1) % tabs.length;
      setTab(tabs[nextIndex]);
    },
    onPrevLetter: () => {
      const tabs = ['vista1', 'vista2', 'vista3'] as const;
      const currentIndex = tabs.indexOf(tab);
      const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
      setTab(tabs[prevIndex]);
    }
  });

  const handleSettingsChange = (newSettings: AppSettings) => {
    setSettings(newSettings);
    // Apply theme change if needed
    if (newSettings.ui.theme !== theme) {
      setTheme(newSettings.ui.theme);
      applyTheme(newSettings.ui.theme);
    }
  };

  return (
    <ErrorBoundary>
      <div style={{ padding: 0, maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
        {theme === 'neo' && <NeoAmbient />}
        
        <header style={{ marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
            <div />
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ margin: 6, fontWeight: 800 }}>Proyecto de Lenguaje de Gestos</h2>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
              <Button onClick={() => setShowTutorial(true)} variant="ghost" size="small">❓ Ayuda</Button>
              <Button onClick={() => setShowSettings(true)} variant="ghost" size="small">⚙️ Config</Button>
              {(['light','dark','neo'] as ThemeName[]).map((t) => (
                <Button
                  key={t}
                  size="small"
                  variant={theme === t ? 'primary' : 'secondary'}
                  onClick={() => { setTheme(t); applyTheme(t); }}
                >
                  {t === 'light' ? 'Claro' : t === 'dark' ? 'Oscuro' : 'Espacial'}
                </Button>
              ))}
            </div>
          </div>
        </header>

        <Tabs
          tabs={[
            { key: 'vista1', label: 'Vista 1 - Vocales' },
            { key: 'vista2', label: 'Vista 2 - Alfabeto' },
            { key: 'vista3', label: 'Vista 3 - Próximamente' },
          ]}
          value={tab}
          onChange={(k) => setTab(k as any)}
        />

        {/* Main content wrapped in ErrorBoundary for each view */}
        <ErrorBoundary>
          {tab === 'vista1' && <Vista1 />}
          {tab === 'vista2' && <Vista2 />}
          {tab === 'vista3' && <Vista3 />}
        </ErrorBoundary>

        {/* Tutorial Overlay */}
        <TutorialOverlay
          isOpen={showTutorial}
          onClose={() => setShowTutorial(false)}
          steps={[]} // Will be populated by the component based on currentView
          currentView={tab}
        />

        {/* Settings Panel */}
        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onSettingsChange={handleSettingsChange}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;
