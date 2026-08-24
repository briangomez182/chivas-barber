import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { readDb } from '@/lib/db';
import { getSession } from '@/lib/guard';

export const metadata: Metadata = {
  title: 'Panel de administración',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // El middleware ya bloquea la ruta; esta es la segunda barrera (defensa en profundidad).
  const session = await getSession();
  if (!session || session.role !== 'admin') redirect('/login?next=/admin');

  const db = await readDb();

  return (
    <AdminDashboard
      adminName={session.name}
      initialBarbers={db.barbers}
      initialServices={db.services}
      initialSettings={db.settings}
    />
  );
}
