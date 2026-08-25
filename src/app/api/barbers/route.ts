import { NextResponse } from 'next/server';

import { createBarber, listBarbers } from '@/lib/db';
import { requireAdmin } from '@/lib/guard';

export const dynamic = 'force-dynamic';

interface BarberBody {
  name?: string;
  role?: string;
  specialty?: string;
  photoUrl?: string;
  active?: boolean;
}

/** GET /api/barbers — públicos por defecto; `?all=1` incluye inactivos. */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('all') === '1';

  const barbers = await listBarbers(includeInactive);

  return NextResponse.json({ barbers });
}

/** POST /api/barbers — alta de barbero (admin). */
export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const body = (await request.json().catch(() => ({}))) as BarberBody;
  const name = body.name?.trim() ?? '';

  if (name.length < 2) {
    return NextResponse.json(
      { error: 'El nombre del barbero es obligatorio' },
      { status: 400 },
    );
  }

  const barber = await createBarber({
    name,
    role: body.role?.trim() || 'Barber',
    specialty: body.specialty?.trim() || 'Corte y barba',
    photoUrl: body.photoUrl?.trim() || '',
    active: body.active ?? true,
  });

  return NextResponse.json({ barber }, { status: 201 });
}
