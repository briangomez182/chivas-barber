import type { SessionPayload } from './types';

/**
 * Sesión mock firmada con HMAC-SHA256 usando Web Crypto,
 * disponible tanto en el runtime Node como en el Edge (middleware).
 */

export const SESSION_COOKIE = 'cbc_session';
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 horas

const SECRET =
  process.env.AUTH_SECRET ?? 'chivas-barberia-club-dev-secret-change-me';

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return buffer;
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** Genera `payloadBase64.firmaBase64`. */
export async function signSession(
  payload: Omit<SessionPayload, 'exp'>,
): Promise<string> {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };

  const body = base64UrlEncode(encoder.encode(JSON.stringify(full)));
  const key = await getKey();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));

  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** Devuelve la sesión si el token es válido y no expiró; `null` si no. */
export async function verifySession(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  try {
    const key = await getKey();
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signature),
      encoder.encode(body),
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(body)),
    ) as SessionPayload;

    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
