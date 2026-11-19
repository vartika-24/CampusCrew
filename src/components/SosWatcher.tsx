'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Siren, Volume2, VolumeX } from 'lucide-react';

type Alert = { id: string; createdAt: string; rider: { name: string; hostel: string | null }; trip: { route: string; plate: string | null; id: string }; lat: number; lng: number };

/** Admin-wide live SOS banner (SSE) with audible alarm for new alerts. */
export function SosWatcher() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const ctxRef = useRef<AudioContext | null>(null);
  mutedRef.current = muted;

  useEffect(() => {
    function beep() {
      if (mutedRef.current) return;
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = (ctxRef.current ??= new AC());
        [0, 0.35, 0.7].forEach((t) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'square'; o.frequency.value = t === 0.35 ? 660 : 880; g.gain.value = 0.08;
          o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.25);
        });
      } catch { /* audio blocked until user gesture */ }
    }
    let es: EventSource | null = new EventSource('/api/admin/stream');
    es.addEventListener('sos', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { alerts: Alert[]; newIds: string[] };
      setAlerts(d.alerts);
      if (d.newIds.length) beep();
    });
    return () => { es?.close(); es = null; };
  }, []);

  if (alerts.length === 0) return null;
  return (
    <div role="alert" className="sticky top-14 z-30 border-b border-red-700 bg-red-600 text-white shadow-lg">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 text-sm">
        <Siren className="h-5 w-5 shrink-0 animate-pulse" />
        <div className="min-w-0 flex-1">
          <span className="font-extrabold">{alerts.length} ACTIVE SOS</span>
          <span className="ml-2 truncate">{alerts[0].rider.name} · {alerts[0].trip.route}{alerts[0].trip.plate ? ` · ${alerts[0].trip.plate}` : ''}</span>
        </div>
        <button onClick={() => setMuted((m) => !m)} className="rounded-lg bg-white/15 p-1.5 hover:bg-white/25" aria-label={muted ? 'Unmute alarm' : 'Mute alarm'}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
        <Link href="/admin?tab=safety" className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-700">Respond</Link>
      </div>
    </div>
  );
}
