import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase "como el usuario logueado": lee/escribe la sesión desde
 * las cookies de la request y respeta Row Level Security. Se usa en Server
 * Components, Route Handlers y Server Actions — y es el que hace que las
 * policies de `appointments` (ver supabase/migrations/0002_rbac_auth.sql)
 * realmente se apliquen para un editor, en vez de sólo confiar en el chequeo
 * de la ruta.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `setAll` desde un Server Component (no un Route Handler ni una
            // Server Action) no puede escribir cookies — el middleware ya se
            // encarga de refrescar la sesión en ese caso.
          }
        },
      },
    },
  );
}
