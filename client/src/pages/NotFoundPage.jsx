import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="text-2xl font-semibold text-slate-900">Page not found</h1>
      <p className="text-slate-600">The page you are looking for does not exist.</p>
      <Link to="/chat" className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        Go to chat
      </Link>
    </main>
  );
}
