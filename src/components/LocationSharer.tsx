'use client';

import { useEffect, useRef, useState } from 'react';
import { LocateFixed, LocateOff } from 'lucide-react';
import { api } from '@/lib/client';

/** Streams this rider's real GPS position to the trip (only while the ride is live and only while switched on). */
export function LocationSharer({ groupId, live }: { groupId: string; live: boolean }) {
  const [on, setOn] = useState(false);
  const [status, setStatus] = useState('');
  const watch = useRef<number | null>(null);
  const last = useRef(0);

  useEffect(() => {
    if (!on || !live) return;
    if (!('geolocation' in navigator)) { setStatus('This device does not support location.'); setOn(false); return; }
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - last.current < 8000) return;
        last.current = now;
        api(`/api/groups/${groupId}/location`, { body: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy } })
          .then(() => setStatus(`Sharing · accuracy ±${Math.round(pos.coords.accuracy)} m`)).catch((e: Error) => setStatus(e.message));
      },
      (err) => { setStatus(err.code === 1 ? 'Location permission denied. Enable it in your browser settings.' : 'Waiting for a GPS fix…'); if (err.code === 1) setOn(false); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => { if (watch.current != null) navigator.geolocation.clearWatch(watch.current); };
  }, [on, live, groupId]);

  if (!live) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm">
      <button className={on ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'} onClick={() => { setOn(!on); setStatus(on ? '' : 'Requesting location…'); }} data-testid="share-location">
        {on ? <LocateOff className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" />}{on ? 'Stop sharing my location' : 'Share my live location'}
      </button>
      <span className="text-xs text-slate-500">{status || 'Parents with your link see your real position. Keep this page open during the ride.'}</span>
    </div>
  );
}
