'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BadgeCheck, Bell, BarChart3, Settings, Compass, Home, Leaf, LogOut, Plus, Shield, TicketsPlane, TrendingUp, User as UserIcon, Siren } from 'lucide-react';
import { useAuth } from './Providers';
import { api, fmtTimeAgo } from '@/lib/client';
import { PageLoader } from './ui';
import { SosWatcher } from './SosWatcher';

type Note = { id: string; kind: string; title: string; body: string; link: string | null; read: boolean; createdAt: string };

const STUDENT_NAV = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/trips', label: 'Trips', icon: Compass },
  { href: '/buddies', label: 'Buddies', icon: TicketsPlane },
  { href: '/surge', label: 'Surge', icon: TrendingUp },
  { href: '/eco', label: 'Eco', icon: Leaf },
];
const ADMIN_NAV = [
  { href: '/admin', label: 'Console', icon: Shield },
  { href: '/admin?tab=verification', label: 'IDs', icon: BadgeCheck },
  { href: '/admin?tab=demand', label: 'Demand', icon: BarChart3 },
  { href: '/admin?tab=safety', label: 'Safety', icon: Siren },
  { href: '/admin?tab=settings', label: 'Setup', icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, unread, logout, refresh } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [bell, setBell] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [loading, user, router, path]);
  useEffect(() => {
    const t = setInterval(() => { void refresh(); }, 20000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setBell(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (loading || !user) return <PageLoader text="Securing your session…" />;
  const isAdmin = user.role === 'ADMIN';
  const nav = isAdmin ? ADMIN_NAV : STUDENT_NAV;
  const isActive = (href: string) => (href.startsWith('/admin') ? false : path === href.split('?')[0] || path.startsWith(href.split('?')[0] + '/'));

  async function openBell() {
    setBell((b) => !b);
    if (!bell) {
      const r = await api<{ notifications: Note[] }>('/api/notifications').catch(() => ({ notifications: [] as Note[] }));
      setNotes(r.notifications);
      if (unread > 0) { await api('/api/notifications', { method: 'POST', body: {} }).catch(() => undefined); void refresh(); }
    }
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {isAdmin && <SosWatcher />}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href={isAdmin ? '/admin' : '/dashboard'} className="flex items-center gap-2 font-extrabold text-brand-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-900 text-emerald-300"><Compass className="h-4 w-4" /></span>
            <span className="hidden sm:inline">CampusCrew</span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${isActive(href) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Icon className="h-4 w-4" />{label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {!isAdmin && <Link href="/trips/new" className="btn-primary btn-sm hidden sm:inline-flex"><Plus className="h-4 w-4" />Plan trip</Link>}
            <div className="relative" ref={ref}>
              <button onClick={openBell} className="btn-ghost relative !p-2" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread}</span>}
              </button>
              {bell && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="border-b px-4 py-2.5 text-sm font-bold">Notifications</div>
                  <div className="max-h-80 overflow-y-auto">
                    {notes.length === 0 && <div className="p-4 text-sm text-slate-500">You are all caught up.</div>}
                    {notes.map((n) => (
                      <Link key={n.id} href={n.link ?? '#'} onClick={() => setBell(false)} className={`block border-b px-4 py-3 text-sm last:border-0 hover:bg-slate-50 ${n.read ? '' : 'bg-brand-50/50'}`}>
                        <div className="font-semibold text-slate-900">{n.title}</div>
                        <div className="text-slate-600">{n.body}</div>
                        <div className="mt-0.5 text-xs text-slate-400">{fmtTimeAgo(n.createdAt)}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Link href="/profile" className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-100" aria-label="Profile">
              <UserIcon className="h-5 w-5 text-slate-600" />
              <span className="hidden text-sm font-semibold text-slate-700 lg:inline">{user.name.split(' ')[0]}</span>
            </Link>
            <button onClick={logout} className="btn-ghost !p-2" aria-label="Sign out"><LogOut className="h-5 w-5" /></button>
          </div>
        </div>
      </header>
      {!isAdmin && user.idCardStatus !== 'VERIFIED' && (
        <div className={`border-b px-4 py-2 text-center text-sm font-medium ${user.idCardStatus === 'REJECTED' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`} role="status">
          {user.idCardStatus === 'REJECTED' ? 'Your ID was not accepted — ' : 'Your ID is awaiting review — you can browse mixed crews but cannot book yet. '}
          <Link href="/profile" className="font-bold underline">{user.idCardStatus === 'REJECTED' ? 'upload a new ID' : 'check status'}</Link>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Mobile">
        <div className="grid grid-cols-5">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive(href) ? 'text-brand-700' : 'text-slate-500'}`}>
              <Icon className="h-5 w-5" />{label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
