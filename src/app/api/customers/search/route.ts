import { NextResponse } from 'next/server';

import { searchCustomersByName, searchCustomersByPhone } from '@/lib/db';
import { requireAdmin } from '@/lib/guard';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/customers/search?q=<texto>&by=<name|phone> — autocompletado de
 * clientes para el panel de admin (tarjetas de lealtad). `by=phone` busca
 * coincidencias parciales de número; cualquier otro valor busca por nombre.
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
  const by = searchParams.get('by') === 'phone' ? 'phone' : 'name';

  if (q.length < 2) {
    return NextResponse.json({ customers: [] });
  }

  const customers =
    by === 'phone'
      ? await searchCustomersByPhone(q)
      : await searchCustomersByName(q);
  return NextResponse.json({ customers });
}
