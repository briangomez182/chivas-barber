import { NextResponse } from 'next/server';

import { updateAppointmentPayment } from '@/lib/db';
import { getPayment, verifyWebhookSignature } from '@/lib/mercadopago';
import type { PaymentStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface WebhookBody {
  type?: string;
  action?: string;
  data?: { id?: string | number };
}

/**
 * POST /api/mercado-pago/webhook
 *
 * Mercado Pago llama esta URL cada vez que cambia el estado de un pago. Acá:
 *
 * 1. Se valida la firma `x-signature` (si `MERCADOPAGO_WEBHOOK_SECRET` está
 *    configurado) para asegurarnos de que la notificación viene de verdad
 *    de Mercado Pago.
 * 2. Se vuelve a consultar el pago por su ID directamente a la API de
 *    Mercado Pago — NUNCA se confía en el estado que venga en el body de la
 *    notificación, sólo se usa para saber qué ID de pago consultar.
 * 3. Se busca el turno por `external_reference` y se actualiza vía
 *    `updateAppointmentPayment` (service_role, saltea RLS a propósito: el
 *    webhook no tiene sesión de usuario).
 *
 * Siempre responde 200 (salvo firma inválida) — si devolviéramos error,
 * Mercado Pago reintenta la notificación varias veces.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as WebhookBody;

  const type = body.type ?? searchParams.get('type') ?? searchParams.get('topic');
  const rawId = body.data?.id ?? searchParams.get('data.id') ?? searchParams.get('id');

  if (type !== 'payment' || !rawId) {
    return NextResponse.json({ ok: true });
  }

  const dataId = String(rawId);

  const validSignature = verifyWebhookSignature({
    xSignature: request.headers.get('x-signature'),
    xRequestId: request.headers.get('x-request-id'),
    dataId,
  });

  if (!validSignature) {
    console.warn('[chivas] Webhook de Mercado Pago con firma inválida, se ignora.');
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  try {
    const payment = await getPayment(dataId);
    const appointmentId = payment.externalReference;
    const paymentStatus = payment.status as PaymentStatus | undefined;

    if (!appointmentId || !paymentStatus) {
      return NextResponse.json({ ok: true });
    }

    const newStatus =
      paymentStatus === 'approved'
        ? ('confirmed' as const)
        : paymentStatus === 'rejected' ||
            paymentStatus === 'cancelled' ||
            paymentStatus === 'refunded' ||
            paymentStatus === 'charged_back'
          ? ('cancelled' as const)
          : null; // pending / in_process / authorized / in_mediation: se mantiene pending_payment

    await updateAppointmentPayment(appointmentId, {
      paymentId: dataId,
      paymentStatus,
      newStatus,
    });

    return NextResponse.json({ ok: true });
  } catch (cause) {
    console.error('[chivas] Error procesando webhook de Mercado Pago', cause);
    return NextResponse.json({ ok: true });
  }
}

/** Mercado Pago a veces hace un GET de prueba al guardar la URL en el panel. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true });
}
