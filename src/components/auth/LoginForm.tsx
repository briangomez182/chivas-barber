'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

import { api } from '@/lib/api-client';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') ?? '/admin';

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

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

  const fillDemo = (): void => {
    setEmail('admin@chivasbarber.club');
    setPassword('admin123');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          placeholder="vos@chivasbarber.club"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted"
        >
          Contraseña
        </label>
        <input
          id="password"
          type="password"
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

      <button
        type="button"
        onClick={fillDemo}
        className="pill-ghost w-full text-xs"
      >
        Usar credenciales de prueba (admin@chivasbarber.club)
      </button>
    </form>
  );
}
