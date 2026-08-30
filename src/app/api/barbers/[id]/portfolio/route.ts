import { NextResponse } from 'next/server';

import { listBarberPortfolioImages, uploadBarberPortfolioPhoto } from '@/lib/db';
import { requireAdminOrEditor } from '@/lib/guard';
import { readImageFile } from '@/lib/image-upload';

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

/**
 * POST /api/barbers/[id]/portfolio — admin o editor del barbero.
 * `multipart/form-data` con un campo `photo`. Sólo PNG/JPG/JPEG, hasta 5 MB.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: barberId } = await params;

  // Sólo admin puede agregar a cualquier barbero; editor sólo al suyo.
  const guard = await requireAdminOrEditor(barberId);
  if ('response' in guard) return guard.response;

  const result = await readImageFile(request);
  if ('error' in result) return result.error;
  const { file, contentType } = result;

  const buffer = Buffer.from(await file.arrayBuffer());
  const image = await uploadBarberPortfolioPhoto(barberId, buffer, contentType);

  if ('error' in image) {
    return NextResponse.json(
      { error: 'Ya alcanzaste el máximo de 5 imágenes' },
      { status: 422 },
    );
  }

  return NextResponse.json({ image }, { status: 201 });
}
