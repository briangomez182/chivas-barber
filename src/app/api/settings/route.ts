import { NextResponse } from 'next/server';

import { readDb, updateDb } from '@/lib/db';
import { requireAdmin } from '@/lib/guard';
import { SLOT_INTERVALS, type SlotInterval } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface SettingsBody {
  slotIntervalMin?: number;
  openingTime?: string;
  closingTime?: string;
  workingDays?: number[];
  bufferMin?: number;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isSlotInterval(value: number): value is SlotInterval {
  return (SLOT_INTERVALS as readonly number[]).includes(value);
}

/** GET /api/settings */
export async function GET(): Promise<NextResponse> {
  const db = await readDb();
  return NextResponse.json({ settings: db.settings });
}

/** PUT /api/settings — parámetros globales de la agenda (admin). */
export async function PUT(request: Request): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const body = (await request.json().catch(() => ({}))) as SettingsBody;

  if (
    body.slotIntervalMin !== undefined &&
    !isSlotInterval(Number(body.slotIntervalMin))
  ) {
    return NextResponse.json(
      { error: 'El intervalo debe ser 15, 30, 45 o 60 minutos' },
      { status: 400 },
    );
  }

  for (const time of [body.openingTime, body.closingTime]) {
    if (time !== undefined && !TIME_PATTERN.test(time)) {
      return NextResponse.json(
        { error: 'Los horarios deben tener formato HH:mm' },
        { status: 400 },
      );
    }
  }

  const settings = await updateDb((db) => {
    if (body.slotIntervalMin !== undefined) {
      const value = Number(body.slotIntervalMin);
      if (isSlotInterval(value)) db.settings.slotIntervalMin = value;
    }
    if (body.openingTime) db.settings.openingTime = body.openingTime;
    if (body.closingTime) db.settings.closingTime = body.closingTime;
    if (Array.isArray(body.workingDays)) {
      db.settings.workingDays = body.workingDays
        .map(Number)
        .filter((day) => day >= 0 && day <= 6)
        .sort((a, b) => a - b);
    }
    if (Number.isFinite(Number(body.bufferMin))) {
      db.settings.bufferMin = Math.max(0, Math.round(Number(body.bufferMin)));
    }

    return db.settings;
  });

  return NextResponse.json({ settings });
}
