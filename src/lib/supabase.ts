import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase para uso EXCLUSIVO en el servidor.
 *
 * Usa la `service_role` key, que saltea Row Level Security. Todas las tablas
 * tienen RLS activo y sin policies (ver supabase/schema.sql), así que este es
 * el único camino de acceso a los datos — y por eso la key no puede filtrarse
 * al navegador bajo ninguna circunstancia.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    'lib/supabase.ts sólo puede importarse desde el servidor: expone la service_role key.',
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
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      required('SUPABASE_URL'),
      required('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return client;
}
