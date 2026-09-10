import { NextResponse } from 'next/server';

import { createService, getBarber, listServices } from '@/lib/db';
import { requireAdminOrEditor } from '@/lib/guard';

export const dynamic = 'force-dynamic';

interface ServiceBody {
  barberId?: string;
  name?: string;
  description?: string;
  durationMin?: number;
  price?: number;
}

/** GET /api/services — todos, o los de un barbero con `?barberId=`. */
export async function GET(request: Request): Promise<NextResponse> {
  const barberId = new URL(request.url).searchParams.get('barberId') ?? undefined;
  const services = await listServices(barberId);
  return NextResponse.json({ services });
}

/** POST /api/services — alta de servicio: admin, o el propio barbero (editor). */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as ServiceBody;
  const barberId = body.barberId?.trim() ?? '';
  const name = body.name?.trim() ?? '';
  const durationMin = Number(body.durationMin);
  const price = Number(body.price);

  if (!barberId) {
    return NextResponse.json(
      { error: 'Falta el barbero al que pertenece el servicio' },
      { status: 400 },
    );
  }

  const guard = await requireAdminOrEditor(barberId);
  if ('response' in guard) return guard.response;

  const barber = await getBarber(barberId);
  if (!barber) {
    return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 });
  }
  if (name.length < 2) {
    return NextResponse.json(
      { error: 'El nombre del servicio es obligatorio' },
      { status: 400 },
    );
  }
  if (!Number.isFinite(durationMin) || durationMin < 5) {
    return NextResponse.json(
      { error: 'La duración debe ser de al menos 5 minutos' },
      { status: 400 },
    );
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'Precio inválido' }, { status: 400 });
  }

  const service = await createService({
    barberId,
    name,
    description: body.description?.trim() ?? '',
    durationMin: Math.round(durationMin),
    price: Math.round(price),
  });

  return NextResponse.json({ service }, { status: 201 });
}
