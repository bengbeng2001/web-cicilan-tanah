import Link from 'next/link';
import { Suspense } from 'react';
import { requireUser } from '@/lib/auth';
import { rupiah } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export default function PesananPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Pesanan saya</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500 dark:text-zinc-400">Memuat pesanan…</p>}>
        <DaftarPesanan />
      </Suspense>
    </main>
  );
}

async function DaftarPesanan() {
  await requireUser();

  const supabase = await createClient();
  const [daftar, kavlings] = await Promise.all([
    supabase
      .from('pemesanan')
      .select('id, kode, kavling_id, metode, harga_terkunci, status, batas_bayar')
      .order('tgl_pesan', { ascending: false }),
    supabase.from('kavlings').select('id, kode, blok, nomor'),
  ]);

  const namaKavling = new Map(
    (kavlings.data ?? []).map((kavling) => [
      kavling.id,
      `${kavling.kode} (${kavling.blok}-${kavling.nomor})`,
    ]),
  );

  if (daftar.error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{daftar.error.message}</p>;
  }
  if (!daftar.data?.length) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Belum ada pesanan.</p>
        <Link className="underline" href="/denah">Lihat denah kavling</Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-2 pr-4">Kode</th>
            <th className="py-2 pr-4">Kavling</th>
            <th className="py-2 pr-4">Metode</th>
            <th className="py-2 pr-4">Harga terkunci</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Batas bayar</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {daftar.data.map((pesanan) => (
            <tr key={pesanan.id} className="border-b border-zinc-100 dark:border-zinc-900">
              <td className="py-2 pr-4">{pesanan.kode}</td>
              <td className="py-2 pr-4">{namaKavling.get(pesanan.kavling_id) ?? '-'}</td>
              <td className="py-2 pr-4">{pesanan.metode}</td>
              <td className="py-2 pr-4">{rupiah(pesanan.harga_terkunci)}</td>
              <td className="py-2 pr-4">{pesanan.status}</td>
              <td className="py-2 pr-4">
                {new Date(pesanan.batas_bayar).toLocaleDateString('id-ID')}
              </td>
              <td className="py-2">
                <Link className="underline" href={`/pesanan/${pesanan.id}`}>Detail</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
