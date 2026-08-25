-- ============================================================================
-- Cobro de turnos con Mercado Pago (Checkout Pro)
--
-- 1. Agrega a `appointments` las columnas necesarias para trackear el pago.
-- 2. Suma 'pending_payment' como estado válido: el turno se crea en ese
--    estado al iniciar el checkout, y sólo pasa a 'confirmed' cuando el
--    webhook de Mercado Pago confirma el pago aprobado.
-- 3. `book_appointment` y `reschedule_appointment` se recrean para que un
--    turno `pending_payment` sólo bloquee el horario durante 15 minutos —
--    si el cliente abandona el pago, el horario se libera solo en vez de
--    quedar tomado para siempre por un turno "fantasma".
-- 4. `book_appointment_pending` es la versión de `book_appointment` para el
--    flujo público de cobro: mismo advisory lock + chequeo de solapamiento,
--    pero inserta en 'pending_payment' con el monto a cobrar. Sólo la
--    service_role puede ejecutarla (el checkout público siempre corre con
--    el cliente admin, nunca con una sesión de usuario).
--
-- Ejecutar una sola vez, después de 0003. Es idempotente.
-- ============================================================================

alter table public.appointments
  add column if not exists amount integer check (amount is null or amount >= 0),
  add column if not exists payment_id text,
  add column if not exists payment_status text;

alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check
  check (status in ('pending', 'pending_payment', 'confirmed', 'cancelled', 'done'));

create index if not exists appointments_payment_id_idx on public.appointments (payment_id);

-- ---------------------------------------------------------------------------
-- book_appointment — igual que antes, sólo cambia la condición de solapamiento
-- para excluir turnos `pending_payment` de más de 15 minutos.
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
-- reschedule_appointment — misma corrección del chequeo de solapamiento.
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
-- book_appointment_pending — reserva "a la espera de pago" para el checkout
-- público. Mismo patrón que book_appointment, sin chequeo de rol (sólo la
-- service_role puede ejecutarla), inserta en 'pending_payment' con `amount`.
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
