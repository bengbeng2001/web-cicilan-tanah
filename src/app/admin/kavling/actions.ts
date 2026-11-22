'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

function teks(formData: FormData, nama: string) {
  return String(formData.get(nama) ?? '').trim();
}

function angka(formData: FormData, nama: string, opsional = false): number | null {
  const nilai = teks(formData, nama);
  if (!nilai) {
    if (opsional) return null;
    throw new Error(`${nama} wajib diisi`);
  }
  const hasil = Number(nilai);
  if (!Number.isFinite(hasil)) throw new Error(`${nama} harus berupa angka`);
  return hasil;
}

async function simpan(formData: FormData) {
  const id = teks(formData, 'id');
  const kode = teks(formData, 'kode');
  const blok = teks(formData, 'blok');
  const nomor = teks(formData, 'nomor');
  if (!kode || !blok || !nomor) {
    throw new Error('Kode, blok, dan nomor wajib diisi');
  }

  const luas_m2 = angka(formData, 'luas_m2')!;
  const harga = angka(formData, 'harga')!;
  if (luas_m2 <= 0) throw new Error('Luas harus lebih dari 0');
  if (harga < 0) throw new Error('Harga tidak boleh negatif');

  const denda_persen_per_minggu = angka(formData, 'denda_persen_per_minggu', true);
  const denda_maks_persen = angka(formData, 'denda_maks_persen', true);
  const masa_tenggang_hari = angka(formData, 'masa_tenggang_hari', true);

  for (const [nama, nilai] of [
    ['denda_persen_per_minggu', denda_persen_per_minggu],
    ['denda_maks_persen', denda_maks_persen],
    ['masa_tenggang_hari', masa_tenggang_hari],
  ] as const) {
    if (nilai !== null && nilai < 0) throw new Error(`${nama} tidak boleh negatif`);
  }
  if (masa_tenggang_hari !== null && !Number.isInteger(masa_tenggang_hari)) {
    throw new Error('Masa tenggang harus bilangan bulat');
  }

  const data = {
    kode,
    blok,
    nomor,
    luas_m2,
    harga,
    denda_persen_per_minggu,
    denda_maks_persen,
    masa_tenggang_hari,
    keterangan: teks(formData, 'keterangan') || null,
    aktif: formData.get('aktif') === 'on',
  };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from('kavlings').update(data).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('kavlings').insert(data);
    if (error) throw new Error(error.message);
  }
}

export async function saveKavling(formData: FormData) {
  await requireRole(['admin']);

  let pesanError: string | null = null;
  try {
    await simpan(formData);
  } catch (kesalahan) {
    pesanError = kesalahan instanceof Error ? kesalahan.message : 'Gagal menyimpan kavling';
  }

  if (pesanError) {
    redirect(`/admin/kavling?error=${encodeURIComponent(pesanError)}`);
  }

  revalidatePath('/admin/kavling');
  revalidatePath('/denah');
  redirect('/admin/kavling?ok=1');
}
