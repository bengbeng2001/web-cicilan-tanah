import Link from 'next/link';
import { Suspense } from 'react';
import { requireUser } from '@/lib/auth';
import { rupiah } from '@/lib/format';
import { simulasiCicilan } from '@/lib/simulasi';
import { createClient } from '@/lib/supabase/server';
import { pesanKavling } from './actions';

type Props = PageProps<'/pesan/[kavlingId]'>;

export default function PesanPage(props: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Pesan kavling</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500 dark:text-zinc-400">Memuat kavling…</p>}>
        <FormPemesanan params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function FormPemesanan({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  await requireUser();

  const [{ kavlingId }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: kavling }, { data: semuaOpsi }] = await Promise.all([
    supabase
      .from('kavlings')
      .select('id, kode, blok, nomor, luas_m2, harga, status, aktif')
      .eq('id', kavlingId)
      .maybeSingle(),
    supabase
      .from('opsi_cicilan')
      .select('kavling_id, dp_persen, tenor_bulan')
      .eq('aktif', true)
      .order('dp_persen')
      .order('tenor_bulan'),
  ]);

  if (!kavling || !kavling.aktif || kavling.status !== 'tersedia') {
    return (
      <div className="flex flex-col gap-3">
        <p>Kavling ini tidak tersedia untuk dipesan.</p>
        <Link className="underline" href="/denah">Kembali ke denah</Link>
      </div>
    );
  }

  const petaOpsi = new Map<string, { dp_persen: number; tenor_bulan: number }>();
  for (const opsi of semuaOpsi ?? []) {
    if (opsi.kavling_id !== null && opsi.kavling_id !== kavlingId) continue;
    const kunci = `${opsi.dp_persen}-${opsi.tenor_bulan}`;
    if (!petaOpsi.has(kunci) || opsi.kavling_id === kavlingId) {
      petaOpsi.set(kunci, { dp_persen: opsi.dp_persen, tenor_bulan: opsi.tenor_bulan });
    }
  }
  const opsi = [...petaOpsi.values()].sort(
    (a, b) => a.dp_persen - b.dp_persen || a.tenor_bulan - b.tenor_bulan,
  );

  const metode = query.metode === 'cicil' || query.metode === 'cash' ? query.metode : null;
  const dpDiminta = Number(query.dp);
  const tenorDiminta = Number(query.tenor);
  const pilihan =
    opsi.find((o) => o.dp_persen === dpDiminta && o.tenor_bulan === tenorDiminta) ?? opsi[0];
  const pesanError = Array.isArray(query.error) ? query.error.join(', ') : query.error;
  const tautan = (m: 'cash' | 'cicil') =>
    m === 'cash' || !pilihan
      ? `/pesan/${kavlingId}?metode=cash`
      : `/pesan/${kavlingId}?metode=cicil&dp=${pilihan.dp_persen}&tenor=${pilihan.tenor_bulan}`;

  const preview = pilihan ? simulasiCicilan(kavling.harga, pilihan.dp_persen, pilihan.tenor_bulan) : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="font-semibold">{kavling.kode} — Blok {kavling.blok} No. {kavling.nomor}</p>
        <p className="text-sm">{kavling.luas_m2} m² · {rupiah(kavling.harga)}</p>
      </section>

      {pesanError ? <p className="text-sm text-red-600 dark:text-red-400">{pesanError}</p> : null}
      {query.ok ? <p className="text-sm text-green-700 dark:text-green-400">Pesanan berhasil dibuat.</p> : null}

      <nav className="flex gap-4 text-sm underline">
        <Link className={metode === 'cash' ? 'font-semibold' : ''} href={tautan('cash')}>Cash</Link>
        <Link className={metode === 'cicil' ? 'font-semibold' : ''} href={tautan('cicil')}>Cicil</Link>
      </nav>

      {metode === 'cash' ? (
        <section className="flex flex-col gap-4">
          <p>Total pembayaran: <strong>{rupiah(kavling.harga)}</strong></p>
          <form action={pesanKavling}>
            <input type="hidden" name="kavling_id" defaultValue={kavling.id} />
            <input type="hidden" name="metode" defaultValue="cash" />
            <button type="submit" className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
              Konfirmasi pesanan cash
            </button>
          </form>
        </section>
      ) : null}

      {metode === 'cicil' && pilihan && preview ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {opsi.map((o) => (
              <Link
                key={`${o.dp_persen}-${o.tenor_bulan}`}
                className={`rounded border px-3 py-1 text-sm ${
                  o.dp_persen === pilihan.dp_persen && o.tenor_bulan === pilihan.tenor_bulan
                    ? 'border-zinc-900 font-semibold dark:border-white'
                    : 'border-zinc-300 dark:border-zinc-700'
                }`}
                href={`/pesan/${kavlingId}?metode=cicil&dp=${o.dp_persen}&tenor=${o.tenor_bulan}`}
              >
                DP {o.dp_persen}% · {o.tenor_bulan} bulan
              </Link>
            ))}
          </div>

          <div className="rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800">
            <p>DP ({pilihan.dp_persen}%): <strong>{rupiah(preview.dp)}</strong></p>
            <p>Sisa pokok: {rupiah(preview.sisa)}</p>
            <p>Angsuran per bulan: <strong>{rupiah(preview.angsuran)}</strong></p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2 pr-4">Angsuran</th>
                  <th className="py-2 pr-4">Jatuh tempo</th>
                  <th className="py-2">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {preview.jadwal.map((angsuran) => (
                  <tr key={angsuran.urutan} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-4">{angsuran.urutan}</td>
                    <td className="py-2 pr-4">{angsuran.jatuhTempo}</td>
                    <td className="py-2">{rupiah(angsuran.nominal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={pesanKavling}>
            <input type="hidden" name="kavling_id" defaultValue={kavling.id} />
            <input type="hidden" name="metode" defaultValue="cicil" />
            <input type="hidden" name="dp_persen" defaultValue={pilihan.dp_persen} />
            <input type="hidden" name="tenor_bulan" defaultValue={pilihan.tenor_bulan} />
            <button type="submit" className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
              Konfirmasi pesanan cicil
            </button>
          </form>
        </section>
      ) : null}

      {metode === 'cicil' && !pilihan ? (
        <p className="text-sm text-red-600 dark:text-red-400">Belum ada opsi DP dan tenor aktif.</p>
      ) : null}
    </div>
  );
}
