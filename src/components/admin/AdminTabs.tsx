'use client';

import { useEffect, useState } from 'react';
import { MapPin, Trash2, Truck } from 'lucide-react';
import { useToast } from '@/components/Providers';
import { EmptyState, ErrorBox, Field, PageLoader, SectionTitle } from '@/components/ui';
import { api } from '@/lib/client';
import { useData } from '@/lib/useData';

type Place = { id: string; code: string; name: string; kind: string; city: string; lat: number; lng: number; isPublic: boolean };

export function PlacesTab() {
  const p = useData<{ places: Place[] }>('/api/admin/places');
  const toast = useToast();
  const empty = { code: '', name: '', kind: 'CAMPUS', city: '', lat: '', lng: '' };
  const [f, setF] = useState(empty);
  async function run(fn: () => Promise<unknown>, msg: string) { try { await fn(); toast.push('success', msg); p.reload(); } catch (e) { toast.push('error', (e as Error).message); } }
  if (p.loading && !p.data) return <PageLoader />;
  if (p.error || !p.data) return <ErrorBox message={p.error || 'Failed'} onRetry={p.reload} />;
  return (
    <div className="space-y-5">
      <SectionTitle title="Pickup points & hubs" sub="Only these public places can be chosen by students — never home addresses." action={<button className="btn-secondary btn-sm" onClick={() => confirm('Add the IIITA starter list from the project brief? Coordinates are approximate — verify them afterwards.') && run(() => api('/api/admin/places/starter', { body: {} }), 'Starter places added')}>Load IIITA starter list</button>} />
      <form className="card grid gap-3 p-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); void run(async () => { await api('/api/admin/places', { body: { ...f, lat: Number(f.lat), lng: Number(f.lng) } }); setF(empty); }, 'Place added'); }}>
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required placeholder="IIITA Main Gate (Gate 1)" /></Field>
        <Field label="Short code"><input className="input font-mono uppercase" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} required placeholder="IIITA-G1" /></Field>
        <Field label="Type"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{['CAMPUS', 'STATION', 'AIRPORT', 'BUS', 'HOME_HUB'].map((k) => <option key={k}>{k}</option>)}</select></Field>
        <Field label="City"><input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} required /></Field>
        <Field label="Latitude"><input className="input" inputMode="decimal" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} required placeholder="25.4285" /></Field>
        <Field label="Longitude"><input className="input" inputMode="decimal" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} required placeholder="81.7712" /></Field>
        <button className="btn-primary sm:col-span-3"><MapPin className="h-4 w-4" />Add place</button>
      </form>
      {p.data.places.length === 0 ? <EmptyState icon={<MapPin className="h-6 w-6" />} title="No places yet" hint="Add at least one campus pickup point and one destination so students can plan trips." /> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2 text-left">Name</th><th className="text-left">Type</th><th className="text-left">Lat, Lng</th><th className="text-center">Active</th><th /></tr></thead>
          <tbody>{p.data.places.map((x) => <tr key={x.id} className="border-t border-slate-100"><td className="px-4 py-2"><div className="font-semibold">{x.name}</div><div className="font-mono text-xs text-slate-400">{x.code} · {x.city}</div></td><td>{x.kind}</td><td className="font-mono text-xs">{x.lat.toFixed(4)}, {x.lng.toFixed(4)}</td>
            <td className="text-center"><input type="checkbox" checked={x.isPublic} onChange={(e) => run(() => api(`/api/admin/places/${x.id}`, { method: 'PATCH', body: { isPublic: e.target.checked } }), 'Updated')} aria-label={`${x.name} active`} /></td>
            <td className="pr-3 text-right"><button className="btn-ghost btn-sm text-red-600" onClick={() => confirm(`Remove ${x.name}? (Deactivated instead if trips use it.)`) && run(() => api(`/api/admin/places/${x.id}`, { method: 'DELETE' }), 'Removed')} aria-label="Remove"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}

type Op = { id: string; name: string; plate: string; vehicleType: string; vehicleName: string; badge: string; phoneMasked: string; active: boolean };

export function OperatorsTab() {
  const o = useData<{ operators: Op[] }>('/api/admin/operators');
  const toast = useToast();
  const empty = { name: '', plate: '', vehicleType: 'SEDAN4', vehicleName: '', badge: '', phoneMasked: '' };
  const [f, setF] = useState(empty);
  async function run(fn: () => Promise<unknown>, msg: string) { try { await fn(); toast.push('success', msg); o.reload(); } catch (e) { toast.push('error', (e as Error).message); } }
  if (o.loading && !o.data) return <PageLoader />;
  if (o.error || !o.data) return <ErrorBox message={o.error || 'Failed'} onRetry={o.reload} />;
  return (
    <div className="space-y-5">
      <SectionTitle title="Licensed operators" sub="Verified drivers/vehicles that are assigned to cab and auto crews. Only add operators you have verified." />
      <form className="card grid gap-3 p-4 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); void run(async () => { await api('/api/admin/operators', { body: f }); setF(empty); }, 'Operator added'); }}>
        <Field label="Driver name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field label="Plate number"><input className="input font-mono uppercase" value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} required placeholder="UP-70-AB-1234" /></Field>
        <Field label="Vehicle type"><select className="input" value={f.vehicleType} onChange={(e) => setF({ ...f, vehicleType: e.target.value })}><option value="SEDAN4">4-seater sedan</option><option value="SUV6">6-seater SUV</option><option value="AUTO">Auto-rickshaw</option></select></Field>
        <Field label="Vehicle (make/model)"><input className="input" value={f.vehicleName} onChange={(e) => setF({ ...f, vehicleName: e.target.value })} required /></Field>
        <Field label="Verification note (shown to riders)"><input className="input" value={f.badge} onChange={(e) => setF({ ...f, badge: e.target.value })} placeholder="Verified operator" /></Field>
        <Field label="Contact shown to riders"><input className="input" value={f.phoneMasked} onChange={(e) => setF({ ...f, phoneMasked: e.target.value })} placeholder="+91 98XXX XX123" /></Field>
        <button className="btn-primary sm:col-span-3"><Truck className="h-4 w-4" />Add operator</button>
      </form>
      {o.data.operators.length === 0 ? <EmptyState icon={<Truck className="h-6 w-6" />} title="No operators yet" hint="Crews without an operator still work; riders just won't see a plate number." /> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2 text-left">Driver</th><th className="text-left">Plate</th><th className="text-left">Vehicle</th><th className="text-center">Active</th><th /></tr></thead>
          <tbody>{o.data.operators.map((x) => <tr key={x.id} className="border-t border-slate-100"><td className="px-4 py-2 font-semibold">{x.name}</td><td className="font-mono">{x.plate}</td><td>{x.vehicleName} <span className="text-xs text-slate-400">({x.vehicleType})</span></td>
            <td className="text-center"><input type="checkbox" checked={x.active} onChange={(e) => run(() => api(`/api/admin/operators/${x.id}`, { method: 'PATCH', body: { active: e.target.checked } }), 'Updated')} aria-label={`${x.name} active`} /></td>
            <td className="pr-3 text-right"><button className="btn-ghost btn-sm text-red-600" onClick={() => confirm(`Remove ${x.name}?`) && run(() => api(`/api/admin/operators/${x.id}`, { method: 'DELETE' }), 'Removed')} aria-label="Remove"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}

type Settings = { campusName: string; helplines: { label: string; number: string }[]; hostels: string[]; departments: string[]; shuttleSeats: number; breakStart: string; breakEnd: string; breakLabel: string; returnDate: string };

export function SettingsTab() {
  const s = useData<Settings>('/api/admin/settings');
  const toast = useToast();
  const [f, setF] = useState<Settings | null>(null);
  const [hl, setHl] = useState('');
  useEffect(() => { if (s.data && !f) { setF(s.data); setHl(s.data.helplines.map((h) => `${h.label} | ${h.number}`).join('\n')); } }, [s.data, f]);
  if (s.loading && !s.data) return <PageLoader />;
  if (s.error || !f) return <ErrorBox message={s.error || 'Failed'} onRetry={s.reload} />;
  const lines = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const helplines = lines(hl).map((l) => { const [label, ...rest] = l.split('|'); return { label: label.trim(), number: rest.join('|').trim() }; });
      await api('/api/admin/settings', { method: 'PUT', body: { ...f, helplines } });
      toast.push('success', 'Settings saved');
    } catch (x) { toast.push('error', (x as Error).message); }
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <div className="card grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Campus name"><input className="input" value={f.campusName} onChange={(e) => setF({ ...f, campusName: e.target.value })} required /></Field>
        <Field label="Institute shuttle seats per bus"><input type="number" min={10} max={100} className="input" value={f.shuttleSeats} onChange={(e) => setF({ ...f, shuttleSeats: Number(e.target.value) })} /></Field>
        <Field label="Emergency helplines" hint="One per line: Label | number — shown to riders after SOS. Add your campus security number."><textarea className="input min-h-28 font-mono text-xs" value={hl} onChange={(e) => setHl(e.target.value)} required /></Field>
        <div className="space-y-4">
          <Field label="Hostels (one per line)"><textarea className="input min-h-24" value={f.hostels.join('\n')} onChange={(e) => setF({ ...f, hostels: lines(e.target.value) })} /></Field>
        </div>
        <Field label="Departments / programmes (one per line)"><textarea className="input min-h-24" value={f.departments.join('\n')} onChange={(e) => setF({ ...f, departments: lines(e.target.value) })} /></Field>
        <div className="grid gap-3">
          <Field label="Vacation window start"><input type="date" className="input" value={f.breakStart} onChange={(e) => setF({ ...f, breakStart: e.target.value })} /></Field>
          <Field label="Vacation window end"><input type="date" className="input" value={f.breakEnd} onChange={(e) => setF({ ...f, breakEnd: e.target.value })} /></Field>
          <Field label="Window label"><input className="input" value={f.breakLabel} onChange={(e) => setF({ ...f, breakLabel: e.target.value })} placeholder="End-semester break" /></Field>
          <Field label="Default return-trip date"><input type="date" className="input" value={f.returnDate} onChange={(e) => setF({ ...f, returnDate: e.target.value })} /></Field>
        </div>
      </div>
      <button className="btn-primary">Save settings</button>
    </form>
  );
}
