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
 * desde el navegador.
 *
 * `flowType: 'implicit'` a propósito: el mail de recuperación se dispara desde
 * el servidor (`/api/auth/forgot-password`), así que no hay un code verifier
 * de PKCE guardado en este navegador. Con el flujo implícito el link trae los
 * tokens en el hash (`#access_token…&type=recovery`) y `detectSessionInUrl`
 * los canjea solo, sin verifier.
 */
let client: SupabaseClient | null = null;

export function createBrowserSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: 'implicit',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      },
    );
  }
  return client;
}
