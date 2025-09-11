import React from 'react';

interface StatBoxProps {
  title: string;
  value?: string | number | null;
  children?: React.ReactNode;
}

export const StatBox: React.FC<StatBoxProps> = ({ title, value, children }) => {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: 'var(--subtext)', fontSize: 12 }}>{title}</div>
      <div
        style={{
          marginTop: 6,
          background: 'var(--code)',
          color: '#e5e7eb',
          padding: 12,
          borderRadius: 10,
          border: '1px solid var(--border)'
        }}
      >
        {children ?? value ?? '-'}
      </div>
    </div>
  );
};

export default StatBox;
