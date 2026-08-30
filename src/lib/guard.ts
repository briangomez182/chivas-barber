import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from './supabase/server';
import type { Session, UserRole } from './types';

interface ProfileRow {
  name: string;
  role: UserRole;
  barber_id: string | null;
}

/**
 * Sesión actual (o `null`), resuelta contra Supabase Auth + `profiles`.
 *
 * `getUser()` (no `getSession()`) porque valida el token contra el servidor
 * de Auth en vez de confiar en lo que diga la cookie. El profile se lee con
 * este mismo cliente (RLS `profiles_self_select`), así que sólo puede leer
 * su propia fila.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, barber_id')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? '',
    name: profile.name,
    role: profile.role,
    barberId: profile.barber_id,
  };
}

/**
 * Guarda genérica para Route Handlers: exige una sesión con uno de los
 * roles permitidos. Devuelve la sesión o una `NextResponse` 401/403 lista
 * para retornar.
 */
export async function requireRole(
  roles: UserRole[],
): Promise<{ session: Session } | { response: NextResponse }> {
  const session = await getSession();

  if (!session) {
    return {
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    };
  }

  if (!roles.includes(session.role)) {
    return {
      response: NextResponse.json(
        { error: 'No tenés permisos para esta acción' },
        { status: 403 },
      ),
    };
  }

  return { session };
}

/** Sólo admin. */
export function requireAdmin(): Promise<
  { session: Session } | { response: NextResponse }
> {
  return requireRole(['admin']);
}

/** Admin o editor — el staff que puede entrar al panel. */
export function requireStaff(): Promise<
  { session: Session } | { response: NextResponse }
> {
  return requireRole(['admin', 'editor']);
}

/**
 * Admin (acceso total) o editor del propio barbero (`barberId`).
 * Devuelve la sesión o una `NextResponse` 401/403.
 */
export async function requireAdminOrEditor(
  barberId: string,
): Promise<{ session: Session } | { response: NextResponse }> {
  const session = await getSession();

  if (!session) {
    return {
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    };
  }

  if (session.role === 'admin') return { session };

  if (session.role === 'editor' && session.barberId === barberId) {
    return { session };
  }

  return {
    response: NextResponse.json(
      { error: 'No tenés permisos para esta acción' },
      { status: 403 },
    ),
  };
}
