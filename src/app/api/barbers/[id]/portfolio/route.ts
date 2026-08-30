import { NextResponse } from 'next/server';

import {
  addBarberPortfolioImage,
  listBarberPortfolioImages,
} from '@/lib/db';
import { requireAdmin, requireAdminOrEditor } from '@/lib/guard';

export const dynamic = 'force-dynamic';

/** GET /api/barbers/[id]/portfolio — público. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const images = await listBarberPortfolioImages(id);
  return NextResponse.json({ images });
}

/** POST /api/barbers/[id]/portfolio — admin o editor del barbero. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: barberId } = await params;

  // Sólo admin puede agregar a cualquier barbero; editor sólo al suyo.
  const guard = await requireAdminOrEditor(barberId);
  if ('response' in guard) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { imageUrl?: string };
  const imageUrl = body.imageUrl?.trim() ?? '';

  if (!imageUrl || !imageUrl.startsWith('http')) {
    return NextResponse.json(
      { error: 'URL de imagen inválida' },
      { status: 400 },
    );
  }

  const result = await addBarberPortfolioImage(barberId, imageUrl);

  if ('error' in result) {
    return NextResponse.json(
      { error: 'Ya alcanzaste el máximo de 5 imágenes' },
      { status: 422 },
    );
  }

  return NextResponse.json({ image: result }, { status: 201 });
}
