import React from 'react';

interface Option { label: string; value: string }
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Option[];
}

const Select: React.FC<SelectProps> = ({ options, className, style, ...rest }) => {
  const arrowSvg = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor'><path d='M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z'/></svg>`
  );
  return (
    <select
      {...rest}
      className={["ui-select", className].filter(Boolean).join(' ')}
      style={{
        padding: '8px 34px 8px 10px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)',
        outline: 'none',
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        backgroundImage: `url("data:image/svg+xml,${arrowSvg}")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        backgroundSize: '16px 16px',
        ...style,
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} style={{ color: 'var(--text)', background: 'var(--surface)' }}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};

export default Select;
