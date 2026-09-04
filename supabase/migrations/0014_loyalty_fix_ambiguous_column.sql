-- ============================================================================
-- Fix: "column reference \"phone_number\" is ambiguous" al ajustar sellos a
-- mano desde el panel de admin.
--
-- `admin_adjust_loyalty_stamp` y `get_loyalty_card` son `returns table
-- (phone_number text, completed_stamps integer, ...)`. Esos nombres de salida
-- pasan a ser variables PL/pgSQL dentro de la función, así que en
-- `insert ... on conflict (phone_number)` Postgres no sabe si `phone_number`
-- es la variable o la columna y aborta. (`get_loyalty_card` venía andando de
-- casualidad porque no tiene `on conflict`; `grant_loyalty_stamp` tampoco
-- falla porque es `returns void` y no genera esas variables.)
--
-- Solución: `#variable_conflict use_column` al tope del cuerpo — ante un
-- nombre ambiguo, PL/pgSQL usa la columna. Estas funciones nunca leen esas
-- variables de salida a mano (se llenan solas con `return query`), así que es
-- seguro. Se recrean ambas con exactamente el mismo cuerpo que en 0013/0012
-- más esa línea.
--
-- Ejecutar una sola vez, después de 0013. Es idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- get_loyalty_card
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
#variable_conflict use_column
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
-- admin_adjust_loyalty_stamp
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
#variable_conflict use_column
declare
  v_phone   text;
  v_role    text;
  v_goal    integer;
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

  select loyalty_stamps_goal into v_goal from public.settings limit 1;
  v_goal := coalesce(v_goal, 10);

  insert into public.loyalty_cards (phone_number)
  values (v_phone)
  on conflict (phone_number) do nothing;

  select l.completed_stamps, l.rewards_earned
    into v_stamps, v_rewards
  from public.loyalty_cards l
  where l.phone_number = v_phone
  for update;

  v_new := greatest(v_stamps + p_delta, 0);

  if v_new >= v_goal then
    v_rewards := v_rewards + (v_new / v_goal);
    v_new := v_new % v_goal;
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

-- `create or replace` conserva los grants previos, pero los repetimos para que
-- este archivo sea autónomo si se corre sobre una base sin 0012/0013.
revoke all on function public.get_loyalty_card(text) from public;
grant execute on function public.get_loyalty_card(text) to anon, authenticated, service_role;

revoke all on function public.admin_adjust_loyalty_stamp(text, integer) from public;
grant execute on function public.admin_adjust_loyalty_stamp(text, integer) to authenticated, service_role;
