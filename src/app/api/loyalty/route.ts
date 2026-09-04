import { NextResponse } from 'next/server';

import { adjustLoyaltyStamp, getLoyaltyCard } from '@/lib/db';
import { requireAdmin } from '@/lib/guard';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Deja sólo los dígitos del teléfono (el prefijo lo arma WhatsAppPhoneInput). */
function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

function isValidPhone(digits: string): boolean {
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * GET /api/loyalty?phone=<número> — consulta pública de la tarjeta de sellos.
 *
 * Devuelve siempre una tarjeta (ceros y `exists: false` si el cliente todavía
 * no sumó ningún sello). Rate-limitado por IP para que no se pueda enumerar
 * la base de teléfonos a fuerza de requests.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`loyalty-lookup:${ip}`, 30, 60))) {
    return rateLimitResponse();
  }

  const { searchParams } = new URL(request.url);
  const phone = phoneDigits(searchParams.get('phone') ?? '');

  if (!isValidPhone(phone)) {
    return NextResponse.json(
      { error: 'Ingresá un número de teléfono válido' },
      { status: 400 },
    );
  }

  const card = await getLoyaltyCard(phone);
  return NextResponse.json({ card });
}

interface AdjustBody {
  phone?: string;
  delta?: number;
}

/**
 * POST /api/loyalty — ajuste manual de sellos (+1 / -1), sólo admin.
 *
 * `requireAdmin()` autoriza la operación; el ajuste corre con el cliente
 * `service_role` (como el resto del panel de admin — ver `lib/db.ts`), así no
 * depende del ciclo de vida del JWT de la sesión. La función de Postgres
 * `admin_adjust_loyalty_stamp` igual revalida el rol si la llamada trae
 * sesión.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const body = (await request.json().catch(() => ({}))) as AdjustBody;
  const phone = phoneDigits(body.phone ?? '');
  const delta = Number(body.delta);

  if (!isValidPhone(phone)) {
    return NextResponse.json(
      { error: 'Ingresá un número de teléfono válido' },
      { status: 400 },
    );
  }
  if (delta !== 1 && delta !== -1) {
    return NextResponse.json(
      { error: 'El ajuste debe ser de +1 o -1 sello' },
      { status: 400 },
    );
  }

  let result: Awaited<ReturnType<typeof adjustLoyaltyStamp>>;
  try {
    result = await adjustLoyaltyStamp(phone, delta);
  } catch (cause) {
    console.error('[chivas] Error ajustando tarjeta de lealtad', cause);
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : 'No se pudo ajustar la tarjeta',
      },
      { status: 500 },
    );
  }

  if ('error' in result) {
    if (result.error === 'FORBIDDEN') {
      return NextResponse.json(
        { error: 'No tenés permisos para esta acción' },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: 'El número de teléfono no es válido' },
      { status: 400 },
    );
  }

  return NextResponse.json({ card: result.card });
}
