import { NextResponse } from 'next/server';

import { searchCustomersByName } from '@/lib/db';
import { requireAdmin } from '@/lib/guard';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/customers/search?q=<texto> — autocompletado de clientes por
 * nombre para el panel de admin (tarjetas de lealtad).
 *
 * Sólo admin: devuelve nombre + teléfono de clientes, no es información
 * pública. Rate-limitado por IP porque el front pega una request por cada
 * tecla (con debounce).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const ip = getClientIp(request);
  if (!(await checkRateLimit(`customer-search:${ip}`, 90, 60))) {
    return rateLimitResponse();
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();

  if (q.length < 2) {
    return NextResponse.json({ customers: [] });
  }

  const customers = await searchCustomersByName(q);
  return NextResponse.json({ customers });
}
