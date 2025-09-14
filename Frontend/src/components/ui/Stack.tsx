import React from 'react';

interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'column';
  gap?: number;
  align?: React.CSSProperties['alignItems'];
  justify?: React.CSSProperties['justifyContent'];
  wrap?: boolean;
}

export const Stack: React.FC<StackProps> = ({
  direction = 'row',
  gap = 8,
  align,
  justify,
  wrap = false,
  style,
  children,
  ...rest
}) => {
  return (
    <div
      {...rest}
      style={{
        display: 'flex',
        flexDirection: direction,
        gap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Stack;
