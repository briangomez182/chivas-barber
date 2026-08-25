import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Variante para el Edge Runtime (`src/middleware.ts`). Sigue el patrón
 * oficial de `@supabase/ssr`: hay que llamar `getUser()` acá (no alcanza con
 * leer la cookie) para que el SDK refresque el access token si venció, y hay
 * que devolver la `response` que arma este cliente — es la que lleva las
 * cookies actualizadas.
 */
export function createMiddlewareSupabaseClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  return { supabase, getResponse: () => response };
}
