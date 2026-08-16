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

// Mango-leaf thoran — the garland strung across a doorway at Onam.
export const Thoran = ({ className = '' }) => (
  <svg viewBox="0 0 360 46" className={className} aria-hidden="true">
    <path d="M0 6 Q 180 30 360 6" stroke="#C9962B" strokeWidth="1.5" fill="none" />
    {Array.from({ length: 17 }, (_, i) => {
      const t = i / 16;
      const x = t * 360;
      // follow the sag of the quadratic string above
      const y = 6 + 2 * (1 - t) * t * 24;
      const long = i % 2 === 0;
      return (
        <ellipse
          key={i}
          cx={x}
          cy={y + (long ? 16 : 12)}
          rx={5.5}
          ry={long ? 17 : 13}
          fill={long ? '#2F6B18' : '#66B032'}
          opacity={0.75}
        />
      );
    })}
  </svg>
);

// Full-page ornament layer: pookalam medallions bleeding off the edges so wide
// screens have something in the gutters. Fixed + non-interactive.
export const FestivalBackdrop = () => (
  <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
    <Pookalam className="absolute -left-40 top-20 h-[420px] w-[420px] opacity-[0.14] lg:-left-32 lg:h-[520px] lg:w-[520px]" />
    <Pookalam className="absolute -right-44 bottom-10 h-[380px] w-[380px] opacity-[0.12] lg:-right-36 lg:h-[480px] lg:w-[480px]" />
    <Pookalam className="absolute -right-24 -top-28 hidden h-[260px] w-[260px] opacity-[0.10] xl:block" />
    <Pookalam className="absolute -left-20 -bottom-32 hidden h-[240px] w-[240px] opacity-[0.10] xl:block" />
  </div>
);
