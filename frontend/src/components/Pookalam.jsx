import React from 'react';

// Concentric rings of petals, palette cycling outward — used cropped, as background texture.
const RINGS = [
  { r: 148, n: 32, rx: 15, ry: 26, fill: '#B31B1B', op: 0.55 },
  { r: 120, n: 26, rx: 14, ry: 24, fill: '#FF8C00', op: 0.6 },
  { r: 94, n: 20, rx: 14, ry: 22, fill: '#FFDB49', op: 0.6 },
  { r: 68, n: 16, rx: 13, ry: 20, fill: '#66B032', op: 0.55 },
  { r: 44, n: 12, rx: 12, ry: 17, fill: '#FFDB49', op: 0.5 },
];

export const Pookalam = ({ className = '' }) => (
  <svg viewBox="0 0 340 340" className={className} aria-hidden="true">
    {RINGS.map((ring, ri) =>
      Array.from({ length: ring.n }, (_, i) => {
        const angle = (360 / ring.n) * i;
        const rad = (angle * Math.PI) / 180;
        const x = 170 + ring.r * Math.cos(rad);
        const y = 170 + ring.r * Math.sin(rad);
        return (
          <ellipse
            key={`${ri}-${i}`}
            cx={x}
            cy={y}
            rx={ring.rx}
            ry={ring.ry}
            fill={ring.fill}
            opacity={ring.op}
            transform={`rotate(${angle + 90} ${x} ${y})`}
          />
        );
      })
    )}
    <circle cx="170" cy="170" r="20" fill="#B31B1B" opacity="0.6" />
    <circle cx="170" cy="170" r="9" fill="#FFDB49" opacity="0.75" />
  </svg>
);
