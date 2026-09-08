import { NextResponse } from 'next/server';

import { dispatchPendingNotifications } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * Cron de reintento de la cola de notificaciones (ver `vercel.json`).
 *
 * El envío normal ya se intenta inline desde el webhook de Mercado Pago;
 * este endpoint es la red de seguridad para las que quedaron `pending`
 * (Meta caído, timeout, credenciales cargadas después, etc.).
 *
 * Autenticación: `Authorization: Bearer <CRON_SECRET>`. Vercel Cron manda
 * ese header automáticamente cuando la env var `CRON_SECRET` está definida
 * en el proyecto. Sin `CRON_SECRET` configurado, el endpoint queda cerrado
 * (responde 401) — es a propósito: no debe ser público.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

async function handle(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const summary = await dispatchPendingNotifications();
  return NextResponse.json(summary);
}

export function GET(request: Request): Promise<NextResponse> {
  return handle(request);
}

/** Por si se lo dispara manualmente con POST (curl, panel, etc.). */
export function POST(request: Request): Promise<NextResponse> {
  return handle(request);
}
