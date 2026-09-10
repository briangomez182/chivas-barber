'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

import { PasswordInput } from '@/components/ui/PasswordInput';
import { api } from '@/lib/api-client';

/**
 * TEMPORAL — botones para autocompletar credenciales mientras se prueba.
 * Quitar (o dejar la lista vacía) antes de considerarlo listo para producción.
 */
const DEMO_ACCOUNTS: { label: string; email: string; password: string }[] = [
  {
    label: 'Admin',
    email: 'chivasbarberias2454@gmail.com',
    password: 'admin123',
  },
  {
    label: 'Barbero',
    email: 'barbero1@gmail.com',
    password: 'Barbero1barbero1.',
  },
];

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') ?? '/admin';
  const justReset = searchParams.get('reset') === '1';

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fillDemo = (account: (typeof DEMO_ACCOUNTS)[number]): void => {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.auth.login(email, password);
      router.push(nextPath);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos ingresar');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {justReset && (
        <motion.p
          role="status"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          Tu contraseña se actualizó. Ingresá con la nueva.
        </motion.p>
      )}

      <div>
        <label
          htmlFor="email"
          className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          placeholder="nombre@correo.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2"
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label
            htmlFor="password"
            className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted"
          >
            Contraseña
          </label>
          <Link
            href="/recuperar"
            className="text-xs font-semibold text-brand transition-colors hover:text-brand-600"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <PasswordInput
          id="password"
          required
          autoComplete="current-password"
          placeholder="••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2"
        />
      </div>

      {error && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
        >
          {error}
        </motion.p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="pill-primary w-full py-3"
      >
        {loading ? 'Ingresando…' : 'Ingresar al panel'}
      </button>

      {/* TEMPORAL — autocompletar credenciales de prueba. */}
      {DEMO_ACCOUNTS.length > 0 && (
        <div className="space-y-2 rounded-xl border border-dashed border-gray-300 p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            Acceso rápido (temporal)
          </p>
          <div className="flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillDemo(account)}
                className="pill-ghost text-xs"
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
