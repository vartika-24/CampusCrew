'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Wifi, WifiOff } from 'lucide-react';
import { api } from '@/lib/client';
import { useToast } from './Providers';

type Msg = { id: string; kind: string; body: string; createdAt: string; userId: string | null; author: string | null };

/** Group chat: loads history, then listens on a Server-Sent Events stream (polling fallback). */
export function Chat({ groupId, meId, onState, disabled }: { groupId: string; meId: string; onState?: () => void; disabled?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [live, setLive] = useState(false);
  const [sending, setSending] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<string>('');
  const toast = useToast();

  const merge = useCallback((incoming: Msg[]) => {
    setMsgs((cur) => {
      const ids = new Set(cur.map((m) => m.id));
      const add = incoming.filter((m) => !ids.has(m.id));
      if (!add.length) return cur;
      const all = [...cur, ...add].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      last.current = all[all.length - 1].createdAt;
      return all;
    });
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | undefined;
    let dead = false;

    const startPolling = () => {
      if (poll || dead) return;
      poll = setInterval(async () => {
        try { merge((await api<{ messages: Msg[] }>(`/api/groups/${groupId}/messages${last.current ? `?after=${encodeURIComponent(last.current)}` : ''}`)).messages); onState?.(); } catch { /* retry */ }
      }, 3000);
    };

    (async () => {
      try {
        const h = await api<{ messages: Msg[] }>(`/api/groups/${groupId}/messages`);
        if (dead) return;
        merge(h.messages);
        es = new EventSource(`/api/groups/${groupId}/stream${last.current ? `?after=${encodeURIComponent(last.current)}` : ''}`);
        es.addEventListener('ready', () => setLive(true));
        es.addEventListener('message', (e) => merge([JSON.parse((e as MessageEvent).data)]));
        es.addEventListener('state', () => onState?.());
        es.onerror = () => { setLive(false); es?.close(); startPolling(); };
      } catch { startPolling(); }
    })();
    return () => { dead = true; es?.close(); if (poll) clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, merge]);

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' }); }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try { const r = await api<{ message: Msg }>(`/api/groups/${groupId}/messages`, { body: { body } }); merge([r.message]); setText(''); }
    catch (x) { toast.push('error', (x as Error).message); } finally { setSending(false); }
  }

  return (
    <div className="card flex h-[28rem] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <h3 className="font-bold text-slate-900">Crew chat</h3>
        <span className={`flex items-center gap-1 text-xs font-semibold ${live ? 'text-emerald-600' : 'text-slate-400'}`}>{live ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}{live ? 'Live' : 'Syncing'}</span>
      </div>
      <div ref={box} className="flex-1 space-y-2 overflow-y-auto bg-slate-50 px-3 py-3" aria-live="polite">
        {msgs.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No messages yet. Say hi 👋</p>}
        {msgs.map((m) => m.kind === 'SYSTEM' ? (
          <div key={m.id} className="mx-auto max-w-[90%] rounded-full bg-slate-200/80 px-3 py-1 text-center text-xs font-medium text-slate-600">{m.body}</div>
        ) : (
          <div key={m.id} className={`flex ${m.userId === meId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.userId === meId ? 'rounded-br-sm bg-brand-600 text-white' : 'rounded-bl-sm bg-white text-slate-800 shadow-sm'}`}>
              {m.userId !== meId && <div className="mb-0.5 text-xs font-bold text-brand-700">{m.author}</div>}
              <div className="whitespace-pre-wrap break-words">{m.body}</div>
              <div className={`mt-0.5 text-right text-[10px] ${m.userId === meId ? 'text-indigo-200' : 'text-slate-400'}`}>{new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={disabled ? 'Chat is closed' : 'Message your crew…'} maxLength={600} disabled={disabled} aria-label="Message" />
        <button className="btn-primary !px-3.5" disabled={!text.trim() || sending || disabled} aria-label="Send"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
}
