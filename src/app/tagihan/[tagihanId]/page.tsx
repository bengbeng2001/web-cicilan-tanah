import Link from 'next/link';
import { Suspense } from 'react';
import { requireUser } from '@/lib/auth';
import { rupiah } from '@/lib/format';
import { tanggalJakarta } from '@/lib/simulasi';
import { createClient } from '@/lib/supabase/server';
import { unggahBukti } from './actions';

type Props = PageProps<'/tagihan/[tagihanId]'>;

export default function TagihanPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Bayar tagihan</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500 dark:text-zinc-400">Memuat tagihan…</p>}>
        <Pembayaran params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Pembayaran({ params, searchParams }: Props) {
  await requireUser();

  const [{ tagihanId }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: tagihan, error } = await supabase
    .from('tagihan')
    .select('id, pemesanan_id, jenis, urutan, jatuh_tempo, nominal, status')
    .eq('id', tagihanId)
    .maybeSingle();

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>;
  }
  if (!tagihan) {
    return (
      <div className="flex flex-col gap-3">
        <p>Tagihan tidak ditemukan.</p>
        <Link className="underline" href="/pesanan">Kembali ke pesanan saya</Link>
      </div>
    );
  }

  const [pembayaran, pengaturan, pesanan] = await Promise.all([
    supabase
      .from('pembayaran')
      .select('id, nominal_pokok, denda, total, bukti_path, status, alasan_tolak, no_kwitansi, tgl_upload')
      .eq('tagihan_id', tagihan.id)
      .maybeSingle(),
    supabase.from('pengaturan').select('nilai').eq('kunci', 'rekening').maybeSingle(),
    supabase
      .from('pemesanan')
      .select('id, kode, kavling_id')
      .eq('id', tagihan.pemesanan_id)
      .maybeSingle(),
  ]);

  const denda = await supabase.rpc('hitung_denda', {
    p_nominal: tagihan.nominal,
    p_jatuh_tempo: tagihan.jatuh_tempo,
    p_tgl_upload: tanggalJakarta(),
    p_kavling_id: pesanan.data?.kavling_id,
  });
  const dendaPreview = tagihan.jenis === 'angsuran' ? (denda.data ?? 0) : 0;

  const rekening = (pengaturan.data?.nilai ?? {}) as unknown as {
    bank?: string;
    nomor?: string;
    atas_nama?: string;
  };

  let tautanBukti: string | null = null;
  if (pembayaran.data?.bukti_path) {
    const { data: signed } = await supabase.storage
      .from('bukti-transfer')
      .createSignedUrl(pembayaran.data.bukti_path, 3600);
    tautanBukti = signed?.signedUrl ?? null;
  }

  const pesanError = Array.isArray(query.error) ? query.error.join(', ') : query.error;
  const bisaUnggah = !pembayaran.data || pembayaran.data.status === 'ditolak';

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-2 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <p><strong>{pesanan.data?.kode ?? '-'}</strong> — tagihan {tagihan.jenis} #{tagihan.urutan}</p>
        <p>Jatuh tempo: {new Date(`${tagihan.jatuh_tempo}T00:00:00`).toLocaleDateString('id-ID')}</p>
        <p>Pokok: {rupiah(pembayaran.data?.nominal_pokok ?? tagihan.nominal)}</p>
        <p>Denda: {rupiah(pembayaran.data?.denda ?? dendaPreview)}</p>
        <p className="text-base">
          <strong>Total: {rupiah(pembayaran.data?.total ?? tagihan.nominal + dendaPreview)}</strong>
        </p>
        <p>Status tagihan: {tagihan.status}</p>
      </section>

      <section className="rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <h2 className="mb-2 font-semibold">Rekening tujuan</h2>
        <p>{rekening.bank ?? '-'} — {rekening.nomor ?? '-'}</p>
        <p>a.n. {rekening.atas_nama ?? '-'}</p>
      </section>

      {pesanError ? <p className="text-sm text-red-600 dark:text-red-400">{pesanError}</p> : null}
      {query.ok ? <p className="text-sm text-green-700 dark:text-green-400">Bukti berhasil diunggah. Menunggu verifikasi admin.</p> : null}

      {pembayaran.data ? (
        <section className="flex flex-col gap-2 text-sm">
          <p>Status pembayaran: <strong>{pembayaran.data.status}</strong></p>
          {pembayaran.data.status === 'ditolak' ? (
            <p className="text-red-600 dark:text-red-400">
              Alasan: {pembayaran.data.alasan_tolak ?? '-'}
            </p>
          ) : null}
          {pembayaran.data.no_kwitansi ? (
            <p>
              Kwitansi {pembayaran.data.no_kwitansi} —{' '}
              <a className="underline" href={`/kwitansi/${pembayaran.data.id}`}>
                Unduh PDF
              </a>
            </p>
          ) : null}
          {tautanBukti ? (
            <a className="underline" href={tautanBukti} target="_blank" rel="noreferrer">Lihat bukti yang diunggah</a>
          ) : null}
        </section>
      ) : null}

      {bisaUnggah ? (
        <form action={unggahBukti} encType="multipart/form-data" className="flex flex-col gap-3">
          <input type="hidden" name="tagihan_id" defaultValue={tagihan.id} />
          <label className="flex flex-col gap-1 text-sm">
            Bukti transfer (JPG, PNG, PDF — maksimal 2 MB)
            <input
              type="file"
              name="bukti"
              accept="image/jpeg,image/png,application/pdf"
              required
              className="text-sm"
            />
          </label>
          <button type="submit" className="self-start rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
            Unggah bukti
          </button>
        </form>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {pembayaran.data?.status === 'menunggu'
            ? 'Menunggu verifikasi admin.'
            : 'Tagihan ini sudah lunas.'}
        </p>
      )}

      <Link className="underline" href={`/pesanan/${tagihan.pemesanan_id}`}>Kembali ke detail pesanan</Link>
    </div>
  );
}
