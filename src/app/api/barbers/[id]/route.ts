import { NextResponse } from 'next/server';

import { deleteBarber, updateBarber, type BarberInput } from '@/lib/db';
import { requireAdmin, requireAdminOrEditor } from '@/lib/guard';
import {
  MAX_BOOKING_WINDOW_DAYS,
  MIN_BOOKING_WINDOW_DAYS,
  SLOT_INTERVALS,
  type Barber,
  type SlotInterval,
} from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

type BarberPatch = Partial<Omit<Barber, 'id' | 'createdAt'>>;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isSlotInterval(value: number): value is SlotInterval {
  return (SLOT_INTERVALS as readonly number[]).includes(value);
}

/**
 * Valida y normaliza los campos de agenda del barbero. Devuelve el patch a
 * aplicar, o un mensaje de error si algo no cierra.
 */
function readSchedulePatch(
  body: BarberPatch,
): { patch: Partial<BarberInput> } | { error: string } {
  const patch: Partial<BarberInput> = {};

  for (const [key, value] of [
    ['openingTime', body.openingTime],
    ['closingTime', body.closingTime],
  ] as const) {
    if (value === undefined) continue;
    if (typeof value !== 'string' || !TIME_PATTERN.test(value)) {
      return { error: 'Horario inválido (se espera HH:mm).' };
    }
    patch[key] = value;
  }

  if (
    patch.openingTime !== undefined &&
    patch.closingTime !== undefined &&
    patch.openingTime >= patch.closingTime
  ) {
    return { error: 'La apertura tiene que ser antes del cierre.' };
  }

  if (body.workingDays !== undefined) {
    if (
      !Array.isArray(body.workingDays) ||
      body.workingDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    ) {
      return { error: 'Días laborables inválidos.' };
    }
    patch.workingDays = Array.from(new Set(body.workingDays)).sort((a, b) => a - b);
  }

  if (body.slotIntervalMin !== undefined) {
    if (!isSlotInterval(Number(body.slotIntervalMin))) {
      return { error: 'El intervalo debe ser 15, 30, 45 o 60 minutos.' };
    }
    patch.slotIntervalMin = Number(body.slotIntervalMin) as SlotInterval;
  }

  if (body.bufferMin !== undefined) {
    const value = Number(body.bufferMin);
    if (!Number.isFinite(value) || value < 0 || value > 120) {
      return { error: 'El descanso debe estar entre 0 y 120 minutos.' };
    }
    patch.bufferMin = Math.round(value);
  }

  if (body.bookingWindowDays !== undefined) {
    const value = Number(body.bookingWindowDays);
    if (
      !Number.isInteger(value) ||
      value < MIN_BOOKING_WINDOW_DAYS ||
      value > MAX_BOOKING_WINDOW_DAYS
    ) {
      return {
        error: `Los días habilitados deben estar entre ${MIN_BOOKING_WINDOW_DAYS} y ${MAX_BOOKING_WINDOW_DAYS}.`,
      };
    }
    patch.bookingWindowDays = value;
  }

  return { patch };
}

/**
 * PATCH /api/barbers/:id — edición.
 *
 * Admin: todos los campos. Editor (sólo su propia ficha): únicamente la
 * agenda (horario, días, intervalo, descanso y ventana de reserva); no puede
 * cambiar su nombre, rol, foto ni darse de baja.
 */
export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;

  const guard = await requireAdminOrEditor(id);
  if ('response' in guard) return guard.response;

  const isEditor = guard.session.role === 'editor';

  const body = (await request.json().catch(() => ({}))) as BarberPatch;

  const patch: Partial<BarberInput> = {};

  if (!isEditor) {
    if (typeof body.name === 'string' && body.name.trim()) {
      patch.name = body.name.trim();
    }
    if (typeof body.role === 'string') patch.role = body.role.trim();
    if (typeof body.specialty === 'string') {
      patch.specialty = body.specialty.trim();
    }
    if (typeof body.photoUrl === 'string') {
      patch.photoUrl = body.photoUrl.trim();
    }
    if (typeof body.active === 'boolean') patch.active = body.active;
  }

  const schedule = readSchedulePatch(body);
  if ('error' in schedule) {
    return NextResponse.json({ error: schedule.error }, { status: 400 });
  }
  Object.assign(patch, schedule.patch);

  const barber = await updateBarber(id, patch);

  if (!barber) {
    return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ barber });
}

/** DELETE /api/barbers/:id — baja definitiva y limpieza de turnos (admin). */
export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const { id } = await context.params;

  const removed = await deleteBarber(id);

  if (!removed) {
    return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
