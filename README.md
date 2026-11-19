# CampusCrew

Verified, gender-safe **cab / auto / bus / train / flight crew matching for Indian campuses** — pre-configured for **IIIT Allahabad (Prayagraj)** and the Diwali / end-semester vacation rush.

Students (verified against a government ID) plan single- or multi-leg journeys, get matched into safe crews, chat in real time, share a live tracking link with parents, press SOS in an emergency, and split the fare over UPI. The college transport office gets a demand/shuttle planner and a live safety moderation console.

> Runs out of the box: **Next.js 14 (App Router) + TypeScript + Tailwind + Prisma + SQLite**. No Docker, no cloud services.

Live URL: https://campuscrew-b198.onrender.com/

## Two ways to run it

| | **Production** (real students) | **Demo** (try it / present it) |
| --- | --- | --- |
| `DEMO_MODE` | `false` (default) | `true` |
| Data | starts **empty** — no sample users, trips, places, operators or demand | seeds IIITA **sample** accounts, trips, chats, reports and demand |
| OTP | emailed through Brevo / SendGrid | emailed if a provider is configured, otherwise shown on screen |
| ID check | mandatory government ID, reviewed by an admin | same (seeded demo users are pre-verified) |
| Live tracking | real GPS from riders' phones | simulated along a pseudo-route |
| Demo login buttons | disabled | enabled |

### Production setup

```bash
cp .env.example .env     # then fill it in (see below)
npm install
npx prisma db push       # creates the database
npm run build && npm start
```

Required `.env` values

| Variable | Purpose |
| --- | --- |
| `DEMO_MODE=false` | no sample data, no demo login, no simulated GPS |
| `AUTH_SECRET` | random 32+ chars (`openssl rand -hex 32`); the server refuses to start sessions without it |
| `ADMIN_EMAILS` | comma-separated Student-Affairs emails; each becomes an admin the first time they sign in with an OTP |
| `ALLOWED_EMAIL_DOMAINS` | default `iiita.ac.in` (subdomains included) — nobody else can register |
| `EMAIL_PROVIDER` | `brevo` or `sendgrid` |
| `EMAIL_API_KEY` | API key from the provider (never commit it) |
| `EMAIL_FROM_ADDRESS` / `EMAIL_FROM_NAME` | sender; the address/domain must be verified with the provider |
| `DATABASE_URL` | SQLite file by default; PostgreSQL works after changing the datasource `provider` in `prisma/schema.prisma` |

Serve it behind HTTPS (cookies are marked `Secure` when `x-forwarded-proto: https`). Use a **fresh database**: the server warns at boot if demo accounts exist in a non-demo deployment.

### First-day checklist for the admin (Student Affairs)

1. Sign in at `/login` with an `ADMIN_EMAILS` address (OTP arrives by email).
2. **Admin → Places**: add the real pickup points and destinations (name, code, type, latitude/longitude). *Load IIITA starter list* adds the points from the project brief with **approximate coordinates — verify them**.
3. **Admin → Operators**: add only licensed drivers/vehicles you have verified (plate, vehicle, contact shown to riders). Crews without an operator still work.
4. **Admin → Settings**: campus helpline numbers (shown after SOS; national 112 / 1091 / 108 are preloaded), hostel and department lists, shuttle bus capacity, vacation window and return date.
5. **Admin → ID verification**: approve or reject new students (see below).

### Identity & gender verification (how it really works)

* Email OTP proves the student controls an `@iiita.ac.in` mailbox.
* The student must then upload a **photo of a government ID** — Aadhaar (masked is fine), passport, voter ID or driving licence — and declare name, roll number and gender. The upload is **mandatory**: the server checks the file is a genuine JPG/PNG/WebP (magic bytes, ≥ 400×250 px, ≤ 4 MB) and rejects look-alike files and re-used images.
* The account is **pending**: the student cannot plan or join trips, use buddies, and is only shown *mixed* crews (self-declared gender is never trusted for visibility).
* A **human admin** compares the ID photo/name/gender with the profile, can correct the gender, ticks a confirmation, and approves — which **locks gender permanently** — or rejects with a reason (the student is emailed and can re-upload).
* The ID image is private (served only to admins, `no-store`), and is **permanently deleted the moment a decision is made**. Only a hash is kept to stop the same image being used on two accounts. No ID number is ever stored.

Automated gender verification from a photo isn't reliable, so this deliberately uses human review. If you later want automated KYC (e.g. DigiLocker), it plugs in at `src/app/api/admin/verifications/[id]/route.ts`.

### Real-time location

During a live ride riders tap **Share my live location**; their phone's GPS is sent every ~8 s and used by the public `/track/<token>` page (and for SOS). If nobody is sharing, parents see "no live location" instead of a fake map, and an SOS without GPS is clearly flagged *approximate*. GPS pings are deleted when the trip completes.

## Demo mode

```bash
npm install
npm run setup      # creates .env with DEMO_MODE=true, the database and sample data
npm run dev        # http://localhost:3000
```

The login page then shows one-click demo buttons.

| Account | Role | Notes |
| --- | --- | --- |
| `student.female@iiita.ac.in` | Ananya Sharma · B.Tech ECE · Female · GH-2 | Trust **96**. Hosts a girls-only 3-leg journey (Cab → Train → Auto) |
| `student.male@iiita.ac.in` | Rohan Verma · B.Tech IT · Male · BH-3 | Trust **92**. Hosts a full 6-seat SUV crew (Kabir waitlisted) and is in a **live** simulated ride |
| `student.lowtrust@iiita.ac.in` | Kabir Singh · B.Tech ECE · Male · BH-2 | Trust **64**, 2 recent cancellations → deprioritised, blocked from night rides |
| `admin@iiita.ac.in` | Transport & Student Affairs Office | Admin console |

Demo-only data: the sample users and their trust scores, trips, chats, reports, demand index and operators. None of it is created unless `DEMO_MODE=true`. Dates are relative to the day you seed.

Handy flows: *Rohan → Live now → SOS* then *Admin → Safety queue*; *Rohan → leave the full SUV* (waitlist promotion); *Kabir → join a 22:00 trip* (night restriction); *register a new student, then approve the ID as admin*.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run setup` | local dev: `.env` (demo), Prisma client, database, demo seed |
| `npm run db:reset` | **demo only** — wipe the database and re-seed samples (refuses unless `DEMO_MODE=true`) |
| `npm test` | unit tests (trust, fare, gender filter, scoring, geo, validators, image checks, email providers) |
| `npm run smoke` | ~160 end-to-end checks in demo mode (`BASE_URL=http://localhost:3000`, fresh `db:reset` first) |
| `npm run smoke:prod` | ~50 end-to-end checks in **production mode** against a throw-away DB and a mock Brevo API (run after `npm run build`) |
| `npm run typecheck` / `npm run lint` | static checks |

## Features → where they live

| Area | Implementation |
| --- | --- |
| Identity, email OTP, government-ID review, **gender lock** | `src/app/api/auth/*`, `src/lib/{email,image,idverify}.ts`, `src/app/api/admin/verifications/*`, `User.genderLocked` |
| **Trust score** (0–100) | `src/lib/safety/trust.ts` (base 50 + rides + rating + punctuality − late-cancel/report penalties); recompute in `safety/guards.ts` |
| **Gender hard filter** | `src/lib/safety/gender.ts` `genderWhere()` is AND-ed into every group query; direct fetches return 404 |
| Multi-leg journeys | `Journey` → `TripSegment` (one per leg) → matched independently (`/api/journeys`, `/trips/new`, `/journeys/[id]`) |
| **Weighted matching** | `src/lib/matching/scoring.ts` — time 35 % · cab-fill & luggage 25 % · trust/punctuality 25 % · hostel/night affinity 15 %; capacity & night rules are hard gates; `engine.ts` search/join/host |
| Waitlist promotion & reshuffle | `engine.ts` `leaveGroup` → penalty, host hand-over, `promoteWaitlist` (ranked by score), fare re-split |
| Buddy finder | `/api/buddies*`, `/buddies` — opt-in, same-college only, exposes first name, dept, year, trust, number only |
| Trip room | `/trips/[id]`: operator + plate, 4-digit **PIN boarding** (5-try lockout), chat, live map, SOS, UPI split/QR, delay simulator, return sync, ratings, reports |
| Real-time | **Server-Sent Events** (`/api/groups/[id]/stream`, `/api/admin/stream`) with polling fallback in the client |
| Public live link | `/track/[token]` (+ `/api/track/[token]`), revocable token, first names only, no PIN/phone/seat |
| UPI fare split | `src/lib/fare.ts` (`₹1200 / 4 + ₹5 = ₹305`), `upi://pay?...&tn=CampusCrew`, QR (`qrcode.react`), PAID/UNPAID tracking, **booking lock on unpaid dues** |
| Surge planner | `src/lib/surge.ts`, `/surge` (bar chart + day×hour heat-map + multiplier) |
| Eco dashboard | `src/lib/eco.ts`, `/eco` (money saved, solo cabs eliminated, CO₂, hostel & student leaderboards) |
| Admin | `/admin`: overview, **ID verification**, hourly demand + shuttle schedule, live SOS, reports (Resolve / Penalize / Suspend), students, **places, operators, settings** |
| PWA | `public/manifest.webmanifest`, icons, `public/sw.js` (app-shell cache; API never cached), mobile-first layout with bottom nav |

## Architecture

```
src/
  app/                 Next.js App Router (pages + API route handlers)
    (app)/             authenticated shell: dashboard, trips, journeys, buddies, surge, eco, profile, admin
    api/               REST + SSE endpoints (all wrapped by lib/api.ts `handle`)
    track/[token]/     public read-only live tracking
  components/          UI (AppShell, TripCard, Chat, FareCard, RouteMap, SosWatcher …)
  lib/
    matching/          scoring.ts (pure, weighted) · engine.ts (DB ops) · parse.ts
    safety/            trust.ts · gender.ts · guards.ts (dues / night / trust recompute) · sos.ts
    seed/              idempotent IIITA seed (auto-runs on boot when DB is empty)
    auth.ts            JWT (jose) httpOnly cookie sessions; OTP hashed with bcryptjs
  middleware.ts        redirects unauthenticated page requests to /login
prisma/schema.prisma   data model (SQLite; enum-like fields are Strings → PostgreSQL-compatible)
tests/                 node:test unit tests        scripts/smoke.mjs   E2E smoke suite
```

Key decisions
* **Privacy**: only public pickup points/hubs are selectable — never home addresses. Buddy search is opt-in + reciprocal; coach/seat/phone are never stored or shown. ID-card images are never returned by any API.
* **Hard security filters live server-side**: gender filter, night-ride trust gate, dues lock, membership checks on chat/SSE/SOS, admin role checks.
* **Simulated only in demo mode**: on-screen OTP (no provider), pseudo-route GPS and the sample data. In production the only manual step is UPI settlement — the app builds the UPI link/QR, and the rider/host marks PAID (no payment gateway).
* **Demand / surge** is computed from real trip plans (`TripSegment`); in demo mode a sample anonymised index (`DemandSnapshot`) is added. Multiplier = `1 + 0.5·log2(demand / normal-evening baseline)`, shown only with at least 10 students in the hour — otherwise the planner says there isn't enough data.
* **Moving to PostgreSQL**: change `provider` and `DATABASE_URL` in `prisma/schema.prisma`/`.env`, then `prisma db push`.

See `.env.example` for every setting.
