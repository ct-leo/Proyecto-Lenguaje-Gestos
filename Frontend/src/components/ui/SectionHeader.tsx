import React from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle }) => {
  return (
    <div style={{ textAlign: 'center', marginBottom: 8 }}>
      <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{title}</h2>
      {subtitle && (
        <div style={{ marginTop: 2, color: 'var(--subtext)', fontSize: 14 }}>{subtitle}</div>
      )}
    </div>
  );
};

export default SectionHeader;
