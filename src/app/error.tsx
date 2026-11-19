'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div><h1 className="text-xl font-bold text-slate-900">Something went wrong</h1><p className="mt-1 text-sm text-slate-500">{error.message || 'Unexpected error'}</p><button onClick={reset} className="btn-primary mt-5">Try again</button></div>
    </div>
  );
}
