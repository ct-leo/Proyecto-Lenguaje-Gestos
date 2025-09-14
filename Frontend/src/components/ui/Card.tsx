import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({ padded = true, style, className, children, ...rest }) => {
  return (
    <div
      {...rest}
      className={["card", className].filter(Boolean).join(' ')}
      style={{
        padding: padded ? 12 : 0,
        borderRadius: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Card;
