'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase para componentes cliente (navegador). Usa la anon key
 * y respeta Row Level Security, igual que `createServerSupabaseClient` en el
 * servidor.
 *
 * Hoy sólo lo usa el flujo de recuperación de contraseña: la pantalla
 * `/recuperar/nueva` necesita leer del hash de la URL la sesión temporal de
 * tipo `recovery` que arma Supabase Auth y llamar a `updateUser({ password })`
 * desde el navegador. El resto de la app entra por Route Handlers con el
 * cliente de servidor.
 */
let client: SupabaseClient | null = null;

export function createBrowserSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}
