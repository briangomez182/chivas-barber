import Link from 'next/link';

import { Logo } from '@/components/layout/Logo';
import { BRAND } from '@/lib/brand';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/** Layout partido para /login y /register: formulario + panel de marca. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col justify-between px-6 py-10 sm:px-12 lg:px-16">
        <header className="flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            ← Volver al sitio
          </Link>
        </header>

        <section
          aria-labelledby="auth-title"
          className="mx-auto w-full max-w-sm py-16"
        >
          <h1
            id="auth-title"
            className="text-3xl font-extrabold tracking-[-0.035em] text-ink sm:text-4xl"
          >
            {title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{subtitle}</p>

          <div className="mt-9">{children}</div>
        </section>

        <footer className="text-xs text-ink-muted">{footer}</footer>
      </div>

      {/* Panel de marca */}
      <aside className="relative hidden overflow-hidden bg-ink lg:block">
        <div
          aria-hidden="true"
          className="absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-brand/30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-brand/20 blur-3xl"
        />

        <div className="relative flex h-full flex-col justify-end p-16">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-300">
            {BRAND.city}
          </p>
          <p className="mt-6 max-w-md text-5xl font-extrabold leading-[0.98] tracking-[-0.04em] text-white">
            El club donde
            <br />
            se corta fino
            <span className="text-brand">.</span>
          </p>
          <address className="mt-8 not-italic text-sm leading-relaxed text-white/60">
            {BRAND.street}
            <br />
            {BRAND.postalCode}, {BRAND.city}
          </address>
        </div>
      </aside>
    </main>
  );
}
