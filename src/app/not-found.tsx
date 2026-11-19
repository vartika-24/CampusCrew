import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div><div className="text-6xl font-extrabold text-brand-700">404</div><h1 className="mt-2 text-xl font-bold text-slate-900">This page took a different route</h1>
        <p className="mt-1 text-sm text-slate-500">The page you’re looking for doesn’t exist.</p><Link href="/" className="btn-primary mt-5">Back to CampusCrew</Link></div>
    </div>
  );
}
