import { Suspense } from 'react';
import type { Metadata } from 'next';

import { AuthShell } from '@/components/auth/AuthShell';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Ingresar',
  description: 'Acceso al panel de administración de Chivas Barbería Club.',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Ingresá al panel"
      subtitle="Administrá barberos, servicios y la configuración de la agenda."
    >
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-2xl bg-gray-100" />}
      >
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
