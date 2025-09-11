import { useState } from 'react';
import './App.css';
import Tabs from './components/ui/Tabs';
import Vista1 from './pages/Vista1';
import Vista2 from './pages/Vista2';
import Vista3 from './pages/Vista3';
import { applyTheme, getTheme, type ThemeName } from './lib/theme';
import NeoAmbient from './components/NeoAmbient';

function App() {
  const [tab, setTab] = useState<'vista1' | 'vista2' | 'vista3'>('vista2');
  const [theme, setTheme] = useState<ThemeName>(() => getTheme());

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
      {theme === 'neo' && <NeoAmbient />}
      <header style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ margin: 0 }}>Lenguaje de Gestos</h1>
            <div style={{ color: 'var(--subtext)' }}>Frontend React + Vite + TS • MediaPipe por CDN</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: 'var(--subtext)', fontSize: 12 }}>Tema:</span>
            {(['light','dark','neo'] as ThemeName[]).map((t) => (
              <button key={t}
                onClick={() => { setTheme(t); applyTheme(t); }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: theme === t ? 'var(--primary)' : 'var(--surface)',
                  color: theme === t ? '#0b1220' : 'var(--text)'
                }}
              >
                {t === 'light' ? 'Claro' : t === 'dark' ? 'Oscuro' : 'Espacial'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <Tabs
        tabs={[
          { key: 'vista1', label: 'Vista 1' },
          { key: 'vista2', label: 'Vista 2' },
          { key: 'vista3', label: 'Vista 3' },
        ]}
        value={tab}
        onChange={(k) => setTab(k as any)}
      />

      {tab === 'vista1' && <Vista1 />}
      {tab === 'vista2' && <Vista2 />}
      {tab === 'vista3' && <Vista3 />}
    </div>
  );
}

export default App;
