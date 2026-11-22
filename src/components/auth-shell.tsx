import Link from 'next/link';
import type { ReactNode } from 'react';

export const authFieldClass =
  'h-14 w-full rounded-[6px] border-[1.5px] border-[#C9CED3] bg-white px-3 text-2xl font-normal text-[#222A28] placeholder:text-[#6C7570] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500';

export const authButtonClass =
  'flex h-16 w-full items-center justify-center rounded-[6px] border-[1.5px] border-[#C9CED3] bg-[#215E87] px-3 text-2xl font-bold text-white disabled:opacity-50 dark:border-zinc-700';

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-white font-sans text-[#222A28] dark:bg-zinc-950 dark:text-zinc-100">
      <nav className="flex h-20 items-center gap-8 bg-[#215E87] px-6 text-white lg:px-16">
        <Link className="flex-1 text-2xl font-bold" href="/">
          Tanah Asri Residence
        </Link>
        <Link className="text-2xl font-normal" href="/login">
          Masuk
        </Link>
        <Link className="text-2xl font-bold" href="/register">
          Daftar
        </Link>
      </nav>
      <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-8 px-4 py-12 lg:px-16">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="w-full max-w-[640px]">{children}</div>
      </div>
    </main>
  );
}
