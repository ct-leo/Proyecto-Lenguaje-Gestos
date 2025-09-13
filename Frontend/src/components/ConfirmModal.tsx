import React from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';

type ConfirmModalProps = {
  open: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({ open, title = 'Confirmación', message = 'Operación realizada con éxito', onClose }) => {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Aceptar</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
