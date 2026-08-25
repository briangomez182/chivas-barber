import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase para uso EXCLUSIVO en el servidor.
 *
 * Usa la `service_role` key, que saltea Row Level Security y el Admin API de
 * Auth (crear/editar usuarios, setear `app_metadata`). Se usa para todo lo
 * que necesita ver/modificar más allá de lo que le permitiría su propia
 * sesión a un usuario: el panel de admin, y el booking público anónimo (que
 * no tiene sesión). Por eso la key no puede filtrarse al navegador bajo
 * ninguna circunstancia.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    'lib/supabase/admin.ts sólo puede importarse desde el servidor: expone la service_role key.',
  );
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copiá .env.example a .env.local y completala con los datos de tu proyecto de Supabase.`,
    );
  }
  return value;
}

let client: SupabaseClient | null = null;

/**
 * Se crea de forma perezosa para que un build sin variables de entorno no
 * explote al importar el módulo: sólo falla cuando alguien pide datos.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(
      required('NEXT_PUBLIC_SUPABASE_URL'),
      required('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return client;
}
