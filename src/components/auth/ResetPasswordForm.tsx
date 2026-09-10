'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

import { PasswordInput } from '@/components/ui/PasswordInput';
import {
  STAFF_PASSWORD_RULES,
  passwordHint,
  validatePassword,
} from '@/lib/password';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type Phase = 'checking' | 'ready' | 'invalid' | 'done';

export function ResetPasswordForm() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState<string>('');
  const [confirm, setConfirm] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const supabaseRef = useRef<ReturnType<typeof createBrowserSupabaseClient> | null>(
    null,
  );

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabaseRef.current = supabase;
    let cancelled = false;

    const hash = window.location.hash ?? '';
    // Supabase pone los errores del link (vencido, ya usado) en el hash.
    if (/(?:^|[#&])error(?:_code)?=/.test(hash)) {
      setPhase('invalid');
      return;
    }
    const hashHasToken = /(?:^|[#&])access_token=/.test(hash);

    // El cliente del navegador (flujo implícito) canjea el hash
    // `#access_token…&type=recovery` solo y emite `PASSWORD_RECOVERY` /
    // `SIGNED_IN` con una sesión temporal.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
        setPhase('ready');
      }
    });

    // Por si la sesión ya estaba lista antes de suscribirnos.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setPhase((prev) => (prev === 'checking' ? 'ready' : prev));
      } else if (!hashHasToken) {
        // Sin token en la URL y sin sesión: se entró a esta página de forma
        // directa, sin venir del mail.
        setPhase((prev) => (prev === 'checking' ? 'invalid' : prev));
      }
    });

    // Red de seguridad: si el canje del hash nunca resuelve, no dejamos la
    // pantalla colgada en "cargando".
    const timer = window.setTimeout(() => {
      if (!cancelled) {
        setPhase((prev) => (prev === 'checking' ? 'invalid' : prev));
      }
    }, 6000);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setError(null);

    const ruleError = validatePassword(password, STAFF_PASSWORD_RULES);
    if (ruleError) {
      setError(ruleError);
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    const supabase = supabaseRef.current;
    if (!supabase) return;

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      const msg = /different from the old password/i.test(updateError.message)
        ? 'La contraseña nueva tiene que ser distinta de la anterior.'
        : /session|expired|jwt/i.test(updateError.message)
          ? 'El enlace venció. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".'
          : 'No pudimos actualizar la contraseña. Probá con el enlace de nuevo.';
      setError(msg);
      setSaving(false);
      return;
    }

    // La sesión de recovery ya no hace falta: se cierra para forzar un login
    // limpio con la contraseña nueva.
    await supabase.auth.signOut();
    setSaving(false);
    setPhase('done');
  };

  if (phase === 'checking') {
    return (
      <div className="h-40 animate-pulse rounded-2xl bg-gray-100" aria-hidden="true" />
    );
  }

  if (phase === 'invalid') {
    return (
      <div className="space-y-5">
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
        >
          El enlace no es válido o ya venció. Pedí uno nuevo.
        </p>
        <Link href="/recuperar" className="pill-primary w-full py-3 text-center">
          Pedir un enlace nuevo
        </Link>
        <Link
          href="/login"
          className="block text-center text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          ← Volver a ingresar
        </Link>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="space-y-5">
        <motion.p
          role="status"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          Listo, tu contraseña quedó actualizada. Ya podés ingresar con la
          nueva.
        </motion.p>
        <Link
          href="/login?reset=1"
          className="pill-primary w-full py-3 text-center"
        >
          Ir a ingresar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="password"
          className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted"
        >
          Contraseña nueva
        </label>
        <PasswordInput
          id="password"
          required
          autoComplete="new-password"
          placeholder="••••••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2"
        />
        <p className="mt-2 text-xs text-ink-muted">
          {passwordHint(STAFF_PASSWORD_RULES)}
        </p>
      </div>

      <div>
        <label
          htmlFor="confirm"
          className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted"
        >
          Repetir contraseña
        </label>
        <PasswordInput
          id="confirm"
          required
          autoComplete="new-password"
          placeholder="••••••••••••"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
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
        disabled={saving}
        className="pill-primary w-full py-3"
      >
        {saving ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  );
}
