'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const TIPE_DIIZINKAN = ['image/jpeg', 'image/png', 'application/pdf'];
const UKURAN_MAKS = 2 * 1024 * 1024;

export async function unggahBukti(formData: FormData) {
  const user = await requireUser();
  const tagihanId = String(formData.get('tagihan_id') ?? '');
  if (!tagihanId) redirect('/pesanan');

  let pesananId: string | null = null;
  let pesanError: string | null = null;

  try {
    const berkas = formData.get('bukti');
    if (!(berkas instanceof File) || berkas.size === 0) {
      throw new Error('Pilih file bukti transfer');
    }
    if (!TIPE_DIIZINKAN.includes(berkas.type)) {
      throw new Error('Format harus JPG, PNG, atau PDF');
    }
    if (berkas.size > UKURAN_MAKS) {
      throw new Error('Ukuran file maksimal 2 MB');
    }

    const supabase = await createClient();
    const { data: tagihan, error: errorTagihan } = await supabase
      .from('tagihan')
      .select('id, pemesanan_id')
      .eq('id', tagihanId)
      .maybeSingle();
    if (errorTagihan) throw new Error(errorTagihan.message);
    if (!tagihan) throw new Error('Tagihan tidak ditemukan');

    const { data: pesanan, error: errorPesanan } = await supabase
      .from('pemesanan')
      .select('id, user_id')
      .eq('id', tagihan.pemesanan_id)
      .maybeSingle();
    if (errorPesanan) throw new Error(errorPesanan.message);
    if (!pesanan || pesanan.user_id !== user.id) {
      throw new Error('Tagihan bukan milik Anda');
    }
    pesananId = pesanan.id;

    const ekstensi = berkas.type === 'application/pdf' ? 'pdf' : berkas.type === 'image/png' ? 'png' : 'jpg';
    const path = `${user.id}/${pesanan.id}/${tagihan.id}/${crypto.randomUUID()}.${ekstensi}`;
    const { error: errorUnggah } = await supabase.storage
      .from('bukti-transfer')
      .upload(path, await berkas.arrayBuffer(), { contentType: berkas.type });
    if (errorUnggah) throw new Error(errorUnggah.message);

    const { error: errorRpc } = await supabase.rpc('upload_bukti', {
      p_tagihan_id: tagihanId,
      p_bukti_path: path,
    });
    if (errorRpc) {
      await supabase.storage.from('bukti-transfer').remove([path]);
      throw new Error(errorRpc.message);
    }
  } catch (kesalahan) {
    pesanError = kesalahan instanceof Error ? kesalahan.message : 'Gagal mengunggah bukti';
  }

  if (pesanError) {
    redirect(`/tagihan/${tagihanId}?error=${encodeURIComponent(pesanError)}`);
  }

  revalidatePath(`/tagihan/${tagihanId}`);
  revalidatePath('/admin/pembayaran');
  if (pesananId) revalidatePath(`/pesanan/${pesananId}`);
  redirect(`/tagihan/${tagihanId}?ok=1`);
}
