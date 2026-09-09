import { NextResponse } from 'next/server';

import { requireStaff } from '@/lib/guard';
import { isPushConfigured, sendPushToAll } from '@/lib/push';

export const dynamic = 'force-dynamic';

/**
 * POST /api/push/test — manda una notificación de prueba a TODOS los
 * dispositivos suscritos. Sólo staff; lo dispara el botón "Enviar prueba"
 * del panel de Configuraciones.
 */
export async function POST(): Promise<NextResponse> {
  const guard = await requireStaff();
  if ('response' in guard) return guard.response;

  if (!isPushConfigured()) {
    return NextResponse.json(
      {
        error:
          'Faltan las claves VAPID en el servidor (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).',
      },
      { status: 503 },
    );
  }

  const summary = await sendPushToAll({
    title: '🔔 Notificación de prueba',
    body: 'Si ves esto, las notificaciones de Chivas Barbería funcionan en este dispositivo.',
    url: '/admin',
    tag: 'test',
  });

  return NextResponse.json(summary);
}
