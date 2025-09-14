import React from 'react';
import SectionHeader from '../components/ui/SectionHeader';
import Card from '../components/ui/Card';

const Vista3: React.FC = () => {
  return (
    <div>
      <SectionHeader title="Vista 3 — Próximamente" subtitle="Espacio para nuevas funciones y flujos avanzados" />
      <Card>
        <p style={{ margin: 0, color: 'var(--subtext)' }}>
          Aquí podrás implementar características futuras como evaluación, perfiles de usuario, o reportes.
        </p>
      </Card>
    </div>
  );
};

export default Vista3;
