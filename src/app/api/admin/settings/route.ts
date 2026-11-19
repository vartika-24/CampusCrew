import { handle, ok, readJson, bad, int } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { getConfig, setSetting } from '@/lib/settings';
import { DATE_RE } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireAdmin();
  const c = await getConfig();
  return ok({ campusName: c.campusName, helplines: c.helplines, hostels: c.hostels, departments: c.departments, shuttleSeats: c.shuttleSeats, breakStart: c.breakStart ?? '', breakEnd: c.breakEnd ?? '', breakLabel: c.raw.breakLabel ?? '', returnDate: c.returnDate ?? '' });
});

const list = (v: unknown, label: string, max: number): string[] => {
  if (!Array.isArray(v)) throw bad(`${label} must be a list`);
  const out = [...new Set(v.map((x) => String(x).trim()).filter(Boolean))];
  if (out.length < 1 || out.length > max || out.some((x) => x.length > 40)) throw bad(`${label}: provide 1–${max} entries (max 40 characters each)`);
  return out;
};

export const PUT = handle(async (req) => {
  await requireAdmin();
  const b = await readJson(req);
  const date = (v: unknown, label: string) => { const s = typeof v === 'string' ? v.trim() : ''; if (s && !DATE_RE.test(s)) throw bad(`${label} must be a date`); return s || null; };
  const campusName = String(b.campusName ?? '').trim();
  if (campusName.length < 2 || campusName.length > 80) throw bad('Campus name is required (2–80 characters)');
  const helplines = (Array.isArray(b.helplines) ? b.helplines : []).map((h: { label?: unknown; number?: unknown }) => ({ label: String(h.label ?? '').trim(), number: String(h.number ?? '').trim() })).filter((h: { label: string; number: string }) => h.label || h.number);
  if (helplines.length < 1 || helplines.length > 8 || helplines.some((h: { label: string; number: string }) => !h.label || h.label.length > 60 || !/^[0-9+\-() ]{3,20}$/.test(h.number))) throw bad('Helplines: 1–8 entries, each with a label and a valid phone number');
  const bs = date(b.breakStart, 'Break start'), be = date(b.breakEnd, 'Break end');
  if (bs && be && be < bs) throw bad('Break end must not be before break start');
  await setSetting('campusName', campusName);
  await setSetting('helplines', JSON.stringify(helplines));
  await setSetting('hostels', JSON.stringify(list(b.hostels, 'Hostels', 30)));
  await setSetting('departments', JSON.stringify(list(b.departments, 'Departments', 30)));
  await setSetting('shuttleSeats', String(int(b.shuttleSeats, 'Shuttle seats', 10, 100)));
  await setSetting('breakStart', bs); await setSetting('breakEnd', be); await setSetting('returnDate', date(b.returnDate, 'Return date'));
  await setSetting('breakLabel', String(b.breakLabel ?? '').trim().slice(0, 80) || null);
  return ok({ ok: true });
});
