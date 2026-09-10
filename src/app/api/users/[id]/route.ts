import { NextResponse } from 'next/server';

import {
  deleteStaffUser,
  resetStaffPassword,
  updateProfile,
  updateStaffEmail,
} from '@/lib/db';
import { requireAdmin } from '@/lib/guard';
import { STAFF_PASSWORD_RULES, validatePassword } from '@/lib/password';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface StaffPatch {
  name?: string;
  phone?: string;
  role?: string;
  barberId?: string | null;
  password?: string;
  email?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PATCH /api/users/:id — edita rol/barbero/nombre/teléfono, cambia el email
 * de acceso y/o resetea la contraseña (admin). `email` y `password` son
 * opcionales: si no vienen, no se tocan.
 */
export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as StaffPatch;

  if (body.role !== undefined && body.role !== 'admin' && body.role !== 'editor') {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
  }
  if (body.role === 'editor' && !body.barberId) {
    return NextResponse.json(
      { error: 'Elegí el barbero al que se vincula el editor' },
      { status: 400 },
    );
  }
  if (body.password !== undefined) {
    const passwordError = validatePassword(body.password, STAFF_PASSWORD_RULES);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }
  }

  const email = body.email?.trim().toLowerCase();
  if (email !== undefined && !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }

  if (body.password) {
    const reset = await resetStaffPassword(id, body.password);
    if (!reset) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
  }

  if (email) {
    const result = await updateStaffEmail(id, email);
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Ya existe una cuenta con ese email' },
        { status: 409 },
      );
    }
  }

  const user = await updateProfile(id, {
    name: body.name?.trim(),
    phone: body.phone?.trim(),
    role: body.role as 'admin' | 'editor' | undefined,
    barberId: body.barberId,
  });

  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ user });
}

/** DELETE /api/users/:id — baja de admin/editor (admin). */
export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const { id } = await context.params;

  if (id === guard.session.id) {
    return NextResponse.json(
      { error: 'No podés eliminar tu propia cuenta' },
      { status: 400 },
    );
  }

  const removed = await deleteStaffUser(id);

  if (!removed) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
