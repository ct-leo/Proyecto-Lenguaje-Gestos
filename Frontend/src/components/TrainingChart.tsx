import React, { useMemo } from 'react';

type TrainingChartProps = {
  series: number[]; // values 0..100
  height?: number;
};

const TrainingChart: React.FC<TrainingChartProps> = ({ series, height = 160 }) => {
  const points = useMemo(() => {
    const n = Math.max(2, series.length);
    const w = 600; // logical width; SVG is responsive via viewBox
    const h = height;
    const stepX = w / (n - 1);
    return series.map((v, i) => {
      const x = i * stepX;
      const clamped = Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
      const y = h - (clamped / 100) * (h - 20) - 10; // padding 10 top/bottom
      return `${x},${y}`;
    }).join(' ');
  }, [series, height]);

  const gradientId = 'trainingLineGradient';

  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 640 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0d6efd" />
            <stop offset="50%" stopColor="#6f42c1" />
            <stop offset="100%" stopColor="#198754" />
          </linearGradient>
        </defs>
        {/* background grid */}
        <g stroke="#e9ecef" strokeWidth={1}>
          <line x1={40} y1={10} x2={620} y2={10} />
          <line x1={40} y1={height/2} x2={620} y2={height/2} />
          <line x1={40} y1={height-10} x2={620} y2={height-10} />
          {/* Y-axis */}
          <line x1={40} y1={10} x2={40} y2={height-10} />
          {/* X-axis */}
          <line x1={40} y1={height-10} x2={620} y2={height-10} />
        </g>
        {/* Y ticks and labels */}
        <g fill="#6c757d" fontSize={10}>
          {[0,25,50,75,100].map((v) => {
            const y = height - (v/100)*(height-20) - 10;
            return (
              <g key={v}>
                <line x1={36} y1={y} x2={40} y2={y} stroke="#adb5bd" />
                <text x={30} y={y+3} textAnchor="end">{v}</text>
              </g>
            )
          })}
        </g>
        {/* X ticks (start, mid, end) */}
        <g fill="#6c757d" fontSize={10}>
          {['0', `${Math.max(1, series.length-1) >> 1}`, `${Math.max(1, series.length-1)}`].map((label, idx) => {
            const x = idx === 0 ? 40 : (idx === 1 ? 330 : 620);
            return (
              <g key={idx}>
                <line x1={x} y1={height-10} x2={x} y2={height-6} stroke="#adb5bd" />
                <text x={x} y={height} textAnchor="middle">{label}</text>
              </g>
            )
          })}
        </g>
        {/* area under curve */}
        <polyline
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="3"
          points={points}
          transform="translate(40,0) scale(0.966,1)" /* fit inside axes */
        />
      </svg>
      <div style={{ fontSize: 12, color: '#6c757d', textAlign: 'right' }}>0% → 100%</div>
    </div>
  );
};

export default TrainingChart;
