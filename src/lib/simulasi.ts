// Preview ini mengikuti perhitungan create_pemesanan di migrasi SQL.
export function simulasiCicilan(harga: number, dpPersen: number, tenorBulan: number) {
  const dp = Math.round((harga * dpPersen) / 100);
  const sisa = harga - dp;
  const angsuran = Math.round(sisa / tenorBulan);
  const hariIni = hariIniJakarta();

  return {
    dp,
    sisa,
    angsuran,
    jadwal: Array.from({ length: tenorBulan }, (_, indeks) => ({
      urutan: indeks + 1,
      jatuhTempo: tambahBulan(hariIni, indeks + 1),
      nominal:
        indeks === tenorBulan - 1 ? sisa - angsuran * (tenorBulan - 1) : angsuran,
    })),
  };
}

export function tanggalJakarta() {
  return hariIniJakarta().toISOString().slice(0, 10);
}

function hariIniJakarta() {
  const bagian = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value]),
  );
  return new Date(Date.UTC(Number(bagian.year), Number(bagian.month) - 1, Number(bagian.day)));
}

function tambahBulan(tanggal: Date, bulan: number) {
  const hasil = new Date(tanggal);
  hasil.setUTCDate(1);
  hasil.setUTCMonth(hasil.getUTCMonth() + bulan);
  const hariTerakhir = new Date(
    Date.UTC(hasil.getUTCFullYear(), hasil.getUTCMonth() + 1, 0),
  ).getUTCDate();
  hasil.setUTCDate(Math.min(tanggal.getUTCDate(), hariTerakhir));
  return hasil.toISOString().slice(0, 10);
}
