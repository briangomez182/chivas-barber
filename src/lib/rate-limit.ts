import { NextResponse } from 'next/server';

import { supabaseAdmin } from './supabase/admin';

/**
 * Saca la IP del cliente de los headers que pone el proxy de Vercel.
 * `x-forwarded-for` puede traer una lista ("cliente, proxy1, proxy2") — el
 * primero es el cliente real.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Rate limit por ventana fija, contado en Postgres (función
 * `check_rate_limit`, ver supabase/migrations/0011_rate_limits.sql) — así
 * el límite es el mismo para todas las invocaciones serverless, que no
 * comparten memoria entre sí.
 *
 * Si la consulta falla (Supabase caído, etc.) deja pasar el request: un
 * rate limiter roto no debería tumbar el sitio entero.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc('check_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error('[chivas] Error chequeando rate limit', error);
    return true;
  }

  return data === true;
}

export function rateLimitResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Demasiados intentos. Esperá un momento y volvé a intentar.' },
    { status: 429 },
  );
}
