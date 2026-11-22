import Link from 'next/link';
import { Suspense } from 'react';
import { requireRole } from '@/lib/auth';

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Area admin</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500 dark:text-zinc-400">Memeriksa akses…</p>}>
        <HalamanAdmin />
      </Suspense>
    </main>
  );
}

async function HalamanAdmin() {
  const user = await requireRole(['admin', 'pemilik']);
  return (
    <div className="flex flex-col gap-3">
      <p>Selamat datang, {user.nama}.</p>
      {user.role === 'admin' ? (
        <>
          <Link className="underline" href="/admin/kavling">Kelola kavling</Link>
          <Link className="underline" href="/admin/pembayaran">Verifikasi pembayaran</Link>
        </>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Peran pemilik hanya bisa membaca data.</p>
      )}
    </div>
  );
}
