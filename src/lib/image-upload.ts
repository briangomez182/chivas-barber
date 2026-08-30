import { NextResponse } from 'next/server';

/**
 * Extrae y valida un archivo de imagen de un `multipart/form-data` —
 * compartido por las rutas de subida de fotos de barbero (perfil y
 * portafolio): mismo campo (`photo`), mismo allowlist de tipo, mismo tope de
 * tamaño. El bucket de Supabase Storage también hace cumplir esto del lado
 * del servidor de Storage; esto es la validación con mensaje legible para
 * el usuario, antes de gastar el viaje de red hacia Storage.
 */

export type AllowedImageType = 'image/png' | 'image/jpeg';

const ALLOWED_IMAGE_TYPES = new Set<AllowedImageType>(['image/png', 'image/jpeg']);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export type ImageFileResult =
  | { error: NextResponse }
  | { file: File; contentType: AllowedImageType };

export async function readImageFile(
  request: Request,
  field = 'photo',
): Promise<ImageFileResult> {
  const formData = await request.formData().catch(() => null);
  const photo = formData?.get(field);

  if (!(photo instanceof File)) {
    return { error: NextResponse.json({ error: 'Falta la foto' }, { status: 400 }) };
  }
  if (!ALLOWED_IMAGE_TYPES.has(photo.type as AllowedImageType)) {
    return {
      error: NextResponse.json(
        { error: 'Sólo se permiten imágenes PNG, JPG o JPEG' },
        { status: 415 },
      ),
    };
  }
  if (photo.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      error: NextResponse.json(
        { error: 'La imagen no puede superar los 5 MB' },
        { status: 413 },
      ),
    };
  }

  return { file: photo, contentType: photo.type as AllowedImageType };
}
