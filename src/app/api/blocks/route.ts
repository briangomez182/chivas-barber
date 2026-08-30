import { NextResponse } from 'next/server';

import { createScheduleBlock, listScheduleBlocks } from '@/lib/db';
import { requireStaff } from '@/lib/guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface BlockBody {
  barberId?: string;
  date?: string;
  /** Ambos `null`/ausentes = bloquea el día completo. */
  startTime?: string | null;
  endTime?: string | null;
  reason?: string;
}

/**
 * GET /api/blocks — staff. `?date=` filtra por día, `?barberId=` por
 * barbero (admin). Un editor ignora `barberId`: siempre ve sólo el propio.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const guard = await requireStaff();
  if ('response' in guard) return guard.response;
  const { session } = guard;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (session.role === 'editor') {
    const supabase = await createServerSupabaseClient();
    const blocks = await listScheduleBlocks(
      { ...(date ? { date } : {}), barberId: session.barberId ?? undefined },
      supabase,
    );
    return NextResponse.json({ blocks });
  }

  const barberId = searchParams.get('barberId');
  const blocks = await listScheduleBlocks({
    ...(date ? { date } : {}),
    ...(barberId ? { barberId } : {}),
  });

  return NextResponse.json({ blocks });
}

/**
 * POST /api/blocks — bloquea un tramo (o el día completo) de la agenda de un
 * barbero. Editor: siempre sobre su propio barbero (RLS lo reafirma). Admin:
 * cualquier barbero, tiene que mandar `barberId`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireStaff();
  if ('response' in guard) return guard.response;
  const { session } = guard;

  const body = (await request.json().catch(() => ({}))) as BlockBody;

  const isEditor = session.role === 'editor';
  const barberId = isEditor ? (session.barberId ?? '') : (body.barberId?.trim() ?? '');
  const date = body.date?.trim() ?? '';
  const reason = body.reason?.trim() ?? '';

  if (!barberId) {
    return NextResponse.json({ error: 'Elegí un barbero' }, { status: 400 });
  }
  if (!DATE_PATTERN.test(date)) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: 'Ingresá el motivo del bloqueo' }, { status: 400 });
  }

  const startTime = body.startTime?.trim() || null;
  const endTime = body.endTime?.trim() || null;

  if ((startTime === null) !== (endTime === null)) {
    return NextResponse.json(
      { error: 'Completá hora de inicio y fin, o dejá ambas vacías para bloquear el día' },
      { status: 400 },
    );
  }
  if (startTime !== null && endTime !== null) {
    if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
      return NextResponse.json({ error: 'Horario inválido' }, { status: 400 });
    }
    if (startTime >= endTime) {
      return NextResponse.json(
        { error: 'La hora de inicio tiene que ser anterior a la de fin' },
        { status: 400 },
      );
    }
  }

  const block = await createScheduleBlock(
    {
      barberId,
      date,
      startTime,
      endTime,
      reason,
    },
    isEditor ? await createServerSupabaseClient() : undefined,
  );

  return NextResponse.json({ block }, { status: 201 });
}
