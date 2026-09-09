-- ============================================================================
-- Agenda por barbero.
--
-- Hasta ahora la agenda (apertura, cierre, días laborables, intervalo entre
-- bloques y descanso) era global, una fila en `public.settings`, editable en
-- la pestaña "Agenda" del panel. Ahora cada barbero tiene la suya: abre y
-- cierra a su hora, trabaja los días que quiere y genera bloques en su
-- propio intervalo, ajustado a la duración de sus servicios.
--
-- 1. Se agregan a `public.barbers` las 5 columnas de agenda, con los mismos
--    defaults que tenía `settings` (10:00–20:00, Lun–Sáb, 30 min, 0).
-- 2. Se copia la agenda global actual a cada barbero existente, así nada
--    cambia de comportamiento hasta que el admin toque la ficha de alguno.
-- 3. `book_appointment`, `book_appointment_pending` y `reschedule_appointment`
--    pasan a leer `buffer_min` del barbero (antes de `settings`). Es el único
--    cambio en esas funciones: el resto del cuerpo es idéntico a 0004.
--
-- Las columnas de agenda en `public.settings` quedan (sin pantalla que las
-- edite) sólo como valor por defecto para cuando no hay un barbero en
-- contexto (p. ej. `/api/availability` sin `barberId`).
--
-- Ejecutar una sola vez, después de 0017. Es idempotente.
-- ============================================================================

alter table public.barbers
  add column if not exists opening_time text not null default '10:00'
    check (opening_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column if not exists closing_time text not null default '20:00'
    check (closing_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column if not exists working_days integer[] not null default '{1,2,3,4,5,6}',
  add column if not exists slot_interval_min integer not null default 30
    check (slot_interval_min in (15, 30, 45, 60)),
  add column if not exists buffer_min integer not null default 0
    check (buffer_min >= 0);

-- Copia única de la agenda global a los barberos que todavía tienen los
-- defaults recién agregados. Se salta si ya se corrió (algún barbero con
-- agenda distinta del default → asumimos migrado).
update public.barbers b
set opening_time      = s.opening_time,
    closing_time      = s.closing_time,
    working_days      = s.working_days,
    slot_interval_min = s.slot_interval_min,
    buffer_min        = s.buffer_min
from public.settings s
where b.opening_time = '10:00'
  and b.closing_time = '20:00'
  and b.working_days = '{1,2,3,4,5,6}'
  and b.slot_interval_min = 30
  and b.buffer_min = 0;

-- ---------------------------------------------------------------------------
-- book_appointment — idéntica a 0004, sólo el buffer sale del barbero.
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

  select buffer_min into v_buffer from public.barbers where id = p_barber_id;
  v_buffer := coalesce(v_buffer, 0);

  v_start := split_part(p_time, ':', 1)::integer * 60 + split_part(p_time, ':', 2)::integer;
  v_end   := v_start + p_duration_min + v_buffer;

  if exists (
    select 1
    from public.appointments a
    where a.barber_id = p_barber_id
      and a.date      = p_date
      and a.status   <> 'cancelled'
      and (a.status <> 'pending_payment' or a.created_at > now() - interval '15 minutes')
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
-- reschedule_appointment — idéntica a 0004, sólo el buffer sale del barbero.
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
      if v_barber is null or v_barber <> v_current.barber_id or v_barber <> p_barber_id then
        raise exception 'FORBIDDEN';
      end if;
    elsif v_role <> 'admin' then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_barber_id::text || '|' || p_date));

  select buffer_min into v_buffer from public.barbers where id = p_barber_id;
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
      and (a.status <> 'pending_payment' or a.created_at > now() - interval '15 minutes')
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

-- ---------------------------------------------------------------------------
-- book_appointment_pending — idéntica a 0004, sólo el buffer sale del barbero.
-- ---------------------------------------------------------------------------
create or replace function public.book_appointment_pending(
  p_barber_id      uuid,
  p_service_id     uuid,
  p_date           text,
  p_time           text,
  p_duration_min   integer,
  p_customer_name  text,
  p_customer_phone text,
  p_customer_email text,
  p_notes          text,
  p_amount         integer
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

  select buffer_min into v_buffer from public.barbers where id = p_barber_id;
  v_buffer := coalesce(v_buffer, 0);

  v_start := split_part(p_time, ':', 1)::integer * 60 + split_part(p_time, ':', 2)::integer;
  v_end   := v_start + p_duration_min + v_buffer;

  if exists (
    select 1
    from public.appointments a
    where a.barber_id = p_barber_id
      and a.date      = p_date
      and a.status   <> 'cancelled'
      and (a.status <> 'pending_payment' or a.created_at > now() - interval '15 minutes')
      and v_start < (split_part(a.time, ':', 1)::integer * 60
                     + split_part(a.time, ':', 2)::integer) + a.duration_min + v_buffer
      and v_end   > (split_part(a.time, ':', 1)::integer * 60
                     + split_part(a.time, ':', 2)::integer)
  ) then
    raise exception 'SLOT_TAKEN';
  end if;

  insert into public.appointments (
    barber_id, service_id, date, time, duration_min,
    customer_name, customer_phone, customer_email, notes, status, amount
  )
  values (
    p_barber_id, p_service_id, p_date, p_time, p_duration_min,
    p_customer_name, p_customer_phone, p_customer_email, p_notes, 'pending_payment', p_amount
  )
  returning * into v_row;

  return next v_row;
  return;
end;
$$;

revoke all on function public.book_appointment_pending(uuid, uuid, text, text, integer, text, text, text, text, integer) from public;
grant execute on function public.book_appointment_pending(uuid, uuid, text, text, integer, text, text, text, text, integer) to service_role;
