'use client';

type P = { lat: number; lng: number };

/** Lightweight offline route visual (no map tiles / external requests): polyline with live vehicle marker. */
export function RouteMap({ route, position, origin, dest, progress, vehicleLabel }: { route: P[]; position: P; origin: string; dest: string; progress: number; vehicleLabel?: string }) {
  const W = 520, H = 260, PAD = 40;
  const lat0 = route[0].lat;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = route.map((p) => p.lng * kx), ys = route.map((p) => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(1e-6, maxX - minX), spanY = Math.max(1e-6, maxY - minY);
  const s = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const offX = (W - spanX * s) / 2, offY = (H - spanY * s) / 2;
  const pt = (p: P) => ({ x: offX + (p.lng * kx - minX) * s, y: offY + (-p.lat - minY) * s });
  const pts = route.map(pt);
  const cur = pt(position);
  const all = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  // travelled part of the polyline: points up to the marker
  const total = pts.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0) || 1;
  let acc = 0; const done = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc + seg <= total * progress) { done.push(pts[i]); acc += seg; } else break;
  }
  done.push(cur);
  const doneStr = done.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const a = pts[0], b = pts[pts.length - 1];
  const labelAnchor = (x: number) => (x > W - 120 ? 'end' : x < 120 ? 'start' : 'middle');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-2xl bg-gradient-to-br from-emerald-50 via-slate-50 to-sky-50" role="img" aria-label={`Route from ${origin} to ${dest}, ${Math.round(progress * 100)}% complete`}>
      <defs><pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="#e2e8f0" strokeWidth="1" /></pattern></defs>
      <rect width={W} height={H} fill="url(#grid)" opacity=".7" />
      <polyline points={all} fill="none" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={all} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="6 8" strokeLinecap="round" />
      <polyline points={doneStr} fill="none" stroke="#4f46e5" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={a.x} cy={a.y} r="9" fill="#10b981" stroke="#fff" strokeWidth="3" />
      <circle cx={b.x} cy={b.y} r="9" fill="#dc2626" stroke="#fff" strokeWidth="3" />
      <text x={a.x} y={a.y + (cur.y < a.y - 10 ? 26 : -16)} fontSize="12" fontWeight="700" fill="#0f172a" textAnchor={labelAnchor(a.x)}>{origin.length > 26 ? origin.slice(0, 25) + '…' : origin}</text>
 <text x={b.x} y={b.y + (cur.y > b.y + 10 ? -16 : 26)} fontSize="12" fontWeight="700" fill="#0f172a" textAnchor={labelAnchor(b.x)}>{dest.length > 26 ? dest.slice(0, 25) + '…' : dest}</text>
      <g transform={`translate(${cur.x} ${cur.y})`}>
        <circle r="16" fill="#4f46e5" opacity=".18"><animate attributeName="r" values="10;20;10" dur="2s" repeatCount="indefinite" /></circle>
        <circle r="9" fill="#312e81" stroke="#fff" strokeWidth="3" />
        {vehicleLabel && progress > 0.05 && progress < 0.8 && <text y="-16" fontSize="10" fontWeight="700" fill="#312e81" textAnchor="middle">{vehicleLabel}</text>}
      </g>
    </svg>
  );
}
