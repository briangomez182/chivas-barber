/**
 * URL pública del sitio, sin barra final (`https://chivasbarberiaclub.com`).
 *
 * Sale de `BASE_URL` (la misma env que usa Mercado Pago para armar sus
 * `back_urls`). Sólo servidor — se usa para construir el `redirectTo` de los
 * mails de Supabase Auth, que tiene que ser una URL absoluta y estar en la
 * lista de "Redirect URLs" permitidas del proyecto.
 */
export function siteUrl(): string {
  const configured = process.env.BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return 'http://localhost:3000';
}
