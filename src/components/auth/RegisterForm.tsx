'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import { PasswordInput } from '@/components/ui/PasswordInput';
import { api } from '@/lib/api-client';

export function RegisterForm() {
  const router = useRouter();

  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [done, setDone] = useState<'redirect' | 'confirm-email' | null>(null);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await api.auth.register({ name, email, phone, password });
      if (result.needsEmailConfirmation) {
        setDone('confirm-email');
        return;
      }
      setDone('redirect');
      setTimeout(() => {
        router.push('/#agenda');
        router.refresh();
      }, 1400);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos registrarte');
      setLoading(false);
    }
  };

  if (done === 'confirm-email') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-brand-50 px-6 py-8 text-center"
      >
        <p className="text-lg font-extrabold tracking-tight text-ink">
          Revisá tu email
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          Te mandamos un link para confirmar tu cuenta antes de ingresar.
        </p>
      </motion.div>
    );
  }

  if (done === 'redirect') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-brand-50 px-6 py-8 text-center"
      >
        <p className="text-lg font-extrabold tracking-tight text-ink">
          ¡Bienvenido al club!
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          Ya podés reservar tu turno. Te llevamos a la agenda…
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="name"
          className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted"
        >
          Nombre y apellido
        </label>
        <input
          id="name"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-2"
        />
      </div>

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
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2"
        />
      </div>

      <div>
        <label
          htmlFor="phone"
          className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted"
        >
          Teléfono
        </label>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+54 9 11 ..."
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
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
        <PasswordInput
          id="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2"
        />
        <p className="mt-2 text-xs text-ink-muted">Mínimo 6 caracteres.</p>
      </div>

      <label className="flex items-start gap-3 text-sm text-ink-soft">
        <input
          type="checkbox"
          required
          checked={termsAccepted}
          onChange={(event) => setTermsAccepted(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
        />
        <span>
          Acepto los{' '}
          <Link
            href="/terminos"
            target="_blank"
            className="font-semibold text-brand hover:underline"
          >
            Términos y Condiciones
          </Link>
        </span>
      </label>

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
        {loading ? 'Creando cuenta…' : 'Crear mi cuenta'}
      </button>
    </form>
  );
}
