import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthShell } from '@/components/auth/AuthShell';
import { RegisterForm } from '@/components/auth/RegisterForm';

export const metadata: Metadata = {
  title: 'Crear cuenta',
  description:
    'Registrate en Chivas Barbería Club y reservá tus turnos más rápido.',
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Sumate al club"
      subtitle="Creá tu cuenta para reservar más rápido y guardar tu historial de turnos."
      footer={
        <p>
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Ingresá
          </Link>
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
