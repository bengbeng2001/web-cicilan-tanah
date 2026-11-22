'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type ArgumenPemesanan = Database['public']['Functions']['create_pemesanan']['Args'];

function teks(formData: FormData, nama: string) {
  return String(formData.get(nama) ?? '').trim();
}

export async function pesanKavling(formData: FormData) {
  await requireUser();

  const kavlingId = teks(formData, 'kavling_id');
  if (!kavlingId) redirect('/denah');

  const metode = teks(formData, 'metode');
  const dp = teks(formData, 'dp_persen');
  const tenor = teks(formData, 'tenor_bulan');

  let pesanError: string | null = null;
  let pesananId: string | null = null;

  try {
    if (metode !== 'cash' && metode !== 'cicil') {
      throw new Error('Pilih metode pembayaran');
    }

    let argumen: ArgumenPemesanan = { p_kavling_id: kavlingId, p_metode: metode };
    if (metode === 'cicil') {
      const dpPersen = Number(dp);
      const tenorBulan = Number(tenor);
      if (!Number.isFinite(dpPersen) || dpPersen <= 0 || !Number.isFinite(tenorBulan) || tenorBulan <= 0) {
        throw new Error('DP dan tenor wajib dipilih');
      }
      argumen = {
        p_kavling_id: kavlingId,
        p_metode: metode,
        p_dp_persen: dpPersen,
        p_tenor_bulan: tenorBulan,
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('create_pemesanan', argumen);
    if (error) throw new Error(error.message);
    pesananId = data;
  } catch (kesalahan) {
    pesanError = kesalahan instanceof Error ? kesalahan.message : 'Gagal membuat pesanan';
  }

  if (pesanError) {
    const query = new URLSearchParams();
    if (metode) query.set('metode', metode);
    if (dp) query.set('dp', dp);
    if (tenor) query.set('tenor', tenor);
    query.set('error', pesanError);
    redirect(`/pesan/${kavlingId}?${query}`);
  }

  revalidatePath('/denah');
  revalidatePath('/pesanan');
  redirect(`/pesanan/${pesananId}?ok=1`);
}
