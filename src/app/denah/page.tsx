import Link from 'next/link';
import { Suspense } from 'react';
import { requireUser } from '@/lib/auth';
import { rupiah } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { KavlingStatus } from '@/types/database';

const warnaStatus: Record<KavlingStatus, string> = {
  tersedia: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  dipesan: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  terjual: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

export default function DenahPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Denah kavling</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500 dark:text-zinc-400">Memuat denah…</p>}>
        <Denah />
      </Suspense>
    </main>
  );
}

async function Denah() {
  await requireUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('kavlings')
    .select('id, kode, blok, nomor, luas_m2, harga, status')
    .eq('aktif', true)
    .order('blok')
    .order('nomor');

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>;
  }
  if (!data?.length) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Belum ada kavling aktif.</p>;
  }

  const blokList = [...new Set(data.map((kavling) => kavling.blok))].sort((a, b) => a.localeCompare(b));

  return (
    <div className="flex flex-col gap-8">
      {blokList.map((blok) => (
        <section key={blok}>
          <h2 className="mb-3 text-lg font-semibold">Blok {blok}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data
              .filter((kavling) => kavling.blok === blok)
              .map((kavling) => (
                <article key={kavling.id} className={`rounded border p-3 ${warnaStatus[kavling.status]}`}>
                  <p className="font-semibold">{kavling.kode}</p>
                  <p className="text-xs">No. {kavling.nomor} · {kavling.luas_m2} m²</p>
                  <p className="text-sm">{rupiah(kavling.harga)}</p>
                  <p className="mt-1 text-xs uppercase">{kavling.status}</p>
                  {kavling.status === 'tersedia' ? (
                    <Link
                      className="mt-2 inline-block text-xs underline"
                      href={`/pesan/${kavling.id}`}
                    >
                      Pesan
                    </Link>
                  ) : null}
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
