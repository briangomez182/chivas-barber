import { NextResponse } from 'next/server';

import { readDb } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from '@/lib/session';

interface LoginBody {
  email?: string;
  password?: string;
}

/** POST /api/auth/login — credenciales de prueba: `admin` / `admin`. */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Usuario y contraseña son obligatorios' },
      { status: 400 },
    );
  }

  const db = await readDb();
  const user = db.users.find((item) => item.email.toLowerCase() === email);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(
      { error: 'Usuario o contraseña incorrectos' },
      { status: 401 },
    );
  }

  const token = await signSession({
    sub: user.id,
    name: user.name,
    role: user.role,
  });

  const response = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
