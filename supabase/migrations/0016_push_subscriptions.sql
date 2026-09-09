-- ============================================================================
-- Notificaciones push web (PWA) al dueño / staff cuando entra un turno nuevo.
--
-- A diferencia de `notifications` (migración 0015), que es una cola por turno
-- para el aviso de WhatsApp, acá se guarda UNA fila por dispositivo suscrito:
-- el navegador (Chrome de Android, sobre todo) genera un `PushSubscription`
-- con un `endpoint` único y un par de claves (`p256dh` / `auth`), y el server
-- le pega a ese endpoint con las claves VAPID para disparar la notificación.
--
--   - `endpoint`  URL del push service (FCM / Mozilla / etc.). Clave natural:
--                 `on conflict (endpoint) do update` para no duplicar cuando
--                 el mismo equipo se vuelve a suscribir.
--   - `p256dh` / `auth`  claves de cifrado del `PushSubscription`.
--   - Cuando el push service responde 404/410 (suscripción vencida), el
--     server borra la fila — ver `lib/push.ts`.
--
-- El envío es best-effort e inline (lo dispara el webhook de Mercado Pago y
-- `POST /api/book`): no hay reintentos ni cron, un push perdido no se
-- recupera (para eso ya está el aviso de WhatsApp, que sí es una cola).
--
-- Sólo la service_role toca esta tabla (los Route Handlers del server). RLS
-- activo sin policies = nadie más entra, mismo criterio que `rate_limits`
-- (0011) y `notifications` (0015).
--
-- Ejecutar una sola vez, después de 0015. Es idempotente.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  -- User-Agent del navegador que se suscribió, sólo informativo (para
  -- distinguir dispositivos en un futuro panel).
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  last_error      text
);

alter table public.push_subscriptions enable row level security;
