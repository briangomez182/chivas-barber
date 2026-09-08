import { NextResponse, type NextRequest } from 'next/server';

import { createMiddlewareSupabaseClient } from '@/lib/supabase/middleware';

/**
 * Protege `/admin`. Corre en el Edge Runtime.
 *
 * `admin`: acceso total. `editor`: confinado a sus vistas
 * (`/admin/mis-turnos` y `/admin/turnero`) — no puede tocar
 * barberos/servicios/configuración ni turnos de otros barberos, también lo
 * enforce RLS, esto es sólo la primera barrera de UX. Sin sesión o rol
 * `client`: afuera.
 */
const EDITOR_ALLOWED_PATHS = new Set(['/admin/mis-turnos', '/admin/turnero']);
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { supabase, getResponse } = createMiddlewareSupabaseClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectToLogin = (): NextResponse => {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  };

  if (!user) return redirectToLogin();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'editor')) {
    return redirectToLogin();
  }

  if (
    profile.role === 'editor' &&
    !EDITOR_ALLOWED_PATHS.has(request.nextUrl.pathname)
  ) {
    return NextResponse.redirect(new URL('/admin/mis-turnos', request.url));
  }

  return getResponse();
}

export const config = {
  matcher: ['/admin/:path*'],
};
