// End-to-end smoke test against a running server:  BASE_URL=http://localhost:3000 npm run smoke
// Run against a freshly seeded database (npm run db:reset) — it mutates data.
const BASE = process.env.BASE_URL || 'http://localhost:3000';
let pass = 0, fail = 0;
const failures = [];

class Client {
  constructor(name) { this.name = name; this.cookie = ''; }
  async req(path, { method, body, raw } = {}) {
    const res = await fetch(BASE + path, {
      method: method ?? (body !== undefined ? 'POST' : 'GET'),
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(this.cookie ? { cookie: this.cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined, redirect: 'manual',
    });
    const sc = res.headers.get('set-cookie');
    if (sc) { const c = sc.split(';')[0]; this.cookie = c.endsWith('=') ? '' : c; }
    if (raw) return res;
    let data = null; try { data = await res.json(); } catch { /* not json */ }
    return { status: res.status, data };
  }
}

function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; failures.push(name); console.log(`  ✗ ${name} ${extra}`); }
}
const section = (t) => console.log(`\n▸ ${t}`);

function fakePng(w = 900, h = 600) {
  const b = Buffer.alloc(2048, 7);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  b.writeUInt32BE(Math.floor(Math.random() * 4e9), 40); // unique bytes per call (duplicate-image check)
  return b;
}
async function signupForm(client, token, fields, image) {
  const fd = new FormData();
  fd.set('signupToken', token);
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  if (image) fd.set('idImage', new Blob([image], { type: 'image/png' }), 'id.png');
  const res = await fetch(BASE + '/api/auth/signup', { method: 'POST', body: fd, headers: client.cookie ? { cookie: client.cookie } : {} });
  const sc = res.headers.get('set-cookie'); if (sc) client.cookie = sc.split(';')[0];
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
const newUserToken = async (c, tag) => { const email = `${tag}${Date.now() % 1000000}@iiita.ac.in`; const o = await c.req('/api/auth/request-otp', { body: { email } }); const v = await c.req('/api/auth/verify-otp', { body: { email, otp: o.data.devOtp } }); return { email, token: v.data.signupToken }; };
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const demo = async (email) => { const c = new Client(email); const r = await c.req('/api/auth/demo', { body: { email } }); if (r.status !== 200) throw new Error(`demo login failed for ${email}: ${r.status}`); return c; };

(async () => {
  section('Public pages & route protection');
  const anon = new Client('anon');
  for (const p of ['/', '/login', '/signup']) check(`GET ${p} → 200`, (await anon.req(p, { raw: true })).status === 200);
  for (const p of ['/dashboard', '/trips', '/admin', '/eco']) { const r = await anon.req(p, { raw: true }); check(`GET ${p} unauthenticated → redirect to /login`, r.status === 307 && (r.headers.get('location') || '').includes('/login')); }
  check('manifest served', (await anon.req('/manifest.webmanifest', { raw: true })).status === 200);
  check('service worker served', (await anon.req('/sw.js', { raw: true })).status === 200);
  check('API requires auth', (await anon.req('/api/groups/mine')).status === 401);
  check('admin API requires auth', (await anon.req('/api/admin/overview')).status === 401);

  section('Signup: domain restriction, OTP, mandatory government ID, gender lock');
  check('non-college email rejected', (await anon.req('/api/auth/request-otp', { body: { email: 'someone@gmail.com' } })).status === 400);
  check('other .ac.in college rejected (iiita.ac.in only)', (await anon.req('/api/auth/request-otp', { body: { email: 'someone@iitb.ac.in' } })).status === 400);
  const email = `new.student${Date.now() % 100000}@iiita.ac.in`;
  const otpRes = await anon.req('/api/auth/request-otp', { body: { email } });
  check('OTP issued (demo mode shows dev OTP)', otpRes.status === 200 && /^\d{6}$/.test(otpRes.data.devOtp ?? ''));
  check('OTP response does not reveal whether the account exists', !('isNewUser' in otpRes.data));
  check('OTP resend throttled (30s)', (await anon.req('/api/auth/request-otp', { body: { email } })).status === 429);
  check('wrong OTP rejected', (await anon.req('/api/auth/verify-otp', { body: { email, otp: otpRes.data.devOtp === '000000' ? '111111' : '000000' } })).status === 400);
  const ver = await anon.req('/api/auth/verify-otp', { body: { email, otp: otpRes.data.devOtp } });
  check('OTP verified → needs onboarding', ver.status === 200 && ver.data.needsOnboarding === true && !!ver.data.signupToken);
  const base = { name: 'New Student', rollNumber: 'IIT2025999', department: 'B.Tech IT', hostel: 'GH-1', gender: 'FEMALE', confirmGenderLock: 'true', idType: 'AADHAAR', upiId: 'newstudent@okaxis' };
  check('signup WITHOUT ID image rejected', (await signupForm(anon, ver.data.signupToken, base, null)).data?.code === 'ID_IMAGE_REQUIRED');
  check('signup with a text file as "ID" rejected', (await signupForm(anon, ver.data.signupToken, base, Buffer.from('not an image'.repeat(10)))).data?.code === 'ID_IMAGE_INVALID');
  check('signup with tiny image rejected', (await signupForm(anon, ver.data.signupToken, base, fakePng(100, 80))).data?.code === 'ID_IMAGE_INVALID');
  check('signup without ID type rejected', (await signupForm(anon, ver.data.signupToken, { ...base, idType: 'COLLEGE_ID' }, fakePng())).data?.code === 'ID_TYPE_REQUIRED');
  check('invalid roll number rejected', (await signupForm(anon, ver.data.signupToken, { ...base, rollNumber: 'BAD123' }, fakePng())).status === 400);
  check('gender-lock confirmation required', (await signupForm(anon, ver.data.signupToken, { ...base, confirmGenderLock: 'false' }, fakePng())).status === 400);
  const idPng = fakePng();
  const su = await signupForm(anon, ver.data.signupToken, base, idPng);
  check('signup succeeds (201) and is PENDING review', su.status === 201 && su.data.user.idCardStatus === 'PENDING' && su.data.pendingReview === true);
  check('pending user has trust 0 and gender not yet locked', su.data.user.trustScore === 0 && su.data.user.genderLocked === false);
  const newUserId = su.data.user.id;
  const dup = await newUserToken(new Client('d'), 'dup');
  check('same ID image cannot be reused on another account', (await signupForm(new Client('d2'), dup.token, { ...base, rollNumber: 'IIT2025998' }, idPng)).status === 409);
  check('same roll number cannot re-register', (await signupForm(new Client('d3'), dup.token, base, fakePng())).status === 409);
  const patch = await anon.req('/api/profile', { method: 'PATCH', body: { gender: 'MALE' } });
  check('gender edit blocked (GENDER_LOCKED)', patch.status === 400 && patch.data.code === 'GENDER_LOCKED');

  section('Unverified (pending) users are restricted');
  const placesP = (await anon.req('/api/places')).data.places;
  const pidP = (c) => placesP.find((p) => p.code === c).id;
  const peekDay = (await anon.req('/api/meta')).data.settings.breakStart;
  const legP = { originId: pidP('IIITA-G1'), destId: pidP('PRYJ'), date: peekDay, windowStart: '10:00', windowEnd: '11:00', mode: 'CAB', vehicleType: 'SEDAN4', luggage: 1, genderPref: 'MIXED' };
  const cj = await anon.req('/api/journeys', { body: { legs: [legP], autoMatch: false } });
  check('pending user cannot plan trips (NOT_VERIFIED)', cj.status === 403 && cj.data.code === 'NOT_VERIFIED');
  const pendSearch = await anon.req('/api/trips/search');
  check('pending (even declared FEMALE) user sees ONLY mixed crews', pendSearch.status === 200 && pendSearch.data.trips.length > 0 && pendSearch.data.trips.every((t) => t.genderPref === 'MIXED'));
  check('pending user cannot opt in to buddy visibility', (await anon.req('/api/buddies/visibility', { body: { visible: true } })).status === 403);

  section('Demo accounts & seeded data');
  const ananya = await demo('student.female@iiita.ac.in');
  const rohan = await demo('student.male@iiita.ac.in');
  const kabir = await demo('student.lowtrust@iiita.ac.in');
  const admin = await demo('admin@iiita.ac.in');
  const me = async (c) => (await c.req('/api/auth/me')).data.user;
  const [A, R, K] = [await me(ananya), await me(rohan), await me(kabir)];
  check('Ananya trust 96, FEMALE, GH-2', A.trustScore === 96 && A.gender === 'FEMALE' && A.hostel === 'GH-2');
  check('Rohan trust 92, MALE, BH-3', R.trustScore === 92 && R.gender === 'MALE' && R.hostel === 'BH-3');
  check('Kabir trust 64 with 2 cancellations', K.trustScore === 64 && K.cancelCount === 2);
  check('non-demo email rejected for demo login', (await new Client('z').req('/api/auth/demo', { body: { email: 'priya.nair@iiita.ac.in' } })).status === 403);
  check('admin role', (await me(admin)).role === 'ADMIN');

  section('Admin government-ID review');
  const q = (await admin.req('/api/admin/verifications')).data;
  const mine = q.queue.find((u) => u.id === newUserId);
  check('admin queue lists the pending student with ID image', !!mine && !!mine.image && mine.idType === 'AADHAAR');
  check('student cannot read the verification queue', (await rohan.req('/api/admin/verifications')).status === 403);
  const imgRes = await admin.req(`/api/admin/verifications/${newUserId}/image`, { raw: true });
  check('admin can fetch ID image (private, no-store)', imgRes.status === 200 && imgRes.headers.get('content-type') === 'image/png' && /no-store/.test(imgRes.headers.get('cache-control')));
  check('students cannot fetch ID images', (await rohan.req(`/api/admin/verifications/${newUserId}/image`, { raw: true })).status === 403);
  check('anonymous cannot fetch ID images', (await new Client('q').req(`/api/admin/verifications/${newUserId}/image`, { raw: true })).status === 403);
  check('approve requires explicit confirmation', (await admin.req(`/api/admin/verifications/${newUserId}`, { body: { action: 'approve' } })).status === 400);
  const rej = await newUserToken(new Client('r'), 'rej');
  const rejC = new Client('rejc');
  const rejSignup = await signupForm(rejC, rej.token, { ...base, rollNumber: 'IIT2025888', name: 'Rejected Person' }, fakePng());
  check('second student signs up', rejSignup.status === 201);
  check('reject requires a reason', (await admin.req(`/api/admin/verifications/${rejSignup.data.user.id}`, { body: { action: 'reject' } })).status === 400);
  check('admin rejects with reason', (await admin.req(`/api/admin/verifications/${rejSignup.data.user.id}`, { body: { action: 'reject', reason: 'Photo is blurry, gender not readable' } })).status === 200);
  const rejMe = (await rejC.req('/api/auth/me')).data.user;
  check('rejected student sees reason', rejMe.idCardStatus === 'REJECTED' && /blurry/.test(rejMe.idRejectReason));
  check('rejected ID image is deleted', (await admin.req(`/api/admin/verifications/${rejSignup.data.user.id}/image`, { raw: true })).status === 404);
  const reup = new FormData(); reup.set('idType', 'PASSPORT'); reup.set('idImage', new Blob([fakePng()], { type: 'image/png' }), 'id.png');
  const reupRes = await fetch(BASE + '/api/profile/id', { method: 'POST', body: reup, headers: { cookie: rejC.cookie } });
  check('rejected student can re-upload an ID (back to PENDING)', reupRes.status === 200 && (await reupRes.json()).user.idCardStatus === 'PENDING');
  const ap = await admin.req(`/api/admin/verifications/${newUserId}`, { body: { action: 'approve', confirmed: true, gender: 'FEMALE' } });
  check('admin approves (gender confirmed)', ap.status === 200);
  check('approved ID image is deleted after review', (await admin.req(`/api/admin/verifications/${newUserId}/image`, { raw: true })).status === 404);
  const approved = (await anon.req('/api/auth/me')).data.user;
  check('approved: VERIFIED, gender locked, trust = base 50', approved.idCardStatus === 'VERIFIED' && approved.genderLocked === true && approved.trustScore === 50);
  check('approved student can now plan trips', (await anon.req('/api/journeys', { body: { legs: [legP], autoMatch: false } })).status === 201);
  check('verified student can no longer replace the ID', (await (async () => { const f2 = new FormData(); f2.set('idType', 'AADHAAR'); f2.set('idImage', new Blob([fakePng()], { type: 'image/png' }), 'x.png'); return fetch(BASE + '/api/profile/id', { method: 'POST', body: f2, headers: { cookie: anon.cookie } }); })()).status === 403);

  section('Gender hard filter');
  const rSearch = await rohan.req('/api/trips/search');
  const aSearch = await ananya.req('/api/trips/search');
  check('male search 200 with trips', rSearch.status === 200 && rSearch.data.trips.length > 5);
  check('male search NEVER contains GIRLS_ONLY', rSearch.data.trips.every((t) => t.genderPref !== 'GIRLS_ONLY'));
  check('female search includes GIRLS_ONLY', aSearch.data.trips.some((t) => t.genderPref === 'GIRLS_ONLY'));
  check('female search NEVER contains BOYS_ONLY', aSearch.data.trips.every((t) => t.genderPref !== 'BOYS_ONLY'));
  const rSearchGirls = await rohan.req('/api/trips/search?pref=GIRLS_ONLY');
  check('male explicit GIRLS_ONLY filter returns nothing', rSearchGirls.data.trips.length === 0);
  const girlsTrip = aSearch.data.trips.find((t) => t.genderPref === 'GIRLS_ONLY');
  check('male GET girls-only trip → 404', (await rohan.req(`/api/groups/${girlsTrip.id}`)).status === 404);
  check('male JOIN girls-only trip → 404', (await rohan.req(`/api/groups/${girlsTrip.id}/join`, { body: { luggage: 0 } })).status === 404);
  check('male chat on girls-only trip denied', (await rohan.req(`/api/groups/${girlsTrip.id}/messages`)).status === 403);
  const places = (await ananya.req('/api/places')).data.places;
  const pid = (code) => places.find((p) => p.code === code).id;
  const future = (await ananya.req('/api/meta')).data.settings.breakStart;
  const mkLeg = (extra = {}) => ({ originId: pid('IIITA-G1'), destId: pid('PRYJ'), date: future, windowStart: '10:00', windowEnd: '11:00', mode: 'CAB', vehicleType: 'SEDAN4', luggage: 1, genderPref: 'MIXED', ...extra });
  check('male cannot create GIRLS_ONLY trip', (await rohan.req('/api/journeys', { body: { legs: [mkLeg({ genderPref: 'GIRLS_ONLY' })], autoMatch: false } })).status === 403);
  check('female cannot create BOYS_ONLY trip', (await ananya.req('/api/journeys', { body: { legs: [mkLeg({ genderPref: 'BOYS_ONLY' })], autoMatch: false } })).status === 403);
  const aMatch = await ananya.req('/api/journeys', { body: { legs: [mkLeg({ genderPref: 'GIRLS_ONLY', windowStart: '09:00', windowEnd: '10:30', originId: pid('IIITA-GH') })], autoMatch: false } });
  check('female can create GIRLS_ONLY journey', aMatch.status === 201);
  const seg = aMatch.data.journey.segments[0];
  const segMatches = await ananya.req(`/api/segments/${seg.id}/matches`);
  check('segment matches ranked w/ score breakdown', segMatches.status === 200 && segMatches.data.matches.length > 0 && segMatches.data.matches.every((m) => m.genderPref === 'GIRLS_ONLY') && typeof segMatches.data.matches[0].score.total === 'number');

  section('Multi-leg journey (Cab → Train → Auto) + matching');
  const legs = [
    mkLeg({ windowStart: '12:00', windowEnd: '13:00', luggage: 2, genderPref: 'MIXED' }),
    { originId: pid('PRYJ'), destId: pid('CNB'), date: future, windowStart: '14:00', windowEnd: '14:30', mode: 'TRAIN', trainNumber: '12451', genderPref: 'MIXED', luggage: 0 },
    { originId: pid('CNB'), destId: pid('KNP-HOME'), date: future, windowStart: '18:00', windowEnd: '19:00', mode: 'AUTO', genderPref: 'MIXED', luggage: 1 },
  ];
  const mj = await rohan.req('/api/journeys', { body: { title: 'Test multi-leg', legs, autoMatch: true } });
  check('3-leg journey created (201)', mj.status === 201 && mj.data.journey.segments.length === 3);
  check('each leg matched/hosted independently', mj.data.results.length === 3 && mj.data.results.every((r) => r.groupId));
  check('broken chain rejected', (await rohan.req('/api/journeys', { body: { legs: [legs[0], legs[2]], autoMatch: false } })).status === 400);
  check('luggage over cab capacity rejected', (await rohan.req('/api/journeys', { body: { legs: [mkLeg({ luggage: 4 })], autoMatch: false } })).status === 400);
  check('past date rejected', (await rohan.req('/api/journeys', { body: { legs: [mkLeg({ date: '2020-01-01' })], autoMatch: false } })).status === 400);

  section('Trust: night restriction for low-trust user');
  const d2 = addDays(future, 1), d3 = addDays(future, 2);
  const nightTrip = (await rohan.req('/api/trips/search?date=' + d2 + '&dest=' + pid('PRYJ'))).data.trips.find((t) => t.nightMode);
  check('seeded night trip exists with Night Safety Mode', !!nightTrip);
  const kNight = await kabir.req(`/api/groups/${nightTrip.id}/join`, { body: { luggage: 0 } });
  check('trust<70 blocked from night ride (NIGHT_RESTRICTED)', kNight.status === 403 && kNight.data.code === 'NIGHT_RESTRICTED');
  const kNightCreate = await kabir.req('/api/journeys', { body: { legs: [mkLeg({ windowStart: '22:00', windowEnd: '23:00' })], autoMatch: false } });
  check('trust<70 cannot create night trip', kNightCreate.status === 403);
  const kRank = (await kabir.req(`/api/trips/search?date=${d2}&dest=${pid('PRYJ')}&origin=${pid('IIITA-G1')}&from=16:00&to=18:30`)).data;
  const rRank = (await rohan.req(`/api/trips/search?date=${d2}&dest=${pid('PRYJ')}&origin=${pid('IIITA-G1')}&from=16:00&to=18:30`)).data;
  check('search is ranked by match score when window supplied', kRank.ranked === true && rRank.ranked === true);
  const sameTrip = (list, id) => list.trips.find((t) => t.id === id);
  const common = kRank.trips.find((t) => sameTrip(rRank, t.id));
  check('low-trust rider scores lower on same trip (deprioritised)', !common || sameTrip(rRank, common.id).score.total > common.score.total);

  section('Waitlist promotion & cancellation penalty');
  const rohanGroups = (await rohan.req('/api/groups/mine')).data.upcoming;
  const suv = rohanGroups.find((t) => t.vehicleType === 'SUV6' && t.isHost);
  check('seeded full SUV crew with waitlist', !!suv && suv.waitlistCount === 1 && suv.seatsLeft === 0);
  const suvK = (await kabir.req(`/api/groups/${suv.id}`)).data.trip;
  check('Kabir is waitlisted', suvK.myStatus === 'WAITLIST');
  const lateJoiner = await anon.req(`/api/groups/${suv.id}/join`, { body: { luggage: 0 } });
  check('full crew → new joiner waitlisted not overbooked', lateJoiner.status === 200 && lateJoiner.data.status === 'WAITLIST');
  await anon.req(`/api/groups/${suv.id}/leave`, { body: {} });
  // Rohan (host) leaves → host transfer + promotion + penalty
  const before = (await me(rohan)).trustScore;
  const leave = await rohan.req(`/api/groups/${suv.id}/leave`, { body: {} });
  check('host leave OK; confirmed-crew cancel penalised', leave.status === 200 && leave.data.penalty !== 'NONE' && !!leave.data.newHostId);
  check('Rohan trust dropped after cancel', (await me(rohan)).trustScore < before);
  const after = (await kabir.req(`/api/groups/${suv.id}`)).data.trip;
  check('top waitlisted student (Kabir) auto-promoted to JOINED', after.myStatus === 'JOINED');
  check('hosting passed to a remaining rider', after.hostId === leave.data.newHostId);

  section('Trip room: PIN boarding, live ride, fare split, UPI, dues lock');
  const live = (await rohan.req('/api/groups/mine')).data.active[0];
  check('seeded live in-progress trip for Rohan', !!live && live.status === 'IN_PROGRESS');
  const liveR = (await rohan.req(`/api/groups/${live.id}`)).data.trip;
  check('rider sees verified vehicle + plate', !!liveR.operator && /^UP-70-/.test(liveR.operator.plate));
  check('4-digit PIN exists (demo hint for riders)', /^\d{4}$/.test(liveR.demoPin || ''));
  const track = (await anon.req(`/api/track/${liveR.shareToken}`)).data;
  check('public tracking works without login (demo: simulated)', !!track && track.state === 'ON_THE_WAY' && track.progress > 0 && track.source === 'SIMULATED');
  check('public tracking hides PIN/email/last names', !JSON.stringify(track).match(/pin|@iiita|Verma|Sharma|phone/i));
  check('invalid tracking token → 404', (await anon.req('/api/track/not-a-real-token-123456')).status === 404);
  const g2 = (await rohan.req('/api/trips/search?date=' + d3)).data.trips.find((t) => t.mode === 'CAB' && t.genderPref === 'MIXED' && t.seatsLeft > 0 && !t.nightMode);
  const join2 = await rohan.req(`/api/groups/${g2.id}/join`, { body: { luggage: 1 } });
  check('join open crew', join2.status === 200 && join2.data.status === 'JOINED');
  const wrongPin = await rohan.req(`/api/groups/${g2.id}/board`, { body: { pin: '0000' } });
  const trip2 = (await rohan.req(`/api/groups/${g2.id}`)).data.trip;
  check('wrong PIN rejected (unless coincidentally right)', wrongPin.status === 400 || trip2.demoPin === '0000');
  check('boarding with correct PIN', (await rohan.req(`/api/groups/${g2.id}/board`, { body: { pin: trip2.demoPin } })).status === 200);
  const hostOfG2 = g2.hostName;
  check('non-host cannot start ride', (await rohan.req(`/api/groups/${g2.id}/status`, { body: { action: 'start' } })).status === 403);
  check('chat: member can send message', (await rohan.req(`/api/groups/${g2.id}/messages`, { body: { body: 'Hello crew!' } })).status === 201);
  check('chat: non-member blocked', (await ananya.req(`/api/groups/${g2.id}/messages`)).status === 403);

  // full lifecycle on a trip Rohan hosts
  const hosted = await rohan.req('/api/journeys', { body: { legs: [mkLeg({ date: future, windowStart: '07:00', windowEnd: '08:30', originId: pid('JHALWA'), destId: pid('SFG'), mode: 'CAB' })], autoMatch: true } });
  const hid = hosted.data.results[0].groupId;
  const hostedTrip = (await rohan.req(`/api/groups/${hid}`)).data.trip;
  check('host sees trip PIN', /^\d{4}$/.test(hostedTrip.pin || ''));
  const peer = await demo('student.lowtrust@iiita.ac.in');
  const pj = await peer.req(`/api/groups/${hid}/join`, { body: { luggage: 0 } });
  check('second rider joins hosted crew', pj.status === 200 && pj.data.status === 'JOINED');
  check('start requires a boarded rider', (await rohan.req(`/api/groups/${hid}/status`, { body: { action: 'start' } })).status === 409);
  await rohan.req(`/api/groups/${hid}/board`, { body: { pin: hostedTrip.pin } });
  await peer.req(`/api/groups/${hid}/board`, { body: { pin: (await peer.req(`/api/groups/${hid}`)).data.trip.demoPin } });
  check('confirm crew', (await rohan.req(`/api/groups/${hid}/status`, { body: { action: 'confirm' } })).status === 200);
  check('start ride', (await rohan.req(`/api/groups/${hid}/status`, { body: { action: 'start' } })).status === 200);
  check('complete trip', (await rohan.req(`/api/groups/${hid}/status`, { body: { action: 'complete' } })).status === 200);
  const rideCount = (await me(rohan)).completedRides;
  check('completed ride increments counter', rideCount >= 6);
  const fare = await rohan.req(`/api/groups/${hid}/fare`, { body: { total: 1200 } });
  check('fare split: ₹1200 / 2 riders + ₹5 fee = ₹605 each', fare.status === 200 && fare.data.split.perRider === 605 && fare.data.split.baseShare === 600);
  const kTrip = (await peer.req(`/api/groups/${hid}`)).data.trip;
  check('payer gets UPI deep-link with amount and tn=CampusCrew', kTrip.upi?.startsWith('upi://pay?') && kTrip.upi.includes('am=605') && kTrip.upi.includes('tn=CampusCrew'));
  check('rider share is UNPAID', kTrip.me.paymentStatus === 'UNPAID' && kTrip.me.shareAmount === 605);
  const dueBlock = await peer.req('/api/journeys', { body: { legs: [mkLeg({ date: future, windowStart: '15:00', windowEnd: '16:00' })], autoMatch: false } });
  check('booking locked on unpaid dues (DUES_PENDING)', dueBlock.status === 403 && dueBlock.data.code === 'DUES_PENDING');
  check('joining blocked on unpaid dues', (await peer.req(`/api/groups/${g2.id}/join`, { body: { luggage: 0 } })).status === 403);
  check('rider can mark paid', (await peer.req(`/api/groups/${hid}/payments`, { body: { status: 'PAID' } })).status === 200);
  check('lock lifted after settlement', (await peer.req('/api/journeys', { body: { legs: [mkLeg({ date: future, windowStart: '15:00', windowEnd: '16:00' })], autoMatch: false } })).status === 201);
  check('rate co-rider after trip', (await peer.req(`/api/groups/${hid}/rate`, { body: { rateeId: R.id, score: 5, punctual: true } })).status === 200);
  check('duplicate rating rejected', (await peer.req(`/api/groups/${hid}/rate`, { body: { rateeId: R.id, score: 5, punctual: true } })).status === 409);

  section('Delay handler & return sync');
  const d1 = await rohan.req('/api/journeys', { body: { legs: [{ originId: pid('IIITA-G1'), destId: pid('PRYJ'), date: future, windowStart: '16:00', windowEnd: '17:30', mode: 'TRAIN', trainNumber: '12301', genderPref: 'MIXED', luggage: 0, vehicleType: 'SHARED' }], autoMatch: true } });
  const did = d1.data.results[0].groupId;
  const dl = await rohan.req(`/api/groups/${did}/delay`, { body: { minutes: 25 } });
  check('delay simulator shifts pickup window by 25 min', dl.status === 200 && dl.data.windowStart === '16:25' && dl.data.windowEnd === '17:55');
  const dMsgs = (await rohan.req(`/api/groups/${did}/messages`)).data.messages;
  check('delay posts system alert to group chat', dMsgs.some((m) => m.kind === 'SYSTEM' && /delayed by 25 mins/.test(m.body)));
  const retr = await rohan.req(`/api/groups/${hid}/return`, { body: { date: addDays(future, 30) } });
  check('return sync creates reverse-route crew', retr.status === 201 && retr.data.groupId);
  const rt = (await rohan.req(`/api/groups/${retr.data.groupId}`)).data.trip;
  check('return trip route is reversed + crew cloned', rt.origin.code === 'SFG' && rt.dest.code === 'JHALWA' && rt.members.length >= 1);
  check('duplicate return sync blocked', (await rohan.req(`/api/groups/${hid}/return`, { body: { date: addDays(future, 30) } })).status === 409);
  const lv = await rohan.req(`/api/groups/${did}/leave`, { body: {} });
  check('exit after delay is penalty-free', lv.status === 200 && lv.data.penalty === 'NONE');

  section('SOS → admin console');
  const sos = await rohan.req(`/api/groups/${live.id}/sos`, { body: {} });
  check('SOS creates alert with GPS + helplines', sos.status === 201 && typeof sos.data.alert.lat === 'number' && sos.data.helplines.length >= 3);
  const saf = (await admin.req('/api/admin/safety')).data;
  const act = saf.alerts.find((a) => a.status === 'ACTIVE' && a.rider.name === 'Rohan Verma');
  check('admin queue shows the active SOS', !!act && saf.activeCount >= 1);
  check('non-member cannot trigger SOS', (await kabir.req(`/api/groups/${live.id}/sos`, { body: {} })).status === 403);
  check('student cannot access admin API', (await rohan.req('/api/admin/safety')).status === 403);
  const sse = await fetch(BASE + '/api/admin/stream', { headers: { cookie: admin.cookie } });
  const reader = sse.body.getReader();
  let got = '';
  const t0 = Date.now();
  while (Date.now() - t0 < 4000 && !got.includes('event: sos')) { const { value } = await reader.read(); got += new TextDecoder().decode(value); }
  await reader.cancel();
  check('admin SSE stream pushes SOS event', got.includes('event: sos') && got.includes('Rohan'));
  check('admin resolves SOS', (await admin.req(`/api/admin/alerts/${act.id}`, { body: { action: 'resolve' } })).status === 200);

  section('Real-time chat over SSE');
  const chatSse = await fetch(BASE + `/api/groups/${live.id}/stream`, { headers: { cookie: ananya.cookie } });
  const cr = chatSse.body.getReader();
  await ananya.req(`/api/groups/${live.id}/messages`, { body: { body: 'sse-ping-test' } });
  let chatBuf = ''; const t1 = Date.now();
  while (Date.now() - t1 < 5000 && !chatBuf.includes('sse-ping-test')) { const { value } = await cr.read(); chatBuf += new TextDecoder().decode(value); }
  await cr.cancel();
  check('chat message delivered through SSE', chatBuf.includes('event: message') && chatBuf.includes('sse-ping-test'));
  check('non-member SSE denied', (await fetch(BASE + `/api/groups/${live.id}/stream`, { headers: { cookie: kabir.cookie } })).status === 403);

  section('Buddy finder (privacy-first)');
  const kb = await kabir.req(`/api/buddies?number=12451&date=${d2}`);
  check('opt-out user must opt in first', kb.status === 200 && kb.data.optInRequired === true && kb.data.buddies.length === 0);
  const ab = await ananya.req(`/api/buddies?number=12451&date=${d2}`);
  check('opted-in user sees buddies', ab.status === 200 && ab.data.buddies.length >= 2);
  const keys = new Set(ab.data.buddies.flatMap((b) => Object.keys(b)));
  check('only first name, dept, year, trust, train/flight exposed', ['firstName', 'department', 'year', 'trustScore', 'number'].every((k) => keys.has(k)) && !['email', 'phone', 'seat', 'coach', 'hostel', 'userId', 'name', 'gender'].some((k) => keys.has(k)));
  check('non-visible students never listed', !JSON.stringify(ab.data).includes('Divya'));
  check('invalid train number rejected', (await ananya.req(`/api/buddies?number=abc&date=${future}`)).status === 400);
  const co = await rohan.req('/api/buddies/coordinate', { body: { number: '12417', date: d2, genderPref: 'MIXED', departs: '20:20', originId: pid('IIITA-G1'), stationId: pid('PRYJ'), destId: pid('NDLS') } });
  check('coordinate requires user-entered departure time (no hard-coded schedules)', (await rohan.req('/api/buddies/coordinate', { body: { number: '12417', date: d2, originId: pid('IIITA-G1'), stationId: pid('PRYJ') } })).status === 400);
  check('coordinate cab spins up linked Leg-1 cab group', co.status === 201 && !!co.data.groupId && co.data.invited >= 1);
  const coTrip = (await rohan.req(`/api/groups/${co.data.groupId}`)).data.trip;
  check('linked cab goes PRYJ-bound, tied to train 12417', coTrip.dest.code === 'PRYJ' && coTrip.trainNumber === '12417' && coTrip.mode === 'CAB');
  check('buddy-invite delivered as notification', (await (await demo('student.male@iiita.ac.in')).req('/api/notifications')).status === 200);

  section('Surge planner, eco, admin analytics');
  const sg = (await rohan.req('/api/surge')).data;
  check('surge: peak ≥2x on peak evening', sg.peak.multiplier >= 2 && sg.peak.hour >= 16 && sg.peak.hour <= 18 && sg.heat.length > 100);
  const eco = (await rohan.req('/api/eco')).data;
  check('eco: campus + personal + leaderboards populated', eco.campus.co2Kg > 0 && eco.campus.moneySaved > 0 && eco.mine.trips > 0 && eco.hostels.length >= 4 && eco.students.length >= 5);
  check('eco: hostels include GH-2 and BH-3', eco.hostels.some((h) => h.hostel === 'GH-2') && eco.hostels.some((h) => h.hostel === 'BH-3'));
  const dem = (await admin.req('/api/admin/demand')).data;
  check('admin: hourly demand + shuttle plan', dem.hours.length === 19 && dem.plan.length > 0 && dem.totalBuses > 0);
  const ov = (await admin.req('/api/admin/overview')).data;
  check('admin overview KPIs', ov.students >= 19 && ov.verified >= 19 && typeof ov.eco.moneySaved === 'number');

  section('Moderation: penalize / suspend');
  const reports = (await admin.req('/api/admin/safety')).data.reports.filter((r) => r.status === 'OPEN' && r.target);
  check('seeded open safety reports', reports.length >= 3);
  const rp = reports.find((r) => r.type === 'DISPUTE') ?? reports[0];
  const tBefore = rp.target.trustScore;
  check('penalize trust score', (await admin.req(`/api/admin/reports/${rp.id}`, { body: { action: 'penalize' } })).status === 200);
  const users = (await admin.req('/api/admin/users')).data.users;
  check('target trust adjusted after penalty', users.find((u) => u.id === rp.target.id).trustScore !== tBefore);
  const sp2 = reports.find((r) => r.id !== rp.id && r.target.id !== rp.target.id);
  check('suspend account', (await admin.req(`/api/admin/reports/${sp2.id}`, { body: { action: 'suspend' } })).status === 200);
  check('suspended flag visible', (await admin.req('/api/admin/users')).data.users.find((u) => u.id === sp2.target.id).suspended === true);
  check('report resolved', (await admin.req(`/api/admin/reports/${reports.find((r) => r.id !== rp.id && r.id !== sp2.id).id}`, { body: { action: 'resolve' } })).status === 200);
  const rep = await ananya.req(`/api/groups/${live.id}/report`, { body: { type: 'OTHER', description: 'Driver took a longer route than needed.' } });
  check('rider can file a report from trip room', rep.status === 201);

  section('Page rendering (authenticated)');
  for (const [c, paths] of [[rohan, ['/dashboard', '/trips', '/trips?tab=mine', '/trips/new', `/trips/${live.id}`, '/buddies', '/surge', '/eco', '/profile']], [admin, ['/admin', '/admin?tab=demand', '/admin?tab=safety', '/admin?tab=users']]]) {
    for (const p of paths) check(`GET ${p} → 200 (${c === admin ? 'admin' : 'student'})`, (await c.req(p, { raw: true })).status === 200);
  }
  check('public track page → 200', (await anon.req(`/track/${liveR.shareToken}`, { raw: true })).status === 200);
  check('unknown page → 404', (await anon.req('/definitely-not-a-page', { raw: true })).status === 404);

  console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
  if (fail) { console.log('Failures:\n - ' + failures.join('\n - ')); process.exit(1); }
})().catch((e) => { console.error('Smoke test crashed:', e); process.exit(1); });
