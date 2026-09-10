import type { Metadata } from 'next';

import { AuthShell } from '@/components/auth/AuthShell';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Nueva contraseña',
  description: 'Definí una nueva contraseña para tu cuenta.',
  robots: { index: false, follow: false },
};

export default function NuevaPasswordPage() {
  return (
    <AuthShell
      title="Elegí una contraseña nueva"
      subtitle="Este enlace es de un solo uso y vence a los pocos minutos."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
