'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { authButtonClass, authFieldClass, AuthShell } from '@/components/auth-shell';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <AuthShell title="Masuk">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
          Kata sandi
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
            className={authFieldClass}
          />
        </label>
        {error && <p className="text-base text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
      <p className="mt-4 text-center text-base">
        Belum punya akun?{' '}
        <Link className="underline" href="/register">
          Daftar
        </Link>
      </p>
    </AuthShell>
  );
}
