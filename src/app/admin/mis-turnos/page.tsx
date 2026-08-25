import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { EditorTurnosPanel } from '@/components/admin/EditorTurnosPanel';
import { getBarber, listServices } from '@/lib/db';
import { getSession } from '@/lib/guard';

export const metadata: Metadata = {
  title: 'Mis turnos',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function MisTurnosPage() {
  // El middleware ya bloquea la ruta; esta es la segunda barrera (defensa en profundidad).
  const session = await getSession();
  if (!session || session.role !== 'editor' || !session.barberId) {
    redirect('/login?next=/admin/mis-turnos');
  }

  const [barber, services] = await Promise.all([
    getBarber(session.barberId),
    listServices(),
  ]);

  if (!barber) {
    redirect('/login?next=/admin/mis-turnos');
  }

  return (
    <EditorTurnosPanel editorName={session.name} barber={barber} services={services} />
  );
}
