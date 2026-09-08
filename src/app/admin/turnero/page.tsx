import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { TurneroView } from '@/components/admin/TurneroView';
import { getBarber, listBarbers, listServices } from '@/lib/db';
import { getSession } from '@/lib/guard';

export const metadata: Metadata = {
  title: 'Turnero',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function TurneroPage() {
  // El middleware ya bloquea la ruta; esta es la segunda barrera.
  const session = await getSession();
  if (!session || (session.role !== 'admin' && session.role !== 'editor')) {
    redirect('/login?next=/admin/turnero');
  }

  const services = await listServices();
  const serviceNames = services.map((service) => ({
    id: service.id,
    name: service.name,
  }));

  if (session.role === 'editor') {
    if (!session.barberId) redirect('/login?next=/admin/turnero');
    const barber = await getBarber(session.barberId);
    if (!barber) redirect('/login?next=/admin/turnero');

    return (
      <TurneroView
        role="editor"
        userName={session.name}
        barbers={[{ id: barber.id, name: barber.name }]}
        initialBarberId={barber.id}
        services={serviceNames}
      />
    );
  }

  const barbers = await listBarbers();

  return (
    <TurneroView
      role="admin"
      userName={session.name}
      barbers={barbers.map((barber) => ({ id: barber.id, name: barber.name }))}
      initialBarberId={barbers[0]?.id ?? null}
      services={serviceNames}
    />
  );
}
