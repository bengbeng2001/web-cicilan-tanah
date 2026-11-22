import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { rupiah } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: RouteContext<'/kwitansi/[pembayaranId]'>,
) {
  const { pembayaranId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Harus login', { status: 401 });

  // RLS sudah membatasi pembayaran dan data terkait ke pemilik atau staff.
  const { data: pembayaran } = await supabase
    .from('pembayaran')
    .select('*')
    .eq('id', pembayaranId)
    .maybeSingle();
  if (!pembayaran || pembayaran.status !== 'terverifikasi' || !pembayaran.no_kwitansi) {
    return new Response('Kwitansi tidak ditemukan', { status: 404 });
  }

  const { data: tagihan } = await supabase
    .from('tagihan')
    .select('id, pemesanan_id, jenis, urutan')
    .eq('id', pembayaran.tagihan_id)
    .maybeSingle();
  const { data: pesanan } = await supabase
    .from('pemesanan')
    .select('id, kode, user_id, kavling_id')
    .eq('id', tagihan?.pemesanan_id ?? '')
    .maybeSingle();
  const [{ data: pembeli }, { data: kavling }] = await Promise.all([
    supabase.from('profiles').select('nama').eq('id', pesanan?.user_id ?? '').maybeSingle(),
    supabase
      .from('kavlings')
      .select('kode, blok, nomor, luas_m2, harga')
      .eq('id', pesanan?.kavling_id ?? '')
      .maybeSingle(),
  ]);

  if (!tagihan || !pesanan || !pembeli || !kavling) {
    return new Response('Data kwitansi tidak lengkap', { status: 500 });
  }

  const pdf = await PDFDocument.create();
  const halaman = pdf.addPage([595.28, 841.89]);
  const biasa = await pdf.embedFont(StandardFonts.Helvetica);
  const tebal = await pdf.embedFont(StandardFonts.HelveticaBold);
  const hitam = rgb(0.1, 0.1, 0.1);
  const abu = rgb(0.45, 0.45, 0.45);

  let y = 780;
  const tulis = (teks: string, ukuran = 11, font = biasa, warna = hitam, x = 50) => {
    halaman.drawText(aman(teks), { x, y, size: ukuran, font, color: warna });
    y -= ukuran + 8;
  };

  tulis('KWITANSI', 22, tebal, hitam, 247);
  tulis(pembayaran.no_kwitansi, 12, tebal, hitam, 480);
  y -= 12;
  tulis(`Tanggal: ${new Date(pembayaran.tgl_verifikasi!).toLocaleDateString('id-ID')}`);
  tulis(`Diterima dari: ${pembeli.nama}`);
  tulis(`Untuk pembayaran: ${tagihan.jenis} #${tagihan.urutan} (${pesanan.kode})`);
  tulis(`Kavling: ${kavling.kode} (Blok ${kavling.blok}-${kavling.nomor})`);
  tulis(`Luas: ${kavling.luas_m2} m2`);
  tulis(`Harga tanah: ${rupiah(kavling.harga)}`);
  tulis(`Harga per m2: ${rupiah(Math.round(kavling.harga / kavling.luas_m2))}`);
  y -= 16;
  tulis(`Pokok: ${rupiah(pembayaran.nominal_pokok)}`);
  tulis(`Denda: ${rupiah(pembayaran.denda)}`);
  tulis(`Total: ${rupiah(pembayaran.total)}`, 14, tebal);
  y -= 40;
  tulis('Hormat kami,', 11, biasa, abu);
  tulis('Penjual Kavling', 11, tebal);

  const pdfBytes = await pdf.save();
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pembayaran.no_kwitansi}.pdf"`,
    },
  });
}

function aman(teks: string) {
  return teks
    .replace(/²/g, '2')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}
