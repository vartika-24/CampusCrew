import Link from 'next/link';
import { ArrowRight, BadgeCheck, Leaf, Lock, MapPinned, ShieldAlert, Train, Users, Wallet } from 'lucide-react';

const FEATURES = [
  { icon: Lock, title: 'Gender-lock & verified students', body: 'College email OTP + Student ID. Gender is locked at verification; girls-only trips never appear to anyone else.' },
  { icon: Users, title: 'Smart crew matching', body: 'Weighted by time overlap, cab fill & luggage, trust score and same-hostel night safety.' },
  { icon: Train, title: 'Multi-leg journeys', body: 'Cab → Train → Auto, each leg matched independently. Find same-train and same-flight buddies, opt-in only.' },
  { icon: ShieldAlert, title: 'Live tracking & SOS', body: 'Share a read-only trip link with parents. One tap SOS alerts campus security instantly.' },
  { icon: Wallet, title: 'UPI fare split', body: 'Auto split with a ₹5 fee, UPI deep-link & QR, and a booking lock on unpaid dues.' },
  { icon: Leaf, title: 'Save money, save CO₂', body: 'Vacation surge planner, eco impact dashboard and hostel leaderboard.' },
];

export default function Landing() {
  return (
    <div>
      <header className="bg-gradient-to-br from-brand-950 via-brand-900 to-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 text-lg font-extrabold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-emerald-300"><MapPinned className="h-4 w-4" /></span>CampusCrew</div>
          <Link href="/login" className="btn bg-white text-brand-900 hover:bg-brand-50">Sign in</Link>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pt-16">
          <span className="badge bg-emerald-400/15 text-emerald-300"><BadgeCheck className="h-3 w-3" />Live for IIIT Allahabad · Prayagraj</span>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">Going home for break? Go together — <span className="text-emerald-300">safely and for a fraction of the fare.</span></h1>
          <p className="mt-4 max-w-2xl text-lg text-indigo-100">Verified-student cab, auto, train and flight crews from campus to Prayagraj Junction, the airport and beyond. Gender-safe by design, privacy-first, and built for the Diwali / end-sem rush.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="btn bg-emerald-400 px-6 py-3 text-base text-slate-900 hover:bg-emerald-300">Try the live demo <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/login" className="btn border border-white/30 px-6 py-3 text-base text-white hover:bg-white/10">Sign up with college email</Link>
          </div>
          <dl className="mt-10 grid max-w-xl grid-cols-3 gap-4 text-center">
            {[['2.4×', 'peak cab surge avoided'], ['₹305', 'typical split per rider'], ['0', 'home addresses shared']].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-white/10 p-3"><dt className="text-2xl font-extrabold text-emerald-300">{v}</dt><dd className="text-xs text-indigo-100">{l}</dd></div>
            ))}
          </dl>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-extrabold text-slate-900">Built around safety, trust and savings</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card p-5">
              <div className="mb-3 inline-grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></div>
              <h3 className="font-bold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">CampusCrew · Public pickup points only — never home addresses · DPDP-aligned opt-in privacy</footer>
    </div>
  );
}
