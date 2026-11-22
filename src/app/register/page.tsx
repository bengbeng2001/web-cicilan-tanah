'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { authButtonClass, authFieldClass, AuthShell } from '@/components/auth-shell';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [noHp, setNoHp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await createClient().auth.signUp({
      email,
      password,
      options: { data: { nama, no_hp: noHp } },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <AuthShell title="Pendaftaran berhasil">
        <p className="text-2xl">
          Cek email untuk verifikasi (jika diaktifkan), lalu{' '}
          <Link className="underline" href="/login">
            masuk
          </Link>
          .
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Daftar Akun">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1 text-2xl font-normal">
          Nama lengkap
          <input
            required
            value={nama}
            onChange={(event) => setNama(event.target.value)}
            placeholder="Budi Santoso"
            className={authFieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-2xl font-normal">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nama@email.com"
            className={authFieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-2xl font-normal">
          Nomor HP
          <input
            value={noHp}
            onChange={(event) => setNoHp(event.target.value)}
            placeholder="0812 3456 7890"
            className={authFieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-2xl font-normal">
          Password
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
            className={authFieldClass}
          />
        </label>
        {error && <p className="text-base text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? 'Memproses…' : 'Daftar'}
        </button>
      </form>
      <p className="mt-4 text-center text-base">
        Sudah punya akun?{' '}
        <Link className="underline" href="/login">
          Masuk
        </Link>
      </p>
    </AuthShell>
  );
}
