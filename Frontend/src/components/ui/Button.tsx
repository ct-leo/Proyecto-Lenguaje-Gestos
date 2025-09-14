import React, { useState } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'small' | 'medium' | 'large';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const styles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--primary)',
    borderColor: 'var(--primary-700)',
    color: 'var(--on-primary)',
  },
  secondary: {
    background: 'var(--surface)',
    borderColor: 'var(--border)',
    color: 'var(--text)',
  },
  danger: {
    background: 'var(--danger)',
    borderColor: 'var(--danger-600)',
    color: '#fff',
  },
  ghost: {
    background: 'transparent',
    borderColor: 'var(--border)',
    color: 'var(--text)',
  },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  small: {
    padding: '4px 8px',
    fontSize: '12px',
  },
  medium: {
    padding: '8px 16px',
    fontSize: '14px',
  },
  large: {
    padding: '12px 24px',
    fontSize: '16px',
  },
};

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'medium', fullWidth = false, style, children, ...rest }) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Derive dynamic styles for hover/active that respect theme variables
  const base = styles[variant];
  const hoverStyles: React.CSSProperties = (() => {
    switch (variant) {
      case 'primary':
        return { filter: 'brightness(0.95)', borderColor: 'var(--primary-700)' };
      case 'danger':
        return { filter: 'brightness(0.95)', borderColor: 'var(--danger-600)' };
      case 'secondary':
      case 'ghost':
        return { background: 'var(--hover-surface)' };
    }
  })();
  const activeStyles: React.CSSProperties = hovered ? (variant === 'primary' || variant === 'danger' ? { filter: 'brightness(0.9)' } : { filter: 'brightness(0.98)' }) : {};

  return (
    <button
      type={(rest as any).type ?? 'button'}
      {...rest}
      onMouseEnter={(e) => { setHovered(true); rest.onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHovered(false); setPressed(false); rest.onMouseLeave?.(e); }}
      onMouseDown={(e) => { setPressed(true); rest.onMouseDown?.(e); }}
      onMouseUp={(e) => { setPressed(false); rest.onMouseUp?.(e); }}
      style={{
        ...base,
        ...sizeStyles[size],
        display: fullWidth ? 'block' as const : undefined,
        width: fullWidth ? '100%' : undefined,
        border: '1px solid',
        borderRadius: '6px',
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        opacity: rest.disabled ? 0.6 : 1,
        fontWeight: 500,
        transition: 'all 0.15s ease',
        ...(hovered ? hoverStyles : {}),
        ...(pressed ? activeStyles : {}),
        ...style,
      }}
    >
      {children}
    </button>
  );
};

export default Button;
