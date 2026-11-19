'use client';

import type { Place } from '@/lib/client';

export function PlaceSelect({ places, value, onChange, exclude, label, id }: { places: Place[]; value: string; onChange: (v: string) => void; exclude?: string; label?: string; id?: string }) {
  const campus = places.filter((p) => p.kind === 'CAMPUS');
  const hubs = places.filter((p) => p.kind !== 'CAMPUS');
  const opt = (p: Place) => <option key={p.id} value={p.id} disabled={p.id === exclude}>{p.name}</option>;
  return (
    <select id={id} aria-label={label} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select…</option>
      <optgroup label="Campus pickup points">{campus.map(opt)}</optgroup>
      <optgroup label="Transit hubs & destinations">{hubs.map(opt)}</optgroup>
    </select>
  );
}
