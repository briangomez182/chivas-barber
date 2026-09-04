-- ============================================================================
-- Programa de Lealtad — Tarjeta de Sellos digital
--
-- 1. `loyalty_cards`: una fila por número de teléfono (normalizado a dígitos
--    con código de país). `completed_stamps` 0..10, `rewards_earned` cuenta
--    las tarjetas completadas (cortes gratis acumulados).
--
-- 2. Trigger sobre `appointments`: cuando un turno queda "atendido y saldado"
--    — `status = 'done'`, o `status = 'confirmed'` con el pago aprobado por
--    Mercado Pago — se suma +1 sello al cliente de ese teléfono. Cada turno
--    otorga como máximo un sello: la columna marcadora `loyalty_stamped_at`
--    evita el doble conteo si el turno se vuelve a editar. Al llegar a 10 el
--    contador se reinicia y `rewards_earned` sube en 1.
--
-- 3. RLS: la tabla no tiene policy de lectura para `anon`/`authenticated`, así
--    que sólo se consulta vía `get_loyalty_card(phone)` (SECURITY DEFINER,
--    filtra por teléfono y nada más). La escritura directa a la tabla la
--    permite RLS únicamente a un usuario con rol 'admin'; el ajuste manual
--    pasa además por `admin_adjust_loyalty_stamp`, que revalida el rol.
--
-- Ejecutar una sola vez, después de 0011. Es idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- loyalty_cards
-- ---------------------------------------------------------------------------
create table if not exists public.loyalty_cards (
  id               uuid primary key default gen_random_uuid(),
  -- Dígitos con código de país (ej. `5491160068637`). `unique` ya crea el
  -- índice que usan todas las búsquedas por teléfono.
  phone_number     text not null unique,
  completed_stamps integer not null default 0 check (completed_stamps between 0 and 10),
  rewards_earned   integer not null default 0 check (rewards_earned >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Mantiene `updated_at` al día en cualquier UPDATE, incluido el que hace un
-- admin directamente contra la tabla (via RLS).
create or replace function public.loyalty_cards_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists loyalty_cards_set_updated_at on public.loyalty_cards;
create trigger loyalty_cards_set_updated_at
  before update on public.loyalty_cards
  for each row execute function public.loyalty_cards_touch_updated_at();

-- ---------------------------------------------------------------------------
-- normalize_loyalty_phone — misma regla que `customerWhatsappLink` en
-- src/lib/brand.ts: se quedan sólo los dígitos y, si no arranca con el código
-- de Argentina, se antepone `54`. Los turnos reservados desde la web ya
-- guardan el número con prefijo (WhatsAppPhoneInput); los turnos manuales del
-- panel son un número local argentino sin prefijo.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_loyalty_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when s.digits = ''            then ''
    when left(s.digits, 2) = '54' then s.digits
    else '54' || s.digits
  end
  from (
    select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as digits
  ) s;
$$;

-- ---------------------------------------------------------------------------
-- grant_loyalty_stamp — suma +1 sello al teléfono dado, con rollover atómico.
-- La usa el trigger de `appointments`. SECURITY DEFINER: corre como su dueño
-- (salta RLS) y no depende de que quien dispare el trigger tenga permisos
-- sobre `loyalty_cards`.
-- ---------------------------------------------------------------------------
create or replace function public.grant_loyalty_stamp(p_phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  v_phone := public.normalize_loyalty_phone(p_phone);
  if length(v_phone) < 8 then
    return;
  end if;

  insert into public.loyalty_cards (phone_number, completed_stamps, rewards_earned)
  values (v_phone, 1, 0)
  on conflict (phone_number) do update
    set completed_stamps = case
          when public.loyalty_cards.completed_stamps + 1 >= 10
            then public.loyalty_cards.completed_stamps + 1 - 10
          else public.loyalty_cards.completed_stamps + 1
        end,
        rewards_earned = case
          when public.loyalty_cards.completed_stamps + 1 >= 10
            then public.loyalty_cards.rewards_earned + 1
          else public.loyalty_cards.rewards_earned
        end,
        updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- appointments.loyalty_stamped_at + trigger
--
-- El trigger es BEFORE para poder marcar `loyalty_stamped_at` sobre la misma
-- fila sin un segundo UPDATE. El guard `loyalty_stamped_at is null` garantiza
-- un sello por turno como mucho, aunque el turno se reagende o cambie de
-- estado varias veces.
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column if not exists loyalty_stamped_at timestamptz;

create or replace function public.appointments_grant_loyalty_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.loyalty_stamped_at is null
     and (
       new.status = 'done'
       or (new.status = 'confirmed' and new.payment_status = 'approved')
     )
  then
    perform public.grant_loyalty_stamp(new.customer_phone);
    new.loyalty_stamped_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_loyalty_stamp on public.appointments;
create trigger appointments_loyalty_stamp
  before insert or update on public.appointments
  for each row execute function public.appointments_grant_loyalty_stamp();

-- ---------------------------------------------------------------------------
-- get_loyalty_card — lectura pública, SÓLO por teléfono. Devuelve siempre una
-- fila: si el cliente no tiene tarjeta, ceros y `card_exists = false`.
-- ---------------------------------------------------------------------------
create or replace function public.get_loyalty_card(p_phone text)
returns table (
  phone_number     text,
  completed_stamps integer,
  rewards_earned   integer,
  updated_at       timestamptz,
  card_exists      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  v_phone := public.normalize_loyalty_phone(p_phone);

  return query
    select l.phone_number, l.completed_stamps, l.rewards_earned, l.updated_at, true
    from public.loyalty_cards l
    where l.phone_number = v_phone;

  if not found then
    return query select v_phone, 0, 0, null::timestamptz, false;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_adjust_loyalty_stamp — ajuste manual (+1 / -1) del panel de admin.
--
-- Autorización con el mismo patrón que `book_appointment`: si `auth.uid()` es
-- null quien llama es la service_role (confiable); si hay sesión, tiene que
-- ser rol 'admin'. Crea la tarjeta si no existe. `-1` nunca baja de 0; `+1`
-- que llega a 10 reinicia el contador y suma un corte gratis.
-- ---------------------------------------------------------------------------
create or replace function public.admin_adjust_loyalty_stamp(
  p_phone text,
  p_delta integer
)
returns table (
  phone_number     text,
  completed_stamps integer,
  rewards_earned   integer,
  updated_at       timestamptz,
  card_exists      boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone   text;
  v_role    text;
  v_stamps  integer;
  v_rewards integer;
  v_new     integer;
begin
  if auth.uid() is not null then
    select role into v_role from public.profiles where id = auth.uid();
    if v_role is distinct from 'admin' then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  v_phone := public.normalize_loyalty_phone(p_phone);
  if length(v_phone) < 8 then
    raise exception 'INVALID_PHONE';
  end if;

  insert into public.loyalty_cards (phone_number)
  values (v_phone)
  on conflict (phone_number) do nothing;

  select l.completed_stamps, l.rewards_earned
    into v_stamps, v_rewards
  from public.loyalty_cards l
  where l.phone_number = v_phone
  for update;

  v_new := greatest(v_stamps + p_delta, 0);

  if v_new >= 10 then
    v_rewards := v_rewards + (v_new / 10);
    v_new := v_new % 10;
  end if;

  update public.loyalty_cards l
  set completed_stamps = v_new,
      rewards_earned   = v_rewards
  where l.phone_number = v_phone;

  return query
    select l.phone_number, l.completed_stamps, l.rewards_earned, l.updated_at, true
    from public.loyalty_cards l
    where l.phone_number = v_phone;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS — loyalty_cards
--
-- Sin policy de SELECT/INSERT/UPDATE para anon ni authenticated: la lectura
-- pública va por `get_loyalty_card` y la escritura automática por el trigger
-- (ambas SECURITY DEFINER). La única policy directa es para el admin, que el
-- panel usa con su sesión real (RLS como barrera de fondo, además del
-- `requireAdmin()` de la ruta).
-- ---------------------------------------------------------------------------
alter table public.loyalty_cards enable row level security;

drop policy if exists loyalty_cards_admin_all on public.loyalty_cards;
create policy loyalty_cards_admin_all on public.loyalty_cards
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

-- ---------------------------------------------------------------------------
-- Grants — mismo criterio que el resto de funciones SECURITY DEFINER del
-- proyecto: revocar de PUBLIC y habilitar sólo a quien corresponde.
-- ---------------------------------------------------------------------------
revoke all on function public.grant_loyalty_stamp(text) from public;
grant execute on function public.grant_loyalty_stamp(text) to service_role;

revoke all on function public.get_loyalty_card(text) from public;
grant execute on function public.get_loyalty_card(text) to anon, authenticated, service_role;

revoke all on function public.admin_adjust_loyalty_stamp(text, integer) from public;
grant execute on function public.admin_adjust_loyalty_stamp(text, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Backfill — turnos ya atendidos/pagados que todavía no otorgaron sello.
-- `set status = status` es un no-op que igual dispara el trigger BEFORE
-- UPDATE. Idempotente: en una segunda corrida `loyalty_stamped_at` ya no es
-- null y el trigger no hace nada.
-- ---------------------------------------------------------------------------
update public.appointments
set status = status
where loyalty_stamped_at is null
  and (status = 'done' or (status = 'confirmed' and payment_status = 'approved'));
