import type { VehicleArt as Art } from '../types';

/** Görsel yüklenmemiş araçlar için şık, tema uyumlu yan profil çizimi. */
export function VehicleArt({ art, className }: { art: Art; className?: string }) {
  const body: Record<Art, { path: string; windows: string[]; wheels: [number, number]; w: number }> = {
    sedan: {
      w: 360,
      path: 'M22 118c0-14 6-22 22-26l58-12c18-22 44-36 82-36h44c26 0 46 12 66 32l30 6c14 3 22 12 22 26v14c0 6-4 10-10 10H32c-6 0-10-4-10-10z',
      windows: ['M112 80c16-18 38-28 66-28h12v30z', 'M198 52h26c20 0 36 10 50 28l-76 2z'],
      wheels: [92, 282],
    },
    van: {
      w: 380,
      path: 'M20 122V70c0-12 6-22 20-24l24-4 30-28c6-6 14-8 22-8h214c12 0 20 8 22 20l12 74c2 10 2 18 2 26v12c0 6-4 10-10 10H30c-6 0-10-4-10-10z',
      windows: ['M80 46l28-24c4-3 8-4 12-4h40v30H80z', 'M168 18h56v30h-56z', 'M232 18h56v30h-56z', 'M296 18h20c6 0 10 4 12 10l4 20h-36z'],
      wheels: [88, 302],
    },
    sprinter: {
      w: 420,
      path: 'M18 124V64c0-10 6-18 16-20l26-4 28-28c6-6 14-8 22-8h264c12 0 22 10 22 22l8 72c2 10 2 20 2 28v8c0 6-4 10-10 10H28c-6 0-10-4-10-10z',
      windows: ['M74 42l26-24c4-3 8-4 12-4h34v28H74z', 'M154 14h52v28h-52z', 'M214 14h52v28h-52z', 'M274 14h52v28h-52z', 'M334 14h22c8 0 12 4 14 12l2 16h-38z'],
      wheels: [82, 336],
    },
    bus: {
      w: 440,
      path: 'M16 126V22c0-10 8-16 18-16h372c10 0 18 8 18 18v102c0 6-4 10-10 10H26c-6 0-10-4-10-10z',
      windows: ['M30 20h50v44H30z', 'M92 20h66v44H92z', 'M170 20h66v44h-66z', 'M248 20h66v44h-66z', 'M326 20h82v44h-82z'],
      wheels: [90, 350],
    },
  };
  const b = body[art] ?? body.van;
  return (
    <svg className={className} viewBox={`0 0 ${b.w} 160`} role="img" aria-hidden="true">
      <defs>
        <linearGradient id={`bd-${art}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2e36" />
          <stop offset="1" stopColor="#111216" />
        </linearGradient>
        <linearGradient id={`gl-${art}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5d6472" stopOpacity=".9" />
          <stop offset="1" stopColor="#1b1d23" stopOpacity=".95" />
        </linearGradient>
      </defs>
      <ellipse cx={b.w / 2} cy="146" rx={b.w / 2 - 16} ry="7" fill="#000" opacity=".25" />
      <path d={b.path} fill={`url(#bd-${art})`} stroke="var(--accent)" strokeOpacity=".35" />
      {b.windows.map((w, i) => (
        <path key={i} d={w} fill={`url(#gl-${art})`} />
      ))}
      <path d={`M30 100H${b.w - 30}`} stroke="var(--accent)" strokeWidth="2" opacity=".8" />
      {b.wheels.map((x) => (
        <g key={x}>
          <circle cx={x} cy="132" r="21" fill="#0b0c0f" />
          <circle cx={x} cy="132" r="12" fill="#3a3d45" stroke="var(--accent)" strokeOpacity=".6" />
          <circle cx={x} cy="132" r="3" fill="var(--accent)" />
        </g>
      ))}
      <rect x={b.w - 30} y="96" width="12" height="6" rx="3" fill="#f6e7b8" opacity=".9" />
      <rect x="22" y="96" width="8" height="6" rx="3" fill="#b3412f" opacity=".9" />
    </svg>
  );
}
