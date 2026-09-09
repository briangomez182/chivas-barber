import { NextResponse } from 'next/server';

import { countPushSubscriptions } from '@/lib/db';
import { requireStaff } from '@/lib/guard';
import { getVapidPublicKey, isPushConfigured } from '@/lib/push';

export const dynamic = 'force-dynamic';

/**
 * GET /api/push — datos que el panel necesita para el alta de notificaciones
 * push en este dispositivo: la clave pública VAPID (para `pushManager.subscribe`)
 * y si el servidor tiene las credenciales cargadas.
 *
 * Sólo staff (admin/editor): las notificaciones push son para el equipo, no
 * para clientes.
 */
export async function GET(): Promise<NextResponse> {
  const guard = await requireStaff();
  if ('response' in guard) return guard.response;

  const configured = isPushConfigured();

  return NextResponse.json({
    configured,
    publicKey: configured ? getVapidPublicKey() : null,
    deviceCount: configured ? await countPushSubscriptions() : 0,
  });
}
