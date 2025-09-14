import React from 'react';
import Stack from './Stack';

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (key: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, value, onChange }) => {
  return (
    <Stack gap={8} style={{ marginBottom: 16 }}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              background: active ? 'var(--primary)' : 'var(--surface)',
              color: active ? '#0b1220' : 'var(--text)',
              border: '1px solid var(--border)',
              padding: '8px 12px',
              borderRadius: 10,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </Stack>
  );
};

export default Tabs;
