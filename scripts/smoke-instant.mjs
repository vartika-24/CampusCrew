// "Working model" mode check: college-email sign-in without any code, no government-ID step, clean new-user profile.
// Starts its own server (AUTH_MODE=instant, REQUIRE_GOV_ID=false, DEMO_MODE=false). Run after `npm run build`.
import { spawn, execSync } from 'node:child_process';

const PORT = 3300, BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = 'staff.office@iiita.ac.in';
const env = { ...process.env, NODE_ENV: 'production', DEMO_MODE: 'false', AUTH_MODE: 'instant', REQUIRE_GOV_ID: 'false', DATABASE_URL: 'file:./instant-test.db', AUTH_SECRET: 'y'.repeat(48), ADMIN_EMAILS: ADMIN, PORT: String(PORT) };
delete env.EXPOSE_DEV_OTP; delete env.EMAIL_PROVIDER; delete env.LOAD_STARTER_PLACES;
let pass = 0, fail = 0; const failures = [];
const check = (n, c, x = '') => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; failures.push(n); console.log(`  ✗ ${n} ${x}`); } };
const section = (t) => console.log(`\n▸ ${t}`);

execSync('npx prisma db push --force-reset --skip-generate', { env, stdio: 'ignore' });
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d));
const cleanup = () => { try { server.kill('SIGTERM'); } catch {} try { execSync('rm -f prisma/instant-test.db prisma/instant-test.db-journal'); } catch {} };
process.on('exit', cleanup);
for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + '/api/places')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

class Client {
  constructor() { this.cookie = ''; }
  async req(path, { method, body, raw, form } = {}) {
    const res = await fetch(BASE + path, { method: method ?? (body !== undefined || form ? 'POST' : 'GET'), headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(this.cookie ? { cookie: this.cookie } : {}) }, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined), redirect: 'manual' });
    const sc = res.headers.get('set-cookie'); if (sc) this.cookie = sc.split(';')[0];
    if (raw) return res;
    let data = null; try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
}
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const form = (o) => { const f = new FormData(); Object.entries(o).forEach(([k, v]) => f.set(k, v)); return f; };

try {
  section('Server configuration');
  const anon = new Client();
  const meta = (await anon.req('/api/meta')).data;
  check('instant sign-in enabled, government ID not required', meta.authMode === 'instant' && meta.requireGovId === false);
  check('no demo mode', (await anon.req('/api/auth/me')).data.demoMode === false);
  check('IIITA pickup points / hubs auto-loaded on first boot', (await anon.req('/api/places')).data.places.length >= 10);
  check('request-otp route points to direct sign-in (no code is ever sent or shown)', (await anon.req('/api/auth/request-otp', { body: { email: 'a@iiita.ac.in' } })).data.code === 'USE_INSTANT');
  check('login page loads', (await anon.req('/login', { raw: true })).status === 200);

  section('Sign in with the college email only');
  check('non-college email rejected', (await anon.req('/api/auth/instant', { body: { email: 'me@gmail.com' } })).status === 400);
  check('other college rejected', (await anon.req('/api/auth/instant', { body: { email: 'me@iitb.ac.in' } })).status === 400);
  check('admin email cannot use direct sign-in', (await anon.req('/api/auth/instant', { body: { email: ADMIN } })).data.code === 'ADMIN_NEEDS_OTP');
  const email = 'new.user@iiita.ac.in';
  const me1 = new Client();
  const r1 = await me1.req('/api/auth/instant', { body: { email } });
  check('new email → straight to onboarding (no code step, no code in response)', r1.status === 200 && r1.data.needsOnboarding === true && !!r1.data.signupToken && !JSON.stringify(r1.data).match(/otp|code/i));
  check('not signed in until the profile is created', (await me1.req('/api/auth/me')).data.user === null);

  section('Profile setup: no ID upload, no fake data');
  const base = { signupToken: r1.data.signupToken, name: 'Sankalp Kumar', rollNumber: 'IIT2023099', department: 'B.Tech IT', hostel: 'BH-2', confirmGenderLock: 'true', gender: 'MALE' };
  check('gender is required', (await me1.req('/api/auth/signup', { form: form({ ...base, gender: '' }) })).data.code === 'GENDER_REQUIRED');
  check('gender-lock acknowledgement required', (await me1.req('/api/auth/signup', { form: form({ ...base, confirmGenderLock: 'false' }) })).status === 400);
  const su = await me1.req('/api/auth/signup', { form: form(base) });
  check('account created without any ID photo, signed in', su.status === 201 && su.data.user.name === 'Sankalp Kumar' && (await me1.req('/api/auth/me')).data.user.email === email);
  const u = su.data.user;
  check('profile shows entered name/roll/department/hostel/gender (locked)', u.rollNumber === 'IIT2023099' && u.department === 'B.Tech IT' && u.hostel === 'BH-2' && u.gender === 'MALE' && u.genderLocked === true);
  check('brand-new profile: 0 rides, no ratings, no cancellations, trust = base 50', u.completedRides === 0 && u.ratingAvg === null && u.cancelCount === 0 && u.trustScore === 50);
  const prof = (await me1.req('/api/profile')).data;
  check('trust breakdown is just the base 50', prof.breakdown.total === 50 && prof.breakdown.rides === 0 && prof.breakdown.rating === 0 && prof.breakdown.lateCancelPenalty === 0);
  check('gender cannot be edited', (await me1.req('/api/profile', { method: 'PATCH', body: { gender: 'FEMALE' } })).data.code === 'GENDER_LOCKED');
  const mine = (await me1.req('/api/groups/mine')).data;
  check('dashboard data empty (no fake trips)', mine.active.length + mine.upcoming.length + mine.past.length === 0 && (await me1.req('/api/journeys')).data.journeys.length === 0);
  const eco = (await me1.req('/api/eco')).data;
  check('eco stats are zero (no fake savings)', eco.mine.moneySaved === 0 && eco.mine.co2Kg === 0 && eco.campus.moneySaved === 0);
  check('only a welcome notification', (await me1.req('/api/notifications')).data.notifications.length === 1);
  check('surge planner says not enough data', (await me1.req('/api/surge')).data.hasData === false);
  check('no crews exist for anyone yet', (await me1.req('/api/trips/search')).data.trips.length === 0);
  check('signing in again returns the same account directly', (await (async () => { const c = new Client(); const r = await c.req('/api/auth/instant', { body: { email } }); return r.data.needsOnboarding === false && r.data.user.id === u.id && (await c.req('/api/auth/me')).data.user.id === u.id; })()));

  section('Plan a trip as the new user');
  const places = (await me1.req('/api/places')).data.places;
  const pid = (c) => places.find((p) => p.code === c).id;
  const today = (await me1.req('/api/meta')).data.today;
  const date = addDays(today, 2);
  const leg = (o = {}) => ({ originId: pid('IIITA-G1'), destId: pid('PRYJ'), date, windowStart: '16:00', windowEnd: '17:30', mode: 'CAB', vehicleType: 'SEDAN4', luggage: 1, genderPref: 'MIXED', ...o });
  check('boys-only crew allowed for a male profile; girls-only is not', (await me1.req('/api/journeys', { body: { legs: [leg({ genderPref: 'GIRLS_ONLY' })], autoMatch: false } })).status === 403);
  const j = await me1.req('/api/journeys', { body: { title: 'Home for the break', autoMatch: true, legs: [leg(), { originId: pid('PRYJ'), destId: pid('CNB'), date, windowStart: '18:45', windowEnd: '19:15', mode: 'TRAIN', trainNumber: '12451', genderPref: 'MIXED', luggage: 0 }] } });
  check('2-leg journey created and each leg hosted (nobody else to match yet)', j.status === 201 && j.data.results.length === 2 && j.data.results.every((r) => r.action === 'HOSTED'));
  const gid = j.data.results[0].groupId;
  const trip = (await me1.req(`/api/groups/${gid}`)).data.trip;
  check('trip room: PIN for host, no invented driver/vehicle', /^\d{4}$/.test(trip.pin) && trip.operator === null && trip.members.length === 1 && trip.members[0].name === 'Sankalp Kumar');
  check('journey visible on dashboard data', (await me1.req('/api/groups/mine')).data.upcoming.length === 2);

  section('A second student finds the crew; gender filter still applies');
  const fem = new Client();
  const r2 = await fem.req('/api/auth/instant', { body: { email: 'second.student@iiita.ac.in' } });
  await fem.req('/api/auth/signup', { form: form({ ...base, signupToken: r2.data.signupToken, name: 'Second Student', rollNumber: 'IIT2023100', gender: 'FEMALE' }) });
  const g = await fem.req('/api/journeys', { body: { legs: [leg({ genderPref: 'GIRLS_ONLY', windowStart: '09:00', windowEnd: '10:00' })], autoMatch: true } });
  check('female student creates a girls-only crew', g.status === 201);
  const s1 = (await me1.req('/api/trips/search')).data.trips;
  check('male student never sees the girls-only crew', s1.every((t) => t.genderPref !== 'GIRLS_ONLY'));
  const s2 = (await fem.req('/api/trips/search?date=' + date)).data.trips;
  check('second student finds the first user’s mixed crew and can join', s2.some((t) => t.id === gid) && (await fem.req(`/api/groups/${gid}/join`, { body: { luggage: 1 } })).status === 200);

  console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
  if (fail) console.log('Failures:\n - ' + failures.join('\n - '));
} catch (e) { fail++; console.error('crashed:', e); console.log(log.slice(-1500)); }
finally { cleanup(); process.exit(fail ? 1 : 0); }
