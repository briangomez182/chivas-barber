import { NextResponse } from 'next/server';

import { deletePushSubscription, savePushSubscription } from '@/lib/db';
import { requireStaff } from '@/lib/guard';

export const dynamic = 'force-dynamic';

interface SubscriptionBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

/**
 * POST /api/push/subscription — registra (o refresca) el `PushSubscription`
 * de este dispositivo. Body = el JSON que devuelve `pushManager.subscribe()`.
 * Sólo staff.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireStaff();
  if ('response' in guard) return guard.response;

  const body = (await request.json().catch(() => ({}))) as SubscriptionBody;
  const endpoint = body.endpoint?.trim() ?? '';
  const p256dh = body.keys?.p256dh?.trim() ?? '';
  const auth = body.keys?.auth?.trim() ?? '';

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: 'Suscripción push inválida (faltan endpoint o claves).' },
      { status: 400 },
    );
  }

  await savePushSubscription({
    endpoint,
    p256dh,
    auth,
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/push/subscription — baja de este dispositivo. Body = `{ endpoint }`.
 * Sólo staff.
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  const guard = await requireStaff();
  if ('response' in guard) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
  const endpoint = body.endpoint?.trim() ?? '';

  if (!endpoint) {
    return NextResponse.json({ error: 'Falta el endpoint.' }, { status: 400 });
  }

  await deletePushSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
