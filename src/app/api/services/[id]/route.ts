import { NextResponse } from 'next/server';

import { updateDb } from '@/lib/db';
import { requireAdmin } from '@/lib/guard';
import type { Service } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

type ServicePatch = Partial<Omit<Service, 'id' | 'createdAt'>>;

/** PATCH /api/services/:id (admin) */
export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as ServicePatch;

  const result = await updateDb((db) => {
    const service = db.services.find((item) => item.id === id);
    if (!service) return null;

    if (typeof body.name === 'string' && body.name.trim()) {
      service.name = body.name.trim();
    }
    if (typeof body.description === 'string') {
      service.description = body.description.trim();
    }
    if (Number.isFinite(Number(body.durationMin))) {
      service.durationMin = Math.round(Number(body.durationMin));
    }
    if (Number.isFinite(Number(body.price))) {
      service.price = Math.round(Number(body.price));
    }
    if (typeof body.featured === 'boolean') service.featured = body.featured;

    return service;
  });

  if (!result) {
    return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ service: result });
}

/** DELETE /api/services/:id (admin) */
export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const { id } = await context.params;

  const removed = await updateDb((db) => {
    const index = db.services.findIndex((item) => item.id === id);
    if (index === -1) return false;

    db.services.splice(index, 1);
    for (const appointment of db.appointments) {
      if (appointment.serviceId === id) appointment.serviceId = null;
    }
    return true;
  });

  if (!removed) {
    return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
