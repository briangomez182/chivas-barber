-- ============================================================================
-- Switch + cantidad de sellos para el módulo "Tarjeta de Fidelización" de
-- Configuraciones:
--
-- 1. `settings.loyalty_enabled` — si es `false`, la sección "Lealtad" del
--    sitio público y la pestaña "Lealtad" del panel de admin quedan ocultas
--    (lo resuelve la app, esto sólo guarda el switch). Por defecto `true`
--    para no cambiar el comportamiento actual al aplicar esta migración.
--
-- 2. `settings.loyalty_stamps_goal` — sellos necesarios para completar la
--    tarjeta y ganar un corte gratis (5 / 10 / 15 / 20, por defecto 10).
--    `grant_loyalty_stamp` (trigger automático) y `admin_adjust_loyalty_stamp`
--    (ajuste manual del panel) ahora lo leen de acá en vez de tener `10`
--    fijo. El cambio no es retroactivo: una tarjeta que ya tenga más sellos
--    que la nueva meta recién se corrige en el próximo sello que sume.
--
-- 3. Se relaja el `check` de `loyalty_cards.completed_stamps` (antes
--    `between 0 and 10`) para permitir hasta 20, el máximo de las metas
--    admitidas.
--
-- Ejecutar una sola vez, después de 0012. Es idempotente.
-- ============================================================================

alter table public.settings
  add column if not exists loyalty_enabled boolean not null default true;

alter table public.settings
  add column if not exists loyalty_stamps_goal integer not null default 10
    check (loyalty_stamps_goal in (5, 10, 15, 20));

alter table public.loyalty_cards
  drop constraint if exists loyalty_cards_completed_stamps_check;

alter table public.loyalty_cards
  add constraint loyalty_cards_completed_stamps_check
    check (completed_stamps between 0 and 20);

-- ---------------------------------------------------------------------------
-- grant_loyalty_stamp — igual que en 0012, sólo cambia el `10` fijo por la
-- meta configurada en `settings.loyalty_stamps_goal`.
-- ---------------------------------------------------------------------------
create or replace function public.grant_loyalty_stamp(p_phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_goal  integer;
begin
  v_phone := public.normalize_loyalty_phone(p_phone);
  if length(v_phone) < 8 then
    return;
  end if;

  select loyalty_stamps_goal into v_goal from public.settings limit 1;
  v_goal := coalesce(v_goal, 10);

  insert into public.loyalty_cards (phone_number, completed_stamps, rewards_earned)
  values (v_phone, 1, 0)
  on conflict (phone_number) do update
    set completed_stamps = case
          when public.loyalty_cards.completed_stamps + 1 >= v_goal
            then public.loyalty_cards.completed_stamps + 1 - v_goal
          else public.loyalty_cards.completed_stamps + 1
        end,
        rewards_earned = case
          when public.loyalty_cards.completed_stamps + 1 >= v_goal
            then public.loyalty_cards.rewards_earned + 1
          else public.loyalty_cards.rewards_earned
        end,
        updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_adjust_loyalty_stamp — igual que en 0012, con la meta configurable
-- en vez de `10` fijo.
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
