import { NextResponse } from 'next/server';

import { getSettings, updateSettings, type SettingsPatch } from '@/lib/db';
import { requireAdmin } from '@/lib/guard';
import { LOYALTY_STAMPS_GOALS, SLOT_INTERVALS, type SlotInterval } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface SettingsBody {
  slotIntervalMin?: number;
  openingTime?: string;
  closingTime?: string;
  workingDays?: number[];
  bufferMin?: number;
  depositAmount?: number;
  depositEnabled?: boolean;
  showPaginationCount?: boolean;
  showOptionalBookingFields?: boolean;
  loyaltyEnabled?: boolean;
  loyaltyStampsGoal?: number;
  ownerWhatsapp?: string | null;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const E164_PATTERN = /^\+\d{8,15}$/;

function isSlotInterval(value: number): value is SlotInterval {
  return (SLOT_INTERVALS as readonly number[]).includes(value);
}

/**
 * GET /api/settings — sólo admin.
 *
 * El objeto `Settings` incluye datos sensibles (`ownerWhatsapp`), así que
 * este endpoint NO es público. El sitio público no lo usa: las páginas del
 * server toman la config directo con `getSettings()`.
 */
export async function GET(): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const settings = await getSettings();
  return NextResponse.json({ settings });
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

  const patch: SettingsPatch = {};

  if (body.slotIntervalMin !== undefined) {
    const value = Number(body.slotIntervalMin);
    if (isSlotInterval(value)) patch.slotIntervalMin = value;
  }
  if (body.openingTime) patch.openingTime = body.openingTime;
  if (body.closingTime) patch.closingTime = body.closingTime;
  if (Array.isArray(body.workingDays)) {
    patch.workingDays = body.workingDays
      .map(Number)
      .filter((day) => day >= 0 && day <= 6)
      .sort((a, b) => a - b);
  }
  if (Number.isFinite(Number(body.bufferMin))) {
    patch.bufferMin = Math.max(0, Math.round(Number(body.bufferMin)));
  }
  if (body.depositAmount !== undefined) {
    const value = Number(body.depositAmount);
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: 'Seña inválida' }, { status: 400 });
    }
    patch.depositAmount = Math.round(value);
  }
  if (body.depositEnabled !== undefined) {
    patch.depositEnabled = Boolean(body.depositEnabled);
  }
  if (body.showPaginationCount !== undefined) {
    patch.showPaginationCount = Boolean(body.showPaginationCount);
  }
  if (body.showOptionalBookingFields !== undefined) {
    patch.showOptionalBookingFields = Boolean(body.showOptionalBookingFields);
  }
  if (body.loyaltyEnabled !== undefined) {
    patch.loyaltyEnabled = Boolean(body.loyaltyEnabled);
  }
  if (body.loyaltyStampsGoal !== undefined) {
    const value = Number(body.loyaltyStampsGoal);
    if (!(LOYALTY_STAMPS_GOALS as readonly number[]).includes(value)) {
      return NextResponse.json(
        { error: 'La cantidad de sellos debe ser 5, 10, 15 o 20' },
        { status: 400 },
      );
    }
    patch.loyaltyStampsGoal = value as (typeof LOYALTY_STAMPS_GOALS)[number];
  }

  if (body.ownerWhatsapp !== undefined) {
    const raw =
      typeof body.ownerWhatsapp === 'string' ? body.ownerWhatsapp.trim() : '';
    if (raw === '') {
      patch.ownerWhatsapp = null;
    } else {
      const digits = raw.replace(/\D/g, '');
      const normalized = `+${digits}`;
      if (!E164_PATTERN.test(normalized)) {
        return NextResponse.json(
          {
            error:
              'El WhatsApp de aviso debe estar en formato internacional, ej. +5491160068637',
          },
          { status: 400 },
        );
      }
      patch.ownerWhatsapp = normalized;
    }
  }

  if (patch.depositEnabled) {
    const amount = patch.depositAmount ?? (await getSettings()).depositAmount;
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Ingresá el valor de la seña para poder habilitarla' },
        { status: 400 },
      );
    }
  }

  const settings = await updateSettings(patch);

  return NextResponse.json({ settings });
}
