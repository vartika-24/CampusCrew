# CampusCrew

Verified, gender-safe **cab / auto / bus / train / flight crew matching for Indian campuses** — pre-configured for **IIIT Allahabad (Prayagraj)** and the Diwali / end-semester vacation rush.

Students plan single- or multi-leg journeys, get matched into safe crews, chat in real time, share a live tracking link with parents, press SOS in an emergency, and split the fare over UPI. The college transport office gets a demand/shuttle planner and a live safety moderation console.

> Runs out of the box: **Next.js 14 (App Router) + TypeScript + Tailwind + Prisma + SQLite**. No Docker, no cloud services.

Live URL: https://campuscrew-b198.onrender.com/
## Quick start

```bash
npm install
npm run setup      # creates .env, generates Prisma client, creates dev.db, seeds IIITA demo data
npm run dev        # http://localhost:3000
```

Production build:

```bash
npm run build && npm start
```

Other scripts

| Script | What it does |
| --- | --- |
| `npm run db:reset` | wipe `prisma/dev.db` and re-seed from scratch |
| `npm run db:seed` | seed only if the DB is empty (idempotent; the server also auto-seeds an empty DB on boot) |
| `npm test` | unit tests (trust engine, fare split, gender filter, scoring, geo, validators) |
| `npm run smoke` | 130+ end-to-end API/page checks against a running server (`BASE_URL=http://localhost:3000`, run on a freshly seeded DB) |
| `npm run typecheck` | `tsc --noEmit` |

## Demo credentials

The login page has **one-click Demo Login** buttons. Standard email + OTP also works — in demo mode the simulated OTP is shown on screen.

| Account | Role | Notes |
| --- | --- | --- |
| `student.female@iiita.ac.in` | Ananya Sharma · B.Tech ECE · Female · GH-2 | Trust **96**. Hosts a girls-only 3-leg journey (Cab → Train 12451 → Auto) |
| `student.male@iiita.ac.in` | Rohan Verma · B.Tech IT · Male · BH-3 | Trust **92**. Hosts a full 6-seat SUV crew (Kabir waitlisted) and is in a **live** simulated ride (it arrives within ~2–10 min of seeding; the host can *Restart live simulation*) |
| `student.lowtrust@iiita.ac.in` | Kabir Singh · B.Tech ECE · Male · BH-2 | Trust **64**, 2 recent cancellations → deprioritised, blocked from night rides |
| `admin@iiita.ac.in` | IIITA Transport & Student Affairs Office | Admin console, SOS + moderation |

### 5-minute guided demo

1. **Rohan** → Dashboard → open the *Live now* trip: live route map, verified vehicle `UP-70-BN-2290`, chat, UPI fare split + QR. Press **SOS**.
2. **Admin** (second browser window) → `/admin?tab=safety`: red banner + alarm tone, SOS card with GPS; **Resolve**. Try **Penalize Trust Score** / **Suspend Account** on a report.
3. **Rohan** → *Copy parent link* → open `/track/<token>` in a private window (no login).
4. **Rohan** → upcoming SUV crew → *Leave this crew*: Kabir is **auto-promoted from the waitlist**, host passes on, Rohan's trust drops, fares recalculate.
5. **Ananya** → *Trips*: girls-only crews visible. Log in as **Rohan** and search the same route: none of them are returned (also 404 by direct URL / API).
6. **Kabir** → try joining a 22:00 trip → blocked by the night-ride trust restriction.
7. **Buddies** (Ananya/Rohan) → train `12451` or `12417`, date = the peak day (break start + 1) → opt-in buddies; *Coordinate Cab…* creates a linked Leg-1 cab crew.
8. **Surge** → "2.4× cab surge predicted on Nov 21, 5 PM" heat-map + *Lock Early Crew*. **Eco** → hostel (GH-2 vs BH-3) leaderboard.
9. Complete a trip you host (board with PIN → Start → Complete), enter fare `1200`: ₹305 each for 4 riders. Leave a rider UNPAID and see the **booking lock**.

Dates in the seed data are relative to the day you seed (break window = tomorrow … +4 days).

## Features → where they live

| Area | Implementation |
| --- | --- |
| Identity, OTP, ID check, **gender lock** | `src/app/api/auth/*`, `src/lib/validators.ts`, `User.genderLocked` (profile PATCH rejects gender changes) |
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
| Admin | `/admin`: overview, hourly demand to Junction/Airport + shuttle schedule, live SOS, reports (Resolve / Penalize / Suspend), student list |
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
* **Simulated by design** (no external services in a demo): OTP delivery (shown on screen when `DEMO_MODE=true`), registrar ID check, GPS (position is interpolated along the route and compressed in time so rides finish in minutes), and UPI settlement (members/host mark PAID).
* **Demand index** is an anonymised aggregate (`DemandSnapshot`) blended with live trip plans; surge multiplier = `1 + 0.5·log2(demand / normal-evening baseline)`.
* **Moving to PostgreSQL**: change `provider` and `DATABASE_URL` in `prisma/schema.prisma`/`.env`, then `prisma db push`.

## Configuration (`.env`)

```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="change-me"          # REQUIRED in production
DEMO_MODE="true"                 # false hides dev OTP + demo login
ALLOWED_EMAIL_SUFFIXES=".ac.in,.edu,.edu.in"
```
