import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { SESSION_COOKIE, verifySession } from './session';
import type { SessionPayload } from './types';

/** Sesión actual leída de la cookie (o `null`). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/**
 * Guarda para Route Handlers de administración.
 * Devuelve la sesión o una `NextResponse` 401/403 lista para retornar.
 */
export async function requireAdmin(): Promise<
  { session: SessionPayload } | { response: NextResponse }
> {
  const session = await getSession();

  if (!session) {
    return {
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    };
  }

  if (session.role !== 'admin') {
    return {
      response: NextResponse.json(
        { error: 'Se requieren permisos de administrador' },
        { status: 403 },
      ),
    };
  }

  return { session };
}
