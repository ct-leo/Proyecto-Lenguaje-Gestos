import React from 'react';
import SectionHeader from '../components/ui/SectionHeader';
import Card from '../components/ui/Card';

const Vista1: React.FC = () => {
  return (
    <div>
      <SectionHeader title="Vista 1 — Detección de Vocales" subtitle="Próximamente: flujo simplificado para A, E, I, O, U" />
      <Card>
        <p style={{ margin: 0, color: 'var(--subtext)' }}>
          Esta vista se enfocará en la detección de vocales usando el pipeline simplificado. Aquí podrás mostrar la cámara,
          botones de captura y estadísticas específicas. (Placeholder)
        </p>
      </Card>
    </div>
  );
};

export default Vista1;
