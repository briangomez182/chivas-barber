import crypto from 'node:crypto';

import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

/**
 * Cliente de Mercado Pago (Checkout Pro).
 *
 * Sólo se usa `MERCADOPAGO_ACCESS_TOKEN` en el servidor — la public key no
 * hace falta para este flujo (redirección al `init_point`), pero queda
 * declarada en `.env.example` por si en el futuro se agrega Checkout Bricks
 * o el botón "Wallet" embebido, que sí la requieren en el cliente.
 */

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN ?? '';

if (!accessToken) {
  console.warn(
    '[chivas] Falta MERCADOPAGO_ACCESS_TOKEN: el botón de pago no va a funcionar hasta configurarlo.',
  );
}

const client = new MercadoPagoConfig({
  accessToken,
  options: { timeout: 8000 },
});

const preferenceClient = new Preference(client);
const paymentClient = new Payment(client);

/**
 * URL pública del sitio (para `back_urls` y `notification_url`).
 *
 * Sin prefijo `NEXT_PUBLIC_`: esta función sólo corre en el servidor (la
 * usan las Route Handlers de checkout/webhook, nunca un componente
 * cliente), así que no hace falta exponerla al navegador.
 */
export function siteUrl(): string {
  const configured = process.env.BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return 'http://localhost:3000';
}

export interface CreatePreferenceInput {
  appointmentId: string;
  title: string;
  unitPrice: number;
  payerName: string;
  payerEmail: string | null;
}

export interface PreferenceResult {
  id: string;
  initPoint: string;
}

/**
 * Crea una preferencia de pago de Checkout Pro para un turno pendiente.
 * `external_reference` es el ID del turno: así el webhook sabe qué turno
 * confirmar cuando llega la notificación de pago aprobado.
 */
export async function createPreference(
  input: CreatePreferenceInput,
): Promise<PreferenceResult> {
  const base = siteUrl();
  const isPublicHttps = base.startsWith('https://');

  const response = await preferenceClient.create({
    body: {
      items: [
        {
          id: input.appointmentId,
          title: input.title,
          quantity: 1,
          unit_price: input.unitPrice,
          currency_id: 'ARS',
        },
      ],
      payer: input.payerEmail
        ? { name: input.payerName, email: input.payerEmail }
        : { name: input.payerName },
      external_reference: input.appointmentId,
      statement_descriptor: 'CHIVAS BARBERIA',
      back_urls: {
        success: `${base}/booking/success`,
        failure: `${base}/booking/failure`,
        pending: `${base}/booking/pending`,
      },
      // `auto_return` exige `back_urls.success` público https — en local
      // Mercado Pago la rechaza, así que sólo se manda ya publicado.
      ...(isPublicHttps ? { auto_return: 'approved' as const } : {}),
      notification_url: `${base}/api/mercado-pago/webhook`,
    },
  });

  if (!response.id || !response.init_point) {
    throw new Error('Mercado Pago no devolvió una preferencia de pago válida');
  }

  return { id: response.id, initPoint: response.init_point };
}

/** Consulta un pago por ID (lo usa el webhook para confirmar el estado real). */
export async function getPayment(paymentId: string): Promise<{
  id: number | undefined;
  status: string | undefined;
  externalReference: string | undefined;
}> {
  const payment = await paymentClient.get({ id: paymentId });
  return {
    id: payment.id,
    status: payment.status,
    externalReference: payment.external_reference,
  };
}

/**
 * Verifica la firma `x-signature` que Mercado Pago envía en cada webhook,
 * usando el secreto configurado en el panel de notificaciones (Tus
 * integraciones → tu app → Webhooks → "Clave secreta").
 *
 * Si `MERCADOPAGO_WEBHOOK_SECRET` no está configurado, no se puede validar
 * la firma — el webhook igual funciona (para no romper en desarrollo), pero
 * cualquiera podría simular una notificación de pago aprobado. Configuralo
 * antes de recibir pagos reales (ver README.md).
 */
export function verifyWebhookSignature(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
}): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn(
      '[chivas] Falta MERCADOPAGO_WEBHOOK_SECRET: no se puede validar la firma del webhook de Mercado Pago.',
    );
    return true;
  }

  if (!params.xSignature) return false;

  const parts = Object.fromEntries(
    params.xSignature.split(',').map((chunk) => {
      const [key, value] = chunk.split('=');
      return [key?.trim(), value?.trim()];
    }),
  );

  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) return false;

  const manifest = `id:${params.dataId.toLowerCase()};${
    params.xRequestId ? `request-id:${params.xRequestId};` : ''
  }ts:${ts};`;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
  } catch {
    return false;
  }
}
