/**
 * Cliente de la WhatsApp Cloud API de Meta (Graph API).
 *
 * Sólo corre en el servidor (lo usa `lib/notifications.ts`, que a su vez
 * llaman el webhook de Mercado Pago y el cron de despacho). Nunca se importa
 * desde un componente cliente: `WHATSAPP_ACCESS_TOKEN` es una credencial de
 * servidor.
 *
 * Para mensajes iniciados por el negocio (business-initiated) Meta exige una
 * plantilla aprobada — no se puede mandar texto libre. Ver
 * `docs/whatsapp-setup.md` para crear la app, el número y la plantilla.
 */

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION?.trim() || 'v21.0';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '';
const TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME?.trim() || '';
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG?.trim() || 'es_AR';

const REQUEST_TIMEOUT_MS = 8000;

/**
 * Faltan credenciales de la Cloud API. El despachador lo trata distinto de
 * un error de envío: la notificación se deja `pending` (no `failed`) para
 * que se mande sola cuando se configuren las variables, sin perder el aviso.
 */
export class WhatsappNotConfiguredError extends Error {
  constructor() {
    super(
      'WhatsApp Cloud API sin configurar: faltan WHATSAPP_ACCESS_TOKEN, ' +
        'WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_TEMPLATE_NAME.',
    );
    this.name = 'WhatsappNotConfiguredError';
  }
}

/** La Graph API respondió con error (o no se pudo contactar). */
export class WhatsappSendError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'WhatsappSendError';
    this.status = status;
  }
}

/** `true` si están las tres variables mínimas para poder enviar. */
export function isWhatsappConfigured(): boolean {
  return Boolean(ACCESS_TOKEN && PHONE_NUMBER_ID && TEMPLATE_NAME);
}

export interface SendTemplateInput {
  /** Teléfono del destinatario — con o sin `+`, se normaliza a dígitos. */
  to: string;
  /**
   * Parámetros posicionales del cuerpo de la plantilla, en orden
   * (`{{1}}`, `{{2}}`, …).
   */
  bodyParams: string[];
}

interface GraphResponse {
  messages?: { id?: string }[];
  error?: { message?: string; code?: number; error_data?: { details?: string } };
}

/**
 * Envía un mensaje de plantilla. Devuelve el `wamid` que asigna Meta (string
 * vacío si la respuesta no lo trae, aunque siempre debería).
 *
 * Lanza `WhatsappNotConfiguredError` si faltan credenciales y
 * `WhatsappSendError` si la Graph API rechaza el envío o no responde.
 */
export async function sendWhatsappTemplate({
  to,
  bodyParams,
}: SendTemplateInput): Promise<{ messageId: string }> {
  if (!isWhatsappConfigured()) throw new WhatsappNotConfiguredError();

  const recipient = to.replace(/\D/g, '');
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
          name: TEMPLATE_NAME,
          language: { code: TEMPLATE_LANG },
          components: [
            {
              type: 'body',
              parameters: bodyParams.map((text) => ({ type: 'text', text })),
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    const detail =
      cause instanceof Error ? cause.message : 'error de red desconocido';
    throw new WhatsappSendError(`No se pudo contactar la Graph API: ${detail}`, 0);
  }

  const json = (await response.json().catch(() => null)) as GraphResponse | null;

  if (!response.ok) {
    const detail =
      json?.error?.message ??
      json?.error?.error_data?.details ??
      `HTTP ${response.status}`;
    throw new WhatsappSendError(detail, response.status);
  }

  return { messageId: json?.messages?.[0]?.id ?? '' };
}
