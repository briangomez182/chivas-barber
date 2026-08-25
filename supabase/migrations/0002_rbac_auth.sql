-- ============================================================================
-- RBAC con Supabase Auth real — admin / editor / client
--
-- Reemplaza la autenticación propia (tabla `public.users` + cookie HMAC) por
-- Supabase Auth (`auth.users`). Ejecutar una sola vez, después de
-- `schema.sql`. Es idempotente.
--
-- `public.users` (login propio, scrypt) NO se borra acá: puede tener cuentas
-- reales y su formato de hash no es compatible con Supabase Auth, así que no
-- hay migración automática de contraseñas. Queda obsoleta; borrarla es una
-- decisión manual aparte.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles — 1:1 con auth.users. Acá vive el rol y, para los editores, el
-- barbero al que están vinculados.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  phone      text not null default '',
  role       text not null default 'client' check (role in ('admin', 'editor', 'client')),
  barber_id  uuid references public.barbers (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists profiles_barber_id_idx on public.profiles (barber_id);
create index if not exists profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- Alta automática del profile cuando se crea un auth.users.
--
-- `name`/`phone` salen de `raw_user_meta_data`: eso lo escribe el propio
-- usuario al registrarse (`supabase.auth.signUp({ options: { data } })`) y no
-- es sensible.
--
-- `role`/`barber_id` salen de `raw_app_meta_data`, NO de `raw_user_meta_data`.
-- `app_metadata` sólo se puede setear con el Admin API (`service_role`) — si
-- el rol saliera de `user_meta_data`, cualquiera podría registrarse pidiendo
-- `{ role: 'admin' }` y escalar privilegios. Un registro público (POST
-- /api/auth/register) nunca manda `app_metadata`, así que siempre cae en
-- 'client'. El admin crea editores con `auth.admin.createUser({ app_metadata })`.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone, role, barber_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_app_meta_data ->> 'role', 'client'),
    nullif(new.raw_app_meta_data ->> 'barber_id', '')::uuid
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS — profiles
--
-- Sólo lectura del propio perfil (lo usa `getSession()` para resolver rol y
-- barbero). Sin policy de update: así ningún usuario puede auto-asignarse un
-- rol distinto. El panel de admin gestiona profiles con el cliente
-- `service_role` (saltea RLS), gateado por `requireAdmin` en la ruta.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- RLS — appointments
--
-- Hasta acá la tabla tenía RLS habilitado sin policies (sólo accesible con
-- service_role). Ahora sí se enforce por rol, porque el panel de editor
-- consulta/actualiza turnos con la sesión real del usuario (no con
-- service_role) para que el aislamiento por barbero lo garantice Postgres,
-- no sólo el código de la ruta.
--
-- `barber_id` vive en `appointments`, no en `auth.users` — por eso las
-- policies de editor resuelven el barbero propio vía `profiles.barber_id`,
-- no comparan `barber_id = auth.uid()` directamente.
-- ---------------------------------------------------------------------------
drop policy if exists appointments_admin_all on public.appointments;
create policy appointments_admin_all on public.appointments
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists appointments_editor_select on public.appointments;
create policy appointments_editor_select on public.appointments
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'editor'
        and p.barber_id = appointments.barber_id
    )
  );

drop policy if exists appointments_editor_update on public.appointments;
create policy appointments_editor_update on public.appointments
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'editor'
        and p.barber_id = appointments.barber_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'editor'
        and p.barber_id = appointments.barber_id
    )
  );

drop policy if exists appointments_editor_insert on public.appointments;
create policy appointments_editor_insert on public.appointments
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'editor'
        and p.barber_id = appointments.barber_id
    )
  );

-- El booking público (visitante anónimo, sin sesión) sigue pasando por
-- `book_appointment` con service_role, que saltea RLS — no depende de esta
-- policy. Esta es para el caso de un `client` autenticado reservando por su
-- cuenta directamente contra la tabla.
drop policy if exists appointments_client_insert on public.appointments;
create policy appointments_client_insert on public.appointments
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'client'
    )
  );

-- ---------------------------------------------------------------------------
-- book_appointment — agrega chequeo de autorización.
--
-- Sigue siendo `security definer` (saltea RLS adentro), así que la
-- autorización ahora se hace a mano en el cuerpo de la función. Sólo se
-- exige cuando `auth.uid()` no es null: si es null, quien llama es
-- `service_role` (booking público anónimo, o el panel admin) — igual de
-- confiable que antes. Si no es null, es un usuario autenticado llamando con
-- su propia sesión (p.ej. el editor dando de alta un turno manual): tiene
-- que ser admin, o editor dueño de `p_barber_id`.
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
  v_role   text;
  v_barber uuid;
begin
  if auth.uid() is not null then
    select role, barber_id into v_role, v_barber
    from public.profiles where id = auth.uid();

    if v_role is null then
      raise exception 'FORBIDDEN';
    end if;

    if v_role = 'editor' then
      if v_barber is null or v_barber <> p_barber_id then
        raise exception 'FORBIDDEN';
      end if;
    elsif v_role <> 'admin' then
      raise exception 'FORBIDDEN';
    end if;
  end if;

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

revoke all on function public.book_appointment(uuid, uuid, text, text, integer, text, text, text, text) from public;
grant execute on function public.book_appointment(uuid, uuid, text, text, integer, text, text, text, text) to service_role;
grant execute on function public.book_appointment(uuid, uuid, text, text, integer, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- reschedule_appointment — igual patrón que book_appointment (advisory lock
-- + chequeo de solapamiento) pero para UPDATE. La usan tanto el admin
-- (reasignar barbero/horario de cualquier turno) como el editor (reagendar un
-- turno propio) — la autorización es el mismo bloque condicional de arriba.
-- ---------------------------------------------------------------------------
create or replace function public.reschedule_appointment(
  p_id           uuid,
  p_barber_id    uuid,
  p_service_id   uuid,
  p_date         text,
  p_time         text,
  p_duration_min integer
)
returns setof public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buffer   integer;
  v_start    integer;
  v_end      integer;
  v_row      public.appointments;
  v_role     text;
  v_barber   uuid;
  v_current  public.appointments;
begin
  select * into v_current from public.appointments where id = p_id;
  if v_current.id is null then
    raise exception 'NOT_FOUND';
  end if;

  if auth.uid() is not null then
    select role, barber_id into v_role, v_barber
    from public.profiles where id = auth.uid();

    if v_role is null then
      raise exception 'FORBIDDEN';
    end if;

    if v_role = 'editor' then
      -- Tiene que ser dueño tanto del barbero actual del turno como del
      -- barbero destino: no puede tocar turnos ajenos ni reasignarlos a otro.
      if v_barber is null or v_barber <> v_current.barber_id or v_barber <> p_barber_id then
        raise exception 'FORBIDDEN';
      end if;
    elsif v_role <> 'admin' then
      raise exception 'FORBIDDEN';
    end if;
  end if;

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
      and a.id       <> p_id
      and a.status   <> 'cancelled'
      and v_start < (split_part(a.time, ':', 1)::integer * 60
                     + split_part(a.time, ':', 2)::integer) + a.duration_min + v_buffer
      and v_end   > (split_part(a.time, ':', 1)::integer * 60
                     + split_part(a.time, ':', 2)::integer)
  ) then
    raise exception 'SLOT_TAKEN';
  end if;

  update public.appointments
  set barber_id    = p_barber_id,
      service_id   = p_service_id,
      date         = p_date,
      time         = p_time,
      duration_min = p_duration_min
  where id = p_id
  returning * into v_row;

  return next v_row;
  return;
end;
$$;

revoke all on function public.reschedule_appointment(uuid, uuid, uuid, text, text, integer) from public;
grant execute on function public.reschedule_appointment(uuid, uuid, uuid, text, text, integer) to service_role;
grant execute on function public.reschedule_appointment(uuid, uuid, uuid, text, text, integer) to authenticated;
