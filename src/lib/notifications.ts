/**
 * Orquestación de la cola de notificaciones (outbox).
 *
 * Hoy tiene un único evento: `deposit_paid` — cuando un cliente paga la seña
 * de un turno, se le manda un WhatsApp al dueño (número configurado en
 * Configuraciones › Notificaciones).
 *
 * Flujo:
 *  1. El webhook de Mercado Pago llama `enqueueDepositPaidNotification()` al
 *     confirmar un pago `approved`. Se crea UNA fila en `notifications`
 *     (idempotente por `unique (appointment_id, kind)`) y se intenta el
 *     envío en el acto.
 *  2. Si el envío falla, la fila queda `pending` con `next_retry_at`; el cron
 *     `/api/notifications/dispatch` la reintenta con backoff exponencial
 *     hasta `MAX_ATTEMPTS`, después la marca `failed`.
 *
 * Las funciones de acceso a datos viven en `lib/db.ts`
 * (`createNotificationIfAbsent`, `listDispatchableNotifications`,
 * `updateNotification`); acá va sólo la lógica.
 */

import { formatCustomerPhone } from './brand';
import { formatLongDate } from './date';
import {
  createNotificationIfAbsent,
  getBarber,
  getService,
  getSettings,
  listDispatchableNotifications,
  updateNotification,
} from './db';
import type { Appointment, AppointmentNotification } from './types';
import {
  isWhatsappConfigured,
  sendWhatsappTemplate,
  WhatsappNotConfiguredError,
} from './whatsapp';

const DEPOSIT_PAID_KIND = 'deposit_paid';
const WHATSAPP_CHANNEL = 'whatsapp';
const MAX_ATTEMPTS = 5;

/** 1m, 2m, 4m, 8m… con techo de 30 min. */
function backoffMs(attempt: number): number {
  return Math.min(60_000 * 2 ** (attempt - 1), 30 * 60_000);
}

interface DepositPaidPayload {
  customerName: string;
  customerPhone: string;
  serviceName: string;
  barberName: string;
  dateLabel: string;
  time: string;
  /** Parámetros posicionales de la plantilla, congelados para los reintentos. */
  bodyParams: string[];
}

function buildDepositPaidPayload(
  appointment: Appointment,
  serviceName: string,
  barberName: string,
): DepositPaidPayload {
  const customerPhone = formatCustomerPhone(appointment.customerPhone);
  const dateLabel = formatLongDate(appointment.date);

  // Orden = variables {{1}}..{{6}} de la plantilla `turno_confirmado`
  // (ver docs/whatsapp-setup.md).
  const bodyParams = [
    appointment.customerName,
    customerPhone,
    serviceName,
    barberName,
    dateLabel,
    appointment.time,
  ];

  return {
    customerName: appointment.customerName,
    customerPhone,
    serviceName,
    barberName,
    dateLabel,
    time: appointment.time,
    bodyParams,
  };
}

function readBodyParams(payload: Record<string, unknown> | null): string[] | null {
  const raw = (payload as { bodyParams?: unknown } | null)?.bodyParams;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.map((value) => String(value));
}

export type DispatchOutcome = 'sent' | 'failed' | 'retry' | 'not_configured';

/**
 * Intenta enviar una notificación y actualiza su fila según el resultado.
 * No lanza: cualquier error queda reflejado en la fila (`last_error`,
 * `status`).
 */
export async function dispatchNotification(
  notification: AppointmentNotification,
): Promise<DispatchOutcome> {
  if (notification.status === 'sent') return 'sent';

  const bodyParams = readBodyParams(notification.payload);
  if (!bodyParams) {
    await updateNotification(notification.id, {
      status: 'failed',
      lastError: 'Payload inválido: faltan los parámetros del mensaje.',
      nextRetryAt: null,
    });
    return 'failed';
  }

  const attempts = notification.attempts + 1;

  try {
    const { messageId } = await sendWhatsappTemplate({
      to: notification.recipient,
      bodyParams,
    });
    await updateNotification(notification.id, {
      status: 'sent',
      attempts,
      sentAt: new Date().toISOString(),
      providerMessageId: messageId || null,
      lastError: null,
      nextRetryAt: null,
    });
    return 'sent';
  } catch (cause) {
    if (cause instanceof WhatsappNotConfiguredError) {
      // No es un fallo real: se deja pendiente para cuando existan las
      // credenciales. No se consume un intento.
      console.warn(
        '[chivas] Notificación de WhatsApp encolada, pero la Cloud API todavía no está configurada.',
      );
      return 'not_configured';
    }

    const message =
      cause instanceof Error ? cause.message : 'Error desconocido al enviar WhatsApp';

    if (attempts >= MAX_ATTEMPTS) {
      await updateNotification(notification.id, {
        status: 'failed',
        attempts,
        lastError: message,
        nextRetryAt: null,
      });
      console.error(
        `[chivas] Notificación ${notification.id} descartada tras ${attempts} intentos: ${message}`,
      );
      return 'failed';
    }

    await updateNotification(notification.id, {
      status: 'pending',
      attempts,
      lastError: message,
      nextRetryAt: new Date(Date.now() + backoffMs(attempts)).toISOString(),
    });
    return 'retry';
  }
}

/**
 * Encola (y trata de enviar en el acto) el aviso al dueño por un turno con
 * la seña recién pagada. La llama el webhook de Mercado Pago.
 *
 * No lanza: si algo falla, el aviso queda en la cola para el cron, o se
 * loguea y se sigue — nunca rompe la respuesta 200 al webhook.
 */
export async function enqueueDepositPaidNotification(
  appointment: Appointment,
): Promise<void> {
  const settings = await getSettings();
  const recipient = settings.ownerWhatsapp?.trim();

  if (!recipient) {
    console.warn(
      '[chivas] Se pagó una seña pero no hay WhatsApp del dueño configurado (Configuraciones › Notificaciones): no se encola el aviso.',
    );
    return;
  }

  const [barber, service] = await Promise.all([
    getBarber(appointment.barberId),
    appointment.serviceId ? getService(appointment.serviceId) : Promise.resolve(null),
  ]);

  const payload = buildDepositPaidPayload(
    appointment,
    service?.name ?? 'Sin servicio',
    barber?.name ?? 'Sin asignar',
  );

  const notification = await createNotificationIfAbsent({
    appointmentId: appointment.id,
    kind: DEPOSIT_PAID_KIND,
    channel: WHATSAPP_CHANNEL,
    recipient,
    payload: payload as unknown as Record<string, unknown>,
  });

  // `null` = ya existía (reintento del webhook de Mercado Pago) → no reenviar.
  if (!notification) return;

  await dispatchNotification(notification);
}

export interface DispatchSummary {
  processed: number;
  sent: number;
  retry: number;
  failed: number;
  skipped?: 'not_configured';
}

/**
 * Barre la cola y reintenta las pendientes. La llama el cron
 * `/api/notifications/dispatch`. Si no hay credenciales de WhatsApp, no toca
 * nada (las filas siguen esperando).
 */
export async function dispatchPendingNotifications(
  limit = 20,
): Promise<DispatchSummary> {
  if (!isWhatsappConfigured()) {
    return { processed: 0, sent: 0, retry: 0, failed: 0, skipped: 'not_configured' };
  }

  const pending = await listDispatchableNotifications(limit);
  const summary: DispatchSummary = {
    processed: pending.length,
    sent: 0,
    retry: 0,
    failed: 0,
  };

  for (const notification of pending) {
    const outcome = await dispatchNotification(notification);
    if (outcome === 'sent') summary.sent += 1;
    else if (outcome === 'retry') summary.retry += 1;
    else if (outcome === 'failed') summary.failed += 1;
  }

  return summary;
}
