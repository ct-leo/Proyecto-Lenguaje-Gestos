import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SelectItem { label: string; value: string }
interface Props {
  value: string;
  options: SelectItem[];
  onChange: (val: string) => void;
  width?: number;
  placeholder?: string;
  direction?: 'up' | 'down';
}

const SelectMenu: React.FC<Props> = ({ value, options, onChange, width = 120, placeholder = 'Seleccionar', direction = 'up' }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div style={{ position: 'relative', width }}>
      <button ref={btnRef}
        className="neo-select-button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox" aria-expanded={open}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}
      >
        <span>{options.find(o => o.value === value)?.label ?? placeholder}</span>
        <span style={{ opacity: 0.8 }}>▾</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div ref={listRef}
            initial={{ opacity: 0, y: direction === 'up' ? 6 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direction === 'up' ? 6 : -6 }}
            transition={{ duration: 0.12 }}
            role="listbox"
            style={{
              position: 'absolute',
              ...(direction === 'up' ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
              left: 0,
              right: 0,
              background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12,
              boxShadow: '0 14px 34px rgba(0,0,0,.35), 0 0 12px rgba(0,245,255,.18)', overflow: 'auto', maxHeight: 260, zIndex: 30
            }}
          >
            {options.map((opt) => (
              <div key={opt.value}
                role="option" aria-selected={opt.value === value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className="neo-select-item"
                style={{
                  padding: '8px 10px', cursor: 'pointer',
                  background: opt.value === value ? 'var(--muted-surface)' : 'transparent'
                }}
              >
                {opt.label}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SelectMenu;
