import { NextResponse } from 'next/server';

import { deleteBarberPortfolioImage } from '@/lib/db';
import { requireAdminOrEditor } from '@/lib/guard';

export const dynamic = 'force-dynamic';

/** DELETE /api/barbers/[id]/portfolio/[imageId] — admin o editor del barbero. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
): Promise<NextResponse> {
  const { id: barberId, imageId } = await params;

  const guard = await requireAdminOrEditor(barberId);
  if ('response' in guard) return guard.response;

  const deleted = await deleteBarberPortfolioImage(imageId, barberId);

  if (!deleted) {
    return NextResponse.json({ error: 'Imagen no encontrada' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
