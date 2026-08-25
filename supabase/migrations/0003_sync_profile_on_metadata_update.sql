-- ============================================================================
-- Sincroniza `profiles.role`/`barber_id` cuando cambia `app_metadata`.
--
-- Bug observado: `auth.admin.createUser({ app_metadata: { role: 'admin' } })`
-- deja el INSERT de `auth.users` con `raw_app_meta_data` todavía sin el
-- `role` que se pidió — GoTrue lo completa en un paso posterior (una o más
-- UPDATE) — así que el trigger `handle_new_user` (AFTER INSERT) puede crear
-- el profile con `role: 'client'` (el default) aunque el `app_metadata`
-- final del usuario sí tenga el rol correcto.
--
-- `src/lib/db.ts` (`createStaffUser`) y `scripts/seed.mjs` ya pisan el
-- profile a mano después de crear el usuario, así que esos dos caminos
-- quedan bien. Este trigger es la solución de fondo: cualquier UPDATE de
-- `auth.users` que cambie `raw_app_meta_data` (dashboard, `updateUserById`,
-- el propio paso interno de GoTrue) resincroniza el profile.
-- ============================================================================
create or replace function public.sync_profile_from_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_app_meta_data is distinct from old.raw_app_meta_data then
    update public.profiles
    set role      = coalesce(new.raw_app_meta_data ->> 'role', 'client'),
        barber_id = nullif(new.raw_app_meta_data ->> 'barber_id', '')::uuid
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_metadata_updated on auth.users;
create trigger on_auth_user_metadata_updated
  after update on auth.users
  for each row execute function public.sync_profile_from_app_metadata();
