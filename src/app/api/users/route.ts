import { NextResponse } from 'next/server';

import { createStaffUser, listStaffProfiles } from '@/lib/db';
import { requireAdmin } from '@/lib/guard';

export const dynamic = 'force-dynamic';

interface StaffBody {
  email?: string;
  password?: string;
  name?: string;
  phone?: string;
  role?: string;
  barberId?: string | null;
}

/** GET /api/users — staff (admins y editores), admin. */
export async function GET(): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const users = await listStaffProfiles();
  return NextResponse.json({ users });
}

/** POST /api/users — alta de admin/editor (admin). */
export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireAdmin();
  if ('response' in guard) return guard.response;

  const body = (await request.json().catch(() => ({}))) as StaffBody;

  const email = body.email?.trim().toLowerCase() ?? '';
  const name = body.name?.trim() ?? '';
  const password = body.password ?? '';
  const role = body.role;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }
  if (name.length < 2) {
    return NextResponse.json({ error: 'Ingresá un nombre' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 6 caracteres' },
      { status: 400 },
    );
  }
  if (role !== 'admin' && role !== 'editor') {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
  }
  if (role === 'editor' && !body.barberId) {
    return NextResponse.json(
      { error: 'Elegí el barbero al que se vincula el editor' },
      { status: 400 },
    );
  }

  const result = await createStaffUser({
    email,
    password,
    name,
    phone: body.phone?.trim() ?? '',
    role,
    barberId: role === 'editor' ? (body.barberId ?? null) : null,
  });

  if ('error' in result) {
    return NextResponse.json(
      { error: 'Ya existe una cuenta con ese email' },
      { status: 409 },
    );
  }

  return NextResponse.json({ user: result.profile }, { status: 201 });
}
