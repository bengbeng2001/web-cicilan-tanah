import Link from 'next/link';
import { Suspense } from 'react';
import { requireUser } from '@/lib/auth';

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500 dark:text-zinc-400">Memuat profil…</p>}>
        <Sesi />
      </Suspense>
      <form action="/auth/logout" method="post">
        <button type="submit" className="text-sm underline">Keluar</button>
      </form>
    </main>
  );
}

async function Sesi() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-3">
      <p>
        {user.nama} ({user.email}) — peran: <strong>{user.role}</strong>
      </p>
      {user.role === 'admin' || user.role === 'pemilik' ? (
        <Link className="underline" href="/admin">Buka area admin</Link>
      ) : null}
    </div>
  );
}
