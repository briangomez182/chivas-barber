import { NextResponse } from 'next/server';

import { uploadBarberPhoto } from '@/lib/db';
import { requireAdmin } from '@/lib/guard';
import { readImageFile } from '@/lib/image-upload';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/barbers/:id/photo — sube la foto de perfil de un barbero
 * (admin). `multipart/form-data` con un campo `photo`. Sólo PNG/JPG/JPEG,
 * hasta 5 MB.
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const { id } = await context.params;

  const result = await readImageFile(request);
  if ('error' in result) return result.error;
  const { file, contentType } = result;

  const buffer = Buffer.from(await file.arrayBuffer());
  const barber = await uploadBarberPhoto(id, buffer, contentType);

  if (!barber) {
    return NextResponse.json({ error: 'Barbero no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ barber });
}
