-- ============================================================================
-- Imágenes de portafolio por barbero.
--
-- Cada barbero puede tener hasta 5 imágenes de sus trabajos (cortes, etc.)
-- que se muestran en la página principal como carrusel al pasar el mouse
-- sobre su tarjeta. Los barberos las gestionan desde su panel de editor.
--
-- RLS mismo patrón que `schedule_blocks`:
--   · SELECT: público (cualquiera puede ver las imágenes).
--   · INSERT/UPDATE/DELETE: admin (todo) o editor del propio barbero.
--
-- Ejecutar una sola vez, después de 0006. Es idempotente.
-- ============================================================================

create table if not exists public.barber_portfolio_images (
  id          uuid        primary key default gen_random_uuid(),
  barber_id   uuid        not null references public.barbers (id) on delete cascade,
  image_url   text        not null,
  sort_order  smallint    not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists barber_portfolio_images_barber_idx
  on public.barber_portfolio_images (barber_id, sort_order);

alter table public.barber_portfolio_images enable row level security;

-- SELECT: público, cualquiera puede ver las imágenes.
drop policy if exists portfolio_images_public_select on public.barber_portfolio_images;
create policy portfolio_images_public_select on public.barber_portfolio_images
  for select
  using (true);

-- Todo: admin puede hacer cualquier operación.
drop policy if exists portfolio_images_admin_all on public.barber_portfolio_images;
create policy portfolio_images_admin_all on public.barber_portfolio_images
  for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Editor: sólo para su propio barbero.
drop policy if exists portfolio_images_editor_insert on public.barber_portfolio_images;
create policy portfolio_images_editor_insert on public.barber_portfolio_images
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'editor'
        and p.barber_id = barber_portfolio_images.barber_id
    )
  );

drop policy if exists portfolio_images_editor_delete on public.barber_portfolio_images;
create policy portfolio_images_editor_delete on public.barber_portfolio_images
  for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'editor'
        and p.barber_id = barber_portfolio_images.barber_id
    )
  );

drop policy if exists portfolio_images_editor_update on public.barber_portfolio_images;
create policy portfolio_images_editor_update on public.barber_portfolio_images
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'editor'
        and p.barber_id = barber_portfolio_images.barber_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'editor'
        and p.barber_id = barber_portfolio_images.barber_id
    )
  );
