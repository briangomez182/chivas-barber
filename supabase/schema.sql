-- ============================================================================
-- Chivas Barbería Club — esquema Postgres (Supabase)
--
-- Ejecutar una sola vez en el SQL Editor del proyecto de Supabase.
-- Es idempotente: se puede volver a correr sin romper nada.
--
-- Los datos iniciales NO están acá: se cargan con `npm run db:seed`, que
-- hashea las contraseñas con scrypt desde Node (ver scripts/seed.mjs).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- settings — fila única (id fijo en `true`) con los parámetros de la agenda
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  id                boolean primary key default true check (id),
  slot_interval_min integer not null default 30 check (slot_interval_min in (15, 30, 45, 60)),
  opening_time      text    not null default '10:00' check (opening_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  closing_time      text    not null default '20:00' check (closing_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  working_days      integer[] not null default '{1,2,3,4,5,6}',
  buffer_min        integer not null default 0 check (buffer_min >= 0)
);

-- Garantiza que la fila exista siempre.
insert into public.settings (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- barbers
-- ---------------------------------------------------------------------------
create table if not exists public.barbers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) >= 2),
  role       text not null default 'Barber',
  specialty  text not null default '',
  photo_url  text not null default '',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists barbers_active_idx on public.barbers (active);

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
create table if not exists public.services (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) >= 2),
  description  text not null default '',
  duration_min integer not null check (duration_min >= 5),
  price        integer not null check (price >= 0),
  featured     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- appointments
--
-- `date` y `time` se guardan como texto (`YYYY-MM-DD` / `HH:mm`) a propósito:
-- la agenda es horario local de la barbería, no un instante UTC. Usar `date`/
-- `timestamptz` introduciría conversiones de zona horaria que no queremos.
-- ---------------------------------------------------------------------------
create table if not exists public.appointments (
  id             uuid primary key default gen_random_uuid(),
  barber_id      uuid not null references public.barbers (id) on delete cascade,
  service_id     uuid references public.services (id) on delete set null,
  date           text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  time           text not null check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duration_min   integer not null check (duration_min > 0),
  customer_name  text not null,
  customer_phone text not null,
  customer_email text,
  notes          text,
  status         text not null default 'confirmed'
                 check (status in ('pending', 'confirmed', 'cancelled', 'done')),
  created_at     timestamptz not null default now()
);

create index if not exists appointments_date_idx on public.appointments (date);
create index if not exists appointments_barber_date_idx on public.appointments (barber_id, date);

-- ---------------------------------------------------------------------------
-- users — autenticación propia (scrypt + cookie HMAC), no Supabase Auth
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null,
  phone         text not null default '',
  password_hash text not null,
  role          text not null default 'client' check (role in ('admin', 'client')),
  created_at    timestamptz not null default now(),
  -- Columna generada: el login busca por acá con igualdad exacta. Filtrar con
  -- `ilike` sería un error — trata `%` y `_` como comodines y un email como
  -- "%" haría match con cualquier cuenta.
  email_lower   text generated always as (lower(email)) stored
);

-- Único sobre el email normalizado: dos registros simultáneos con el mismo
-- email no pueden colarse por una carrera.
create unique index if not exists users_email_lower_idx on public.users (email_lower);

-- ---------------------------------------------------------------------------
-- book_appointment — reserva atómica
--
-- El chequeo de solapamiento y el INSERT tienen que ocurrir sin que otra
-- request se meta en el medio, o dos personas reservan el mismo hueco. El
-- advisory lock por (barbero, día) serializa sólo esa combinación: reservas
-- de otros barberos o de otros días siguen corriendo en paralelo.
--
-- Replica la lógica de `hasConflict` en src/lib/slots.ts.
-- Lanza SLOT_TAKEN si el horario ya está ocupado.
-- ---------------------------------------------------------------------------
create or replace function public.book_appointment(
  p_barber_id      uuid,
  p_service_id     uuid,
  p_date           text,
  p_time           text,
  p_duration_min   integer,
  p_customer_name  text,
  p_customer_phone text,
  p_customer_email text,
  p_notes          text
)
returns setof public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buffer integer;
  v_start  integer;
  v_end    integer;
  v_row    public.appointments;
begin
  perform pg_advisory_xact_lock(hashtext(p_barber_id::text || '|' || p_date));

  select buffer_min into v_buffer from public.settings limit 1;
  v_buffer := coalesce(v_buffer, 0);

  v_start := split_part(p_time, ':', 1)::integer * 60 + split_part(p_time, ':', 2)::integer;
  v_end   := v_start + p_duration_min + v_buffer;

  if exists (
    select 1
    from public.appointments a
    where a.barber_id = p_barber_id
      and a.date      = p_date
      and a.status   <> 'cancelled'
      and v_start < (split_part(a.time, ':', 1)::integer * 60
                     + split_part(a.time, ':', 2)::integer) + a.duration_min + v_buffer
      and v_end   > (split_part(a.time, ':', 1)::integer * 60
                     + split_part(a.time, ':', 2)::integer)
  ) then
    raise exception 'SLOT_TAKEN';
  end if;

  insert into public.appointments (
    barber_id, service_id, date, time, duration_min,
    customer_name, customer_phone, customer_email, notes, status
  )
  values (
    p_barber_id, p_service_id, p_date, p_time, p_duration_min,
    p_customer_name, p_customer_phone, p_customer_email, p_notes, 'confirmed'
  )
  returning * into v_row;

  return next v_row;
  return;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Se habilita en todas las tablas y NO se define ninguna policy: eso deja las
-- claves públicas (`anon` / `authenticated`) sin acceso a nada. La app entra
-- únicamente con la service_role key desde los Route Handlers, que salta RLS.
-- Si alguna vez se expone el cliente al navegador, hay que escribir policies.
-- ---------------------------------------------------------------------------
alter table public.settings     enable row level security;
alter table public.barbers      enable row level security;
alter table public.services     enable row level security;
alter table public.appointments enable row level security;
alter table public.users        enable row level security;

-- `security definer`: la función corre como su dueño y saltea RLS, así que el
-- acceso se restringe a mano. Ojo: revocar de PUBLIC se lo saca también a
-- service_role, que hereda de PUBLIC — por eso el grant explícito después.
revoke all on function public.book_appointment(uuid, uuid, text, text, integer, text, text, text, text) from public;
grant execute on function public.book_appointment(uuid, uuid, text, text, integer, text, text, text, text) to service_role;
