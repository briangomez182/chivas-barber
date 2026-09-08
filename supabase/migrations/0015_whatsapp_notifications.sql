-- ============================================================================
-- Notificación de WhatsApp al dueño cuando un cliente paga la seña de un turno.
--
-- 1. `settings.owner_whatsapp` — teléfono del dueño en formato internacional
--    (ej. `+5491160068637`) que recibe el aviso. `null` = la notificación
--    queda desactivada (es el valor por defecto: no cambia nada al aplicar
--    esta migración).
--
-- 2. `public.notifications` — cola de salida (patrón outbox). El webhook de
--    Mercado Pago (`/api/mercado-pago/webhook`) inserta una fila cuando un
--    pago queda `approved`; el envío se intenta en el acto y, si falla, el
--    cron `/api/notifications/dispatch` reintenta con backoff exponencial
--    (hasta 5 intentos, después la fila queda `failed`).
--
--    El `unique (appointment_id, kind)` es la clave de idempotencia: Mercado
--    Pago reenvía la misma notificación varias veces, y el
--    `insert ... on conflict do nothing` hace que sólo se cree una fila —
--    así el dueño recibe un único mensaje por turno.
--
-- Sólo la service_role toca esta tabla (los Route Handlers del server). RLS
-- activo sin policies = nadie más entra, mismo criterio que `rate_limits`
-- (migración 0011).
--
-- Ejecutar una sola vez, después de 0014. Es idempotente.
-- ============================================================================

alter table public.settings
  add column if not exists owner_whatsapp text;

create table if not exists public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  appointment_id      uuid not null references public.appointments (id) on delete cascade,
  -- Tipo de aviso. Por ahora sólo `deposit_paid`; queda como texto para
  -- sumar `payment_failed`, `reminder`, etc. sin otra migración.
  kind                text not null,
  channel             text not null default 'whatsapp',
  -- Destinatario al momento de encolar (se congela acá por si después
  -- cambia `settings.owner_whatsapp`).
  recipient           text not null,
  status              text not null default 'pending'
                        check (status in ('pending', 'sent', 'failed')),
  attempts            integer not null default 0,
  last_error          text,
  -- Snapshot de los datos del mensaje (incluye `bodyParams`, los parámetros
  -- posicionales de la plantilla) — así un reintent no depende de volver a
  -- leer el turno / barbero / servicio.
  payload             jsonb,
  -- `id` (wamid...) que devuelve la Cloud API de Meta cuando el envío sale bien.
  provider_message_id text,
  -- Cuándo puede volver a intentarse (backoff). `null` = ya, sin espera.
  next_retry_at       timestamptz,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz,
  unique (appointment_id, kind)
);

-- El cron sólo mira las pendientes: índice parcial para que el barrido no
-- toque las ya enviadas / fallidas.
create index if not exists notifications_pending_idx
  on public.notifications (created_at)
  where status = 'pending';

alter table public.notifications enable row level security;
