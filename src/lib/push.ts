/**
 * Envío de notificaciones push web (Web Push Protocol + VAPID).
 *
 * Sólo corre en el servidor. Lo usan el webhook de Mercado Pago y
 * `POST /api/book` para avisarle al dueño / staff que entró un turno nuevo,
 * y `POST /api/push/test` para la prueba manual desde el panel.
 *
 * Las suscripciones (una por dispositivo) viven en `push_subscriptions` —
 * ver supabase/migrations/0016. El envío es best-effort: si un endpoint
 * falla se loguea; si el push service dice que la suscripción venció
 * (404/410) se borra la fila. No hay reintentos ni cola: el aviso "fuerte"
 * y con reintentos es el de WhatsApp (`lib/notifications.ts`).
 *
 * Configuración: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`
 * (un `mailto:` o URL). Se generan una vez con `npx web-push generate-vapid-keys`.
 */

import webpush from 'web-push';

import { formatLongDate } from './date';
import {
  deletePushSubscription,
  getBarber,
  getService,
  listPushSubscriptions,
  markPushSubscription,
  type StoredPushSubscription,
} from './db';
import type { Appointment } from './types';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY?.trim() || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY?.trim() || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT?.trim() || 'mailto:hola@chivasbarberiaclub.com';

/** `true` si están las dos claves VAPID para poder firmar los envíos. */
export function isPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

/** Clave pública VAPID que el cliente necesita para suscribirse. */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

let vapidReady = false;
function ensureVapid(): void {
  if (vapidReady) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidReady = true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** A dónde lleva el click. Ruta relativa (se abre sobre el origin). */
  url?: string;
  /** Agrupa/reemplaza notificaciones con el mismo tag en el dispositivo. */
  tag?: string;
}

export interface PushSendSummary {
  /** Suscripciones que había al momento de enviar. */
  total: number;
  sent: number;
  failed: number;
  /** Suscripciones vencidas que se borraron (404/410). */
  removed: number;
  skipped?: 'not_configured';
}

interface WebPushError {
  statusCode?: number;
  body?: string;
}

async function sendOne(
  sub: StoredPushSubscription,
  body: string,
): Promise<'sent' | 'failed' | 'removed'> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      body,
      { TTL: 3600, urgency: 'high' },
    );
    await markPushSubscription(sub.endpoint, {
      lastSuccessAt: new Date().toISOString(),
      lastError: null,
    });
    return 'sent';
  } catch (cause) {
    const status = (cause as WebPushError).statusCode;

    // 404 (no existe) / 410 (Gone): la suscripción caducó o el usuario
    // desinstaló la PWA. No sirve reintentar: se borra.
    if (status === 404 || status === 410) {
      await deletePushSubscription(sub.endpoint);
      return 'removed';
    }

    const detail =
      (cause as WebPushError).body ||
      (cause instanceof Error ? cause.message : 'error desconocido');
    console.error(
      `[chivas] Push a ${sub.endpoint.slice(0, 60)}… falló (HTTP ${status ?? '?'}): ${detail}`,
    );
    await markPushSubscription(sub.endpoint, {
      lastError: `HTTP ${status ?? '?'}: ${detail}`.slice(0, 500),
    });
    return 'failed';
  }
}

/**
 * Manda la misma notificación a todos los dispositivos suscritos. No lanza:
 * cualquier fallo queda en el `console.error` y en `push_subscriptions.last_error`.
 */
export async function sendPushToAll(payload: PushPayload): Promise<PushSendSummary> {
  if (!isPushConfigured()) {
    return { total: 0, sent: 0, failed: 0, removed: 0, skipped: 'not_configured' };
  }

  ensureVapid();

  const subs = await listPushSubscriptions();
  const body = JSON.stringify(payload);

  const summary: PushSendSummary = {
    total: subs.length,
    sent: 0,
    failed: 0,
    removed: 0,
  };

  const results = await Promise.all(subs.map((sub) => sendOne(sub, body)));
  for (const result of results) {
    if (result === 'sent') summary.sent += 1;
    else if (result === 'failed') summary.failed += 1;
    else summary.removed += 1;
  }

  console.log(
    `[chivas] Push "${payload.title}": ${summary.sent} enviada(s), ` +
      `${summary.failed} con error, ${summary.removed} vencida(s) — ` +
      `${summary.total} suscripción(es).`,
  );

  return summary;
}

/**
 * Aviso de turno nuevo. Lo llaman el webhook de Mercado Pago (seña pagada) y
 * `POST /api/book` (reserva sin seña). Best-effort: se envuelve en try/catch
 * en el llamador para no romper la respuesta.
 */
export async function notifyNewAppointment(appointment: Appointment): Promise<void> {
  const [barber, service] = await Promise.all([
    getBarber(appointment.barberId),
    appointment.serviceId ? getService(appointment.serviceId) : Promise.resolve(null),
  ]);

  const servicePart = service ? ` · ${service.name}` : '';
  const dateLabel = formatLongDate(appointment.date);

  await sendPushToAll({
    title: '✂️ Nuevo turno reservado',
    body: `${appointment.customerName} — ${dateLabel} ${appointment.time} h con ${
      barber?.name ?? 'sin asignar'
    }${servicePart}`,
    url: '/admin',
    tag: `appointment-${appointment.id}`,
  });
}
