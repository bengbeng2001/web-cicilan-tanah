'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function verifikasiPembayaran(formData: FormData) {
  await requireRole(['admin']);

  const pembayaranId = String(formData.get('pembayaran_id') ?? '');
  if (!pembayaranId) redirect('/admin/pembayaran');

  const setuju = String(formData.get('keputusan') ?? '') === 'setuju';
  const alasan = String(formData.get('alasan') ?? '').trim();

  let pesanError: string | null = null;
  try {
    if (!setuju && !alasan) {
      throw new Error('Alasan penolakan wajib diisi');
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc('verifikasi_pembayaran', {
      p_pembayaran_id: pembayaranId,
      p_setuju: setuju,
      p_alasan: alasan || undefined,
    });
    if (error) throw new Error(error.message);
  } catch (kesalahan) {
    pesanError = kesalahan instanceof Error ? kesalahan.message : 'Gagal memverifikasi pembayaran';
  }

  if (pesanError) {
    redirect(`/admin/pembayaran?error=${encodeURIComponent(pesanError)}`);
  }

  revalidatePath('/admin/pembayaran');
  revalidatePath('/denah');
  revalidatePath('/pesanan');
  redirect('/admin/pembayaran?ok=1');
}
