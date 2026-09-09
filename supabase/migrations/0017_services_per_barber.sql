-- ============================================================================
-- Servicios por barbero.
--
-- Hasta ahora `public.services` era un catálogo global compartido por todos
-- los barberos. Cada barbero puede ofrecer servicios distintos en nombre,
-- descripción y precio, así que la carta pasa a ser propia de cada barbero:
-- `services.barber_id` apunta al barbero dueño del servicio.
--
-- Se arranca de cero: se vacía el catálogo global y el admin vuelve a cargar
-- los servicios de cada barbero desde el panel (pestaña Barberos › Servicios).
-- Los turnos que referenciaban un servicio del catálogo viejo quedan con
-- `service_id = null` (la FK ya era `on delete set null`): siguen existiendo,
-- sólo pierden la etiqueta del servicio.
--
-- Idempotente: el vaciado sólo corre la primera vez (mientras `services` no
-- tenga todavía la columna `barber_id`), así volver a aplicarla no borra los
-- servicios cargados después.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'services'
      and column_name = 'barber_id'
  ) then
    -- 1. Vaciar el catálogo global. Dispara el `on delete set null` sobre
    --    `appointments.service_id`.
    delete from public.services;

    -- 2. Vincular cada servicio a un barbero. La tabla quedó vacía, así que
    --    `not null` sin default no rompe nada.
    alter table public.services
      add column barber_id uuid not null
        references public.barbers (id) on delete cascade;
  end if;
end $$;

-- 3. El flag de "destacado / más pedido" ya no se usa.
alter table public.services drop column if exists featured;

create index if not exists services_barber_idx on public.services (barber_id);
