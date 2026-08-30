import { NextResponse } from 'next/server';

import { deleteScheduleBlock } from '@/lib/db';
import { requireStaff } from '@/lib/guard';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/blocks/:id — el barbero "vuelve antes" o el admin desbloquea.
 * Editor borra con su propia sesión: RLS le impide tocar bloqueos de otro
 * barbero (devuelve 404, no 403 — no hace falta distinguir).
 */
export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await requireStaff();
  if ('response' in guard) return guard.response;
  const { session } = guard;

  const { id } = await context.params;

  const removed = await deleteScheduleBlock(
    id,
    session.role === 'editor' ? await createServerSupabaseClient() : undefined,
  );

  if (!removed) {
    return NextResponse.json({ error: 'Bloqueo no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
