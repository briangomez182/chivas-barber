import { Suspense } from 'react';
import type { Metadata } from 'next';

import { AuthShell } from '@/components/auth/AuthShell';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Recuperar contraseña',
  description: 'Restablecé la contraseña de tu cuenta de Chivas Barbería Club.',
  robots: { index: false, follow: false },
};

export default function RecuperarPage() {
  return (
    <AuthShell
      title="¿Olvidaste tu contraseña?"
      subtitle="Ingresá tu email y te mandamos un enlace para crear una nueva."
    >
      <Suspense
        fallback={<div className="h-48 animate-pulse rounded-2xl bg-gray-100" />}
      >
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
