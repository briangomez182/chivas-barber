'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

import { api } from '@/lib/api-client';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { message: text } = await api.auth.forgotPassword(email);
      setMessage(text);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No pudimos procesar el pedido. Probá de nuevo en un rato.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (message) {
    return (
      <div className="space-y-5">
        <motion.p
          role="status"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          {message}
        </motion.p>
        <p className="text-sm text-ink-soft">
          El enlace vence en poco tiempo. Si no llega, revisá que el email sea
          el correcto y volvé a pedirlo.
        </p>
        <Link href="/login" className="pill-outline w-full py-3 text-center">
          Volver a ingresar
        </Link>
      </div>
    );
  }

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
          placeholder="nombre@correo.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
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
        {loading ? 'Enviando…' : 'Enviarme el enlace'}
      </button>

      <Link
        href="/login"
        className="block text-center text-sm font-medium text-ink-soft transition-colors hover:text-ink"
      >
        ← Volver a ingresar
      </Link>
    </form>
  );
}
