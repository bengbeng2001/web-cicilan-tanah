import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Sistem Pembayaran Cicilan Tanah</h1>
      <p className="text-zinc-600">Pemesanan kavling dan cicilan dengan verifikasi pembayaran.</p>
      <nav className="flex gap-4 text-sm underline">
        <Link href="/login">Masuk</Link>
        <Link href="/register">Daftar</Link>
        <Link href="/denah">Denah</Link>
        <Link href="/pesanan">Pesanan</Link>
        <Link href="/dashboard">Dashboard</Link>
      </nav>
    </main>
  );
}
