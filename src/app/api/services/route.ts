import { NextResponse } from 'next/server';

import { createId, readDb, updateDb } from '@/lib/db';
import { requireAdmin } from '@/lib/guard';
import type { Service } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface ServiceBody {
  name?: string;
  description?: string;
  durationMin?: number;
  price?: number;
  featured?: boolean;
}

/** GET /api/services */
export async function GET(): Promise<NextResponse> {
  const db = await readDb();
  return NextResponse.json({ services: db.services });
}

/** POST /api/services — alta de servicio (admin). */
export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const body = (await request.json().catch(() => ({}))) as ServiceBody;
  const name = body.name?.trim() ?? '';
  const durationMin = Number(body.durationMin);
  const price = Number(body.price);

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

  const service: Service = {
    id: createId(),
    name,
    description: body.description?.trim() ?? '',
    durationMin: Math.round(durationMin),
    price: Math.round(price),
    featured: body.featured ?? false,
    createdAt: new Date().toISOString(),
  };

  await updateDb((db) => {
    db.services.push(service);
  });

  return NextResponse.json({ service }, { status: 201 });
}
