import Link from 'next/link';
import { Suspense } from 'react';
import { requireUser } from '@/lib/auth';
import { rupiah } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

type Props = PageProps<'/pesanan/[id]'>;

export default function DetailPesananPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Detail pesanan</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500 dark:text-zinc-400">Memuat pesanan…</p>}>
        <Detail params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Detail({ params, searchParams }: Props) {
  await requireUser();

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: pesanan, error } = await supabase
    .from('pemesanan')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>;
  }
  if (!pesanan) {
    return (
      <div className="flex flex-col gap-3">
        <p>Pesanan tidak ditemukan.</p>
        <Link className="underline" href="/pesanan">Kembali ke pesanan saya</Link>
      </div>
    );
  }

  const [{ data: kavling }, { data: tagihan }] = await Promise.all([
    supabase.from('kavlings').select('kode, blok, nomor, luas_m2').eq('id', pesanan.kavling_id).maybeSingle(),
    supabase
      .from('tagihan')
      .select('id, jenis, urutan, jatuh_tempo, nominal, status')
      .eq('pemesanan_id', pesanan.id)
      .order('urutan'),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {query.ok ? <p className="text-sm text-green-700 dark:text-green-400">Pesanan berhasil dibuat.</p> : null}

      <section className="grid gap-2 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <p><strong>{pesanan.kode}</strong> — {pesanan.status}</p>
        <p>
          Kavling {kavling ? `${kavling.kode} (${kavling.blok}-${kavling.nomor}, ${kavling.luas_m2} m²)` : '-'}
        </p>
        <p>Metode: {pesanan.metode}</p>
        <p>Harga terkunci: {rupiah(pesanan.harga_terkunci)}</p>
        {pesanan.metode === 'cicil' ? (
          <p>
            DP {pesanan.dp_persen}% · {pesanan.tenor_bulan} bulan · angsuran {rupiah(pesanan.nominal_angsuran ?? 0)}
          </p>
        ) : null}
        <p>Batas bayar: {new Date(pesanan.batas_bayar).toLocaleDateString('id-ID')}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Tagihan</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-2 pr-4">No</th>
                <th className="py-2 pr-4">Jenis</th>
                <th className="py-2 pr-4">Jatuh tempo</th>
                <th className="py-2 pr-4">Nominal</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tagihan?.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4">{item.urutan}</td>
                  <td className="py-2 pr-4">{item.jenis}</td>
                  <td className="py-2 pr-4">
                    {new Date(`${item.jatuh_tempo}T00:00:00`).toLocaleDateString('id-ID')}
                  </td>
                  <td className="py-2 pr-4">{rupiah(item.nominal)}</td>
                  <td className="py-2 pr-4">{item.status}</td>
                  <td className="py-2">
                    {item.status === 'lunas' ? null : (
                      <Link className="underline" href={`/tagihan/${item.id}`}>Bayar</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Klik Bayar untuk melihat rekening tujuan dan mengunggah bukti transfer.
        </p>
      </section>

      <Link className="underline" href="/pesanan">Kembali ke pesanan saya</Link>
    </div>
  );
}
