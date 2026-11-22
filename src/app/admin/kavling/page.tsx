import Link from 'next/link';
import { Suspense } from 'react';
import { requireRole } from '@/lib/auth';
import { rupiah } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { saveKavling } from './actions';

export default function KelolaKavlingPage(props: PageProps<'/admin/kavling'>) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Kelola kavling</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500 dark:text-zinc-400">Memuat data…</p>}>
        <Konten searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Konten({ searchParams }: { searchParams: PageProps<'/admin/kavling'>['searchParams'] }) {
  await requireRole(['admin']);

  const { edit, ok, error } = await searchParams;
  const editId = typeof edit === 'string' ? edit : null;

  const supabase = await createClient();
  const [daftar, detail] = await Promise.all([
    supabase
      .from('kavlings')
      .select('id, kode, blok, nomor, luas_m2, harga, status, aktif, denda_persen_per_minggu, denda_maks_persen, masa_tenggang_hari')
      .order('blok')
      .order('nomor'),
    editId
      ? supabase.from('kavlings').select('*').eq('id', editId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const inputClass =
    'w-full rounded border border-zinc-300 px-3 py-2 text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white';

  return (
    <>
      {ok ? <p className="text-sm text-green-700 dark:text-green-400">Kavling tersimpan.</p> : null}
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {Array.isArray(error) ? error.join(', ') : error}
        </p>
      ) : null}
      {daftar.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{daftar.error.message}</p>
      ) : null}

      <form action={saveKavling} className="grid gap-4 rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-semibold">{detail.data ? `Ubah ${detail.data.kode}` : 'Tambah kavling'}</h2>
        {detail.data ? <input type="hidden" name="id" defaultValue={detail.data.id} /> : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Kode
            <input name="kode" required defaultValue={detail.data?.kode ?? ''} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Blok
            <input name="blok" required defaultValue={detail.data?.blok ?? ''} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Nomor
            <input name="nomor" required defaultValue={detail.data?.nomor ?? ''} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Luas (m²)
            <input name="luas_m2" type="number" min="0.01" step="0.01" required defaultValue={detail.data?.luas_m2 ?? ''} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Harga (Rp)
            <input name="harga" type="number" min="0" step="1" required defaultValue={detail.data?.harga ?? ''} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Masa tenggang (hari)
            <input name="masa_tenggang_hari" type="number" min="0" step="1" placeholder="global" defaultValue={detail.data?.masa_tenggang_hari ?? ''} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Denda per minggu (%)
            <input name="denda_persen_per_minggu" type="number" min="0" step="any" placeholder="global" defaultValue={detail.data?.denda_persen_per_minggu ?? ''} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Denda maksimal (%)
            <input name="denda_maks_persen" type="number" min="0" step="any" placeholder="global" defaultValue={detail.data?.denda_maks_persen ?? ''} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Keterangan
            <input name="keterangan" defaultValue={detail.data?.keterangan ?? ''} className={inputClass} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="aktif" defaultChecked={detail.data?.aktif ?? true} /> Aktif ditampilkan di denah
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Kolom denda kosong = memakai aturan global dari tabel <code>pengaturan</code>.
        </p>
        <div className="flex gap-4 text-sm">
          <button type="submit" className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
            Simpan
          </button>
          <Link className="underline" href="/admin/kavling">Batal / kosongkan form</Link>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2 pr-4">Kode</th>
              <th className="py-2 pr-4">Blok/No</th>
              <th className="py-2 pr-4">Luas</th>
              <th className="py-2 pr-4">Harga</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Denda/minggu</th>
              <th className="py-2 pr-4">Aktif</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {daftar.data?.map((kavling) => (
              <tr key={kavling.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-4">{kavling.kode}</td>
                <td className="py-2 pr-4">{kavling.blok}-{kavling.nomor}</td>
                <td className="py-2 pr-4">{kavling.luas_m2} m²</td>
                <td className="py-2 pr-4">{rupiah(kavling.harga)}</td>
                <td className="py-2 pr-4">{kavling.status}</td>
                <td className="py-2 pr-4">
                  {kavling.denda_persen_per_minggu === null ? 'global' : `${kavling.denda_persen_per_minggu}%`}
                </td>
                <td className="py-2 pr-4">{kavling.aktif ? 'Ya' : 'Tidak'}</td>
                <td className="py-2">
                  <Link className="underline" href={`/admin/kavling?edit=${kavling.id}`}>Ubah</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {daftar.data?.length === 0 ? (
          <p className="py-4 text-sm text-zinc-500 dark:text-zinc-400">Belum ada kavling. Tambahkan lewat form di atas.</p>
        ) : null}
      </div>
    </>
  );
}
