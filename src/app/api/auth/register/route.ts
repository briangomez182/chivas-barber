import { NextResponse } from 'next/server';

import { createId, updateDb } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from '@/lib/session';
import type { User } from '@/lib/types';

interface RegisterBody {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
}

/** POST /api/auth/register — alta de clientes. */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as RegisterBody;

  const name = body.name?.trim() ?? '';
  const email = body.email?.trim().toLowerCase() ?? '';
  const phone = body.phone?.trim() ?? '';
  const password = body.password ?? '';

  if (name.length < 2) {
    return NextResponse.json({ error: 'Ingresá tu nombre' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 6 caracteres' },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(password);

  const result = await updateDb((db) => {
    const exists = db.users.some((item) => item.email.toLowerCase() === email);
    if (exists) return { error: 'Ya existe una cuenta con ese email' } as const;

    const user: User = {
      id: createId(),
      name,
      email,
      phone,
      passwordHash,
      role: 'client',
      createdAt: new Date().toISOString(),
    };

    db.users.push(user);
    return { user } as const;
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const token = await signSession({
    sub: result.user.id,
    name: result.user.name,
    role: result.user.role,
  });

  const response = NextResponse.json(
    {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
    },
    { status: 201 },
  );

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
