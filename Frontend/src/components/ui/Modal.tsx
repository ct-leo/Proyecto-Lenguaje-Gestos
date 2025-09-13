import React from 'react';

export type ModalProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  width?: number | string;
  className?: string;
};

const Modal: React.FC<ModalProps> = ({ open, title, onClose, actions, children, width = 520, className }) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', padding: 12,
      }}
      onClick={onClose}
      className="fade-in"
    >
      <div
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          maxWidth: '96vw', background: '#fff', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.35)'
        }}
        onClick={(e) => e.stopPropagation()}
        className={["scale-in","shadow-hover", className].filter(Boolean).join(' ')}
      >
        {title && (
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e9ecef', fontWeight: 700 }}>{title}</div>
        )}
        <div style={{ padding: 18 }}>{children}</div>
        {actions && (
          <div style={{ padding: 12, borderTop: '1px solid #e9ecef', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
