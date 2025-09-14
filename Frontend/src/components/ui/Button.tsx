import React from 'react';

type Variant = 'primary' | 'danger' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const styles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--primary)',
    borderColor: 'var(--primary-700)',
    color: '#0b1220',
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

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', fullWidth = false, style, children, ...rest }) => {
  return (
    <button
      {...rest}
      style={{
        ...styles[variant],
        display: fullWidth ? 'block' as const : undefined,
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
    >
      {children}
    </button>
  );
};

export default Button;
