import React from 'react';

interface NumberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const NumberInput: React.FC<NumberInputProps> = ({ style, ...rest }) => {
  return (
    <input
      type="number"
      {...rest}
      style={{
        padding: '8px 10px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)',
        width: 90,
        ...style,
      }}
    />
  );
};

export default NumberInput;
