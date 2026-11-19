// Production-mode end-to-end check (DEMO_MODE=false): empty DB, real email OTP via a mock Brevo API,
// admin bootstrap from ADMIN_EMAILS, mandatory government-ID review, no demo/sample data, real-GPS tracking.
// Usage: npm run build && node scripts/smoke-prod.mjs
import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import { idImage } from './lib/idimage.mjs';

const PORT = 3200, MOCK = 3201, BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = 'warden.office@iiita.ac.in';
const env = {
  ...process.env, NODE_ENV: 'production', DEMO_MODE: 'false', AUTH_MODE: 'otp', REQUIRE_GOV_ID: 'true', LOAD_STARTER_PLACES: 'false', EXPOSE_DEV_OTP: 'false', DATABASE_URL: 'file:./prod-test.db', AUTH_SECRET: 'x'.repeat(48), ADMIN_EMAILS: ADMIN,
  ALLOWED_EMAIL_DOMAINS: 'iiita.ac.in', EMAIL_PROVIDER: 'brevo', EMAIL_API_KEY: 'test-key', EMAIL_FROM_ADDRESS: 'noreply@campuscrew.test', EMAIL_API_BASE_URL: `http://127.0.0.1:${MOCK}`, PORT: String(PORT),
};
let pass = 0, fail = 0; const failures = [];
const check = (n, c, x = '') => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; failures.push(n); console.log(`  ✗ ${n} ${x}`); } };
const section = (t) => console.log(`\n▸ ${t}`);

const mails = [];
const mock = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { mails.push({ key: req.headers['api-key'], body: JSON.parse(b) }); res.statusCode = 201; res.end('{"messageId":"x"}'); }); });
await new Promise((r) => mock.listen(MOCK, '127.0.0.1', r));

execSync('npx prisma db push --force-reset --skip-generate', { env, stdio: 'ignore' });
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d));
const cleanup = () => { try { server.kill('SIGTERM'); } catch {} mock.close(); try { execSync('rm -f prisma/prod-test.db prisma/prod-test.db-journal'); } catch {} };
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
const lastMailTo = (to) => [...mails].reverse().find((m) => m.body.to[0].email === to);
const codeFrom = (m) => m.body.textContent.match(/\b(\d{6})\b/)[1];
async function login(c, email) {
  const o = await c.req('/api/auth/request-otp', { body: { email } });
  const code = codeFrom(lastMailTo(email));
  return { o, v: await c.req('/api/auth/verify-otp', { body: { email, otp: code } }) };
}
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

try {
  section('Production mode: no demo, no sample data');
  const anon = new Client();
  const me0 = (await anon.req('/api/auth/me')).data;
  check('demoMode is off', me0.demoMode === false);
  check('demo login disabled', (await anon.req('/api/auth/demo', { body: { email: 'student.female@iiita.ac.in' } })).status === 403);
  check('no places seeded', (await anon.req('/api/places')).data.places.length === 0);
  const meta = (await anon.req('/api/meta')).data;
  check('helplines are only national numbers by default (112 / 1091 / 108)', meta.helplines.map((h) => h.number).join() === '112,1091,108');
  check('landing page has no demo CTA text', !(await (await anon.req('/', { raw: true })).text()).includes('Try the demo'));
  check('login page loads', (await anon.req('/login', { raw: true })).status === 200);
  check('only iiita.ac.in accepted', (await anon.req('/api/auth/request-otp', { body: { email: 'a@iitd.ac.in' } })).status === 400);

  section('Real email OTP (Brevo API)');
  const stu = new Client();
  const email = 'real.student@iiita.ac.in';
  const o = await stu.req('/api/auth/request-otp', { body: { email } });
  check('OTP request OK without exposing the code', o.status === 200 && !('devOtp' in o.data) && o.data.sent === true);
  const m = lastMailTo(email);
  check('email sent through provider API with api-key header', !!m && m.key === 'test-key' && m.body.sender.email === 'noreply@campuscrew.test');
  check('email contains a 6-digit code and subject mentions it', !!m && /^\d{6}$/.test(codeFrom(m)) && m.body.subject.includes(codeFrom(m)));
  check('wrong code rejected', (await stu.req('/api/auth/verify-otp', { body: { email, otp: codeFrom(m) === '000000' ? '111111' : '000000' } })).status === 400);
  const ver = await stu.req('/api/auth/verify-otp', { body: { email, otp: codeFrom(m) } });
  check('correct emailed code → onboarding', ver.data.needsOnboarding === true);
  check('OTP cannot be reused', (await new Client().req('/api/auth/verify-otp', { body: { email, otp: codeFrom(m) } })).status === 400);

  section('Admin bootstrap from ADMIN_EMAILS');
  const admin = new Client();
  const al = await login(admin, ADMIN);
  check('listed admin email becomes ADMIN on first OTP login', al.v.status === 200 && al.v.data.user.role === 'ADMIN');
  const s2 = new Client();
  await s2.req('/api/auth/request-otp', { body: { email: 'other.person@iiita.ac.in' } });
  check('other emails are not admins', (await s2.req('/api/auth/verify-otp', { body: { email: 'other.person@iiita.ac.in', otp: codeFrom(lastMailTo('other.person@iiita.ac.in')) } })).data.needsOnboarding === true);

  section('Admin sets up real data (places, operators, settings)');
  check('invalid coordinates rejected', (await admin.req('/api/admin/places', { body: { code: 'G1', name: 'Main Gate', kind: 'CAMPUS', city: 'Prayagraj', lat: 999, lng: 81.77 } })).status === 400);
  const p1 = await admin.req('/api/admin/places', { body: { code: 'MAIN-GATE', name: 'Main Gate (Gate 1)', kind: 'CAMPUS', city: 'Prayagraj', lat: 25.4285, lng: 81.7712 } });
  const p2 = await admin.req('/api/admin/places', { body: { code: 'JUNCTION', name: 'Prayagraj Junction', kind: 'STATION', city: 'Prayagraj', lat: 25.4464, lng: 81.8301 } });
  check('places created', p1.status === 201 && p2.status === 201);
  check('duplicate code rejected', (await admin.req('/api/admin/places', { body: { code: 'MAIN-GATE', name: 'x y z', kind: 'CAMPUS', city: 'Pr', lat: 1, lng: 1 } })).status === 409);
  check('students see the new places', (await anon.req('/api/places')).data.places.length === 2);
  check('bad plate rejected', (await admin.req('/api/admin/operators', { body: { name: 'Driver One', plate: 'NOPE', vehicleType: 'SEDAN4', vehicleName: 'Dzire' } })).status === 400);
  check('operator created', (await admin.req('/api/admin/operators', { body: { name: 'Driver One', plate: 'UP-70-AB-1234', vehicleType: 'SEDAN4', vehicleName: 'Swift Dzire', phoneMasked: '+91 98XXX XX123' } })).status === 201);
  check('settings saved (campus helpline added)', (await admin.req('/api/admin/settings', { method: 'PUT', body: { campusName: 'IIIT Allahabad', helplines: [{ label: 'Campus Security', number: '0532 000 0000' }, { label: 'Police', number: '112' }], hostels: ['BH-1', 'GH-1'], departments: ['B.Tech IT'], shuttleSeats: 40, breakStart: '', breakEnd: '', breakLabel: '', returnDate: '' } })).status === 200);
  check('helpline setting reaches /api/meta', (await anon.req('/api/meta')).data.helplines[0].label === 'Campus Security');

  section('Student: government ID read automatically (no Student Affairs step)');
  const fd = async (withImg, over = {}) => { const f = new FormData(); f.set('signupToken', ver.data.signupToken); Object.entries({ name: 'Real Student', rollNumber: 'IIT2023055', department: 'B.Tech IT', hostel: 'GH-1', confirmGenderLock: 'true', idType: 'AADHAAR', gender: 'MALE', ...over }).forEach(([k, v]) => f.set(k, v)); if (withImg) f.set('idImage', new Blob([await idImage({ name: 'REAL STUDENT', gender: 'Female' })], { type: 'image/png' }), 'aadhaar.png'); return f; };
  check('no image → rejected', (await stu.req('/api/auth/signup', { form: await fd(false) })).status === 400);
  check('hostel list comes from admin settings (unknown hostel rejected)', (await stu.req('/api/auth/signup', { form: await fd(true, { hostel: 'BH-9' }) })).status === 400);
  const su = await stu.req('/api/auth/signup', { form: await fd(true) });
  check('signup → VERIFIED immediately', su.status === 201 && su.data.user.idCardStatus === 'VERIFIED');
  check('gender comes from the ID (FEMALE) even though the form said MALE', su.data.user.gender === 'FEMALE' && su.data.user.genderLocked === true);
  check('student is verified and gender locked', (await stu.req('/api/auth/me')).data.user.genderLocked === true);
  check('ID review queue does not exist', (await admin.req('/api/admin/verifications', { raw: true })).status === 404);
  check('ID image is not stored anywhere (no ID endpoint serves it)', (await admin.req(`/api/admin/verifications/${su.data.user.id}/image`, { raw: true })).status === 404);

  section('Trip + real GPS tracking (no simulation)');
  const date = addDays(new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10), 1);
  const places = (await stu.req('/api/places')).data.places;
  const pid = (c) => places.find((p) => p.code === c).id;
  const j = await stu.req('/api/journeys', { body: { autoMatch: true, legs: [{ originId: pid('MAIN-GATE'), destId: pid('JUNCTION'), date, windowStart: '10:00', windowEnd: '11:00', mode: 'CAB', vehicleType: 'SEDAN4', luggage: 1, genderPref: 'GIRLS_ONLY' }] } });
  check('verified student can host a girls-only crew', j.status === 201 && !!j.data.results[0].groupId);
  const gid = j.data.results[0].groupId;
  const trip = (await stu.req(`/api/groups/${gid}`)).data.trip;
  check('operator added by admin is assigned (plate shown to riders)', trip.operator?.plate === 'UP-70-AB-1234');
  check('no demo PIN hint in production', trip.demoPin === null && /^\d{4}$/.test(trip.pin));
  check('PIN boarding', (await stu.req(`/api/groups/${gid}/board`, { body: { pin: trip.pin } })).status === 200);
  check('start ride', (await stu.req(`/api/groups/${gid}/status`, { body: { action: 'start' } })).status === 200);
  const t1 = (await anon.req(`/api/track/${trip.shareToken}`)).data;
  check('no GPS yet → source NONE, no fabricated position', t1.source === 'NONE' && t1.position === null && t1.state === 'ON_THE_WAY');
  const sos0 = await stu.req(`/api/groups/${gid}/sos`, { body: {} });
  check('SOS without any GPS is flagged approximate (not faked)', sos0.status === 201 && sos0.data.alert.approximate === true && sos0.data.helplines[0].label === 'Campus Security');
  check('admin sees SOS flagged approximate', (await admin.req('/api/admin/safety')).data.alerts.some((a) => a.status === 'ACTIVE' && a.approximate === true));
  check('invalid coordinates rejected', (await stu.req(`/api/groups/${gid}/location`, { body: { lat: 200, lng: 10 } })).status === 400);
  check('rider device posts real GPS', (await stu.req(`/api/groups/${gid}/location`, { body: { lat: 25.436, lng: 81.79, accuracy: 12 } })).data.stored === true);
  const t2 = (await anon.req(`/api/track/${trip.shareToken}`)).data;
  check('public tracking now uses real GPS position', t2.source === 'GPS' && Math.abs(t2.position.lat - 25.436) < 1e-6 && t2.progress > 0 && t2.progress < 1);
  check('non-riders cannot post location', (await new Client().req(`/api/groups/${gid}/location`, { body: { lat: 25.4, lng: 81.7 } })).status === 401);
  check('complete trip', (await stu.req(`/api/groups/${gid}/status`, { body: { action: 'complete' } })).status === 200);
  check('GPS trail deleted after completion', (await anon.req(`/api/track/${trip.shareToken}`)).data.source === 'NONE');

  section('Other production behaviours');
  check('surge planner reports not enough data (no fake demand)', (await stu.req('/api/surge')).data.hasData === false);
  const users = (await admin.req('/api/admin/users')).data.users;
  check('student list contains only real signups', users.length === 1 && users[0].email === email);

  console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
  if (fail) console.log('Failures:\n - ' + failures.join('\n - '));
} catch (e) {
  fail++; console.error('crashed:', e); console.log(log.slice(-1500));
} finally { cleanup(); process.exit(fail ? 1 : 0); }
