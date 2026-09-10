import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { siteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

interface Body {
  email?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/forgot-password — dispara el mail de recuperación de
 * Supabase Auth (`resetPasswordForEmail`). El link del mail lleva a
 * `/recuperar/nueva`, donde el usuario define la contraseña nueva.
 *
 * La respuesta es SIEMPRE la misma ("si el email tiene cuenta, te llega un
 * link"), exista o no la cuenta y falle o no el envío: así el endpoint no
 * sirve para averiguar qué emails están registrados. Doble rate limit —por
 * IP y por email— para que tampoco sirva para spamear casillas.
 *
 * Cliente propio con `flowType: 'implicit'`: el mail se manda desde el
 * servidor, así que el link no puede depender de un code verifier de PKCE
 * guardado en el navegador del usuario. Con el flujo implícito el link trae
 * los tokens en el hash y `/recuperar/nueva` los canjea sin verifier.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`forgot-pass:ip:${ip}`, 5, 3600))) {
    return rateLimitResponse();
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const email = body.email?.trim().toLowerCase() ?? '';

  const genericOk = NextResponse.json({
    ok: true,
    message:
      'Si el email corresponde a una cuenta, te enviamos un enlace para restablecer la contraseña. Revisá tu casilla (y el spam).',
  });

  if (!EMAIL_PATTERN.test(email)) return genericOk;

  // Límite por email: no cambia la respuesta (seguiría filtrando el estado
  // de la cuenta), sólo evita mandar mails de más a la misma casilla.
  if (!(await checkRateLimit(`forgot-pass:email:${email}`, 3, 3600))) {
    return genericOk;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, flowType: 'implicit' } },
  );

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/recuperar/nueva`,
  });

  if (error) {
    console.error('[chivas] resetPasswordForEmail falló', error.message);
  }

  return genericOk;
}
