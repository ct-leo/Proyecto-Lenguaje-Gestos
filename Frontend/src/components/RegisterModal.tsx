import React, { useMemo, useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';

export type RegisterModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (letter: 'A'|'E'|'I'|'O'|'U') => void;
};

const INSTRUCTIONS: Record<'A'|'E'|'I'|'O'|'U', string[]> = {
  A: [
    'Pulgar extendido',
    'Resto de dedos cerrados',
    'Mantén la mano estable'
  ],
  E: [
    'Todos los dedos extendidos',
    'Palma visible al frente',
    'Evita inclinar la muñeca'
  ],
  I: [
    'Índice y medio extendidos',
    'Pulgar, anular y meñique doblados',
    'Mantén los dedos separados'
  ],
  O: [
    'Forma un círculo con pulgar e índice',
    'Resto de dedos curvados',
    'Cierra bien la “O” sin tapar la cámara'
  ],
  U: [
    'Índice y medio juntos y extendidos',
    'Resto de dedos doblados',
    'Mantén los dedos bien pegados'
  ],
};

const RegisterModal: React.FC<RegisterModalProps> = ({ open, onClose, onConfirm }) => {
  const [current, setCurrent] = useState<'A'|'E'|'I'|'O'|'U'>('A');
  const tips = useMemo(() => INSTRUCTIONS[current], [current]);

  return (
    <Modal open={open} onClose={onClose} title="Registrar muestras">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {(['A','E','I','O','U'] as const).map((L) => (
            <button
              key={L}
              onClick={() => setCurrent(L)}
              style={{
                padding: '10px 14px', borderRadius: 8, border: current === L ? '2px solid #0d6efd' : '1px solid #ced4da',
                background: current === L ? '#e7f1ff' : '#fff', minWidth: 60, fontWeight: 700, cursor: 'pointer'
              }}
            >{L}</button>
          ))}
        </div>
        <div style={{ background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Instrucciones para "{current}"</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {tips.map((t, i) => (<li key={i}>{t}</li>))}
          </ul>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onConfirm(current)}>Comenzar registro</Button>
        </div>
      </div>
    </Modal>
  );
};

export default RegisterModal;
