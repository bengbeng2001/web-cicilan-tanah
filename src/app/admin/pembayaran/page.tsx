import Link from 'next/link';
import { Suspense } from 'react';
import { requireRole } from '@/lib/auth';
import { rupiah } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { verifikasiPembayaran } from './actions';

type Props = PageProps<'/admin/pembayaran'>;

export default function VerifikasiPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Antrean pembayaran</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500 dark:text-zinc-400">Memuat antrean…</p>}>
        <Antrean searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Antrean({ searchParams }: Pick<Props, 'searchParams'>) {
  await requireRole(['admin']);
  const query = await searchParams;

  const supabase = await createClient();
  const [{ data: daftar, error }, { data: terbit }] = await Promise.all([
    supabase
      .from('pembayaran')
      .select('id, tagihan_id, nominal_pokok, denda, total, bukti_path, tgl_upload')
      .eq('status', 'menunggu')
      .order('tgl_upload'),
    supabase
      .from('pembayaran')
      .select('id, no_kwitansi, tgl_verifikasi')
      .eq('status', 'terverifikasi')
      .not('no_kwitansi', 'is', null)
      .order('tgl_verifikasi', { ascending: false })
      .limit(20),
  ]);

  const pesanError = Array.isArray(query.error) ? query.error.join(', ') : query.error;
  const daftarKwitansi = (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Kwitansi terbit</h2>
      {terbit?.length ? (
        terbit.map((item) => (
          <a key={item.id} className="text-sm underline" href={`/kwitansi/${item.id}`}>
            {item.no_kwitansi} — {new Date(item.tgl_verifikasi!).toLocaleDateString('id-ID')}
          </a>
        ))
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Belum ada kwitansi.</p>
      )}
    </section>
  );

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>;
  }
  if (!daftar?.length) {
    return (
      <div className="flex flex-col gap-3">
        {pesanError ? <p className="text-sm text-red-600 dark:text-red-400">{pesanError}</p> : null}
        {query.ok ? <p className="text-sm text-green-700 dark:text-green-400">Pembayaran diperbarui.</p> : null}
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Tidak ada bukti yang menunggu verifikasi.</p>
        {daftarKwitansi}
      </div>
    );
  }

  const { data: tagihanList } = await supabase
    .from('tagihan')
    .select('id, pemesanan_id, jenis, urutan')
    .in('id', daftar.map((item) => item.tagihan_id));
  const { data: pesananList } = await supabase
    .from('pemesanan')
    .select('id, kode, user_id, kavling_id')
    .in('id', [...new Set((tagihanList ?? []).map((item) => item.pemesanan_id))]);
  const [{ data: profilList }, { data: kavlingList }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nama')
      .in('id', [...new Set((pesananList ?? []).map((item) => item.user_id))]),
    supabase
      .from('kavlings')
      .select('id, kode, blok, nomor')
      .in('id', [...new Set((pesananList ?? []).map((item) => item.kavling_id))]),
  ]);

  const tagihanById = new Map((tagihanList ?? []).map((item) => [item.id, item]));
  const pesananById = new Map((pesananList ?? []).map((item) => [item.id, item]));
  const profilById = new Map((profilList ?? []).map((item) => [item.id, item.nama]));
  const kavlingById = new Map(
    (kavlingList ?? []).map((item) => [item.id, `${item.kode} (${item.blok}-${item.nomor})`]),
  );

  const pasanganUrl = await Promise.all(
    daftar.map(async (item) => {
      const { data: signed } = await supabase.storage
        .from('bukti-transfer')
        .createSignedUrl(item.bukti_path, 3600);
      return [item.id, signed?.signedUrl ?? null] as const;
    }),
  );
  const urlBukti = new Map(pasanganUrl);

  return (
    <div className="flex flex-col gap-6">
      {pesanError ? <p className="text-sm text-red-600 dark:text-red-400">{pesanError}</p> : null}
      {query.ok ? <p className="text-sm text-green-700 dark:text-green-400">Pembayaran diperbarui.</p> : null}

      {daftar.map((pembayaran) => {
        const tagihan = tagihanById.get(pembayaran.tagihan_id);
        const pesanan = tagihan ? pesananById.get(tagihan.pemesanan_id) : undefined;
        return (
          <section key={pembayaran.id} className="grid gap-3 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800">
            <p>
              <strong>{pesanan?.kode ?? '-'}</strong> — {profilById.get(pesanan?.user_id ?? '') ?? '-'} —{' '}
              {kavlingById.get(pesanan?.kavling_id ?? '') ?? '-'}
            </p>
            <p>
              Tagihan {tagihan?.jenis ?? '-'} #{tagihan?.urutan ?? '-'} · pokok {rupiah(pembayaran.nominal_pokok)} · denda{' '}
              {rupiah(pembayaran.denda)} · <strong>total {rupiah(pembayaran.total)}</strong>
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Diunggah {new Date(pembayaran.tgl_upload).toLocaleString('id-ID')}
            </p>
            {urlBukti.get(pembayaran.id) ? (
              <a
                className="underline"
                href={urlBukti.get(pembayaran.id)!}
                target="_blank"
                rel="noreferrer"
              >
                Lihat bukti transfer
              </a>
            ) : (
              <p className="text-xs text-red-600 dark:text-red-400">Bukti tidak dapat ditampilkan.</p>
            )}

            <form action={verifikasiPembayaran} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="pembayaran_id" defaultValue={pembayaran.id} />
              <input
                name="alasan"
                placeholder="Alasan bila ditolak"
                className="min-w-56 flex-1 rounded border border-zinc-300 px-3 py-2 text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
              <button
                type="submit"
                name="keputusan"
                value="tolak"
                className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700"
              >
                Tolak
              </button>
              <button
                type="submit"
                name="keputusan"
                value="setuju"
                className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Setujui
              </button>
            </form>
          </section>
        );
      })}

      {daftarKwitansi}

      <Link className="underline" href="/admin">Kembali ke area admin</Link>
    </div>
  );
}
