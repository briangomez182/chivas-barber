-- ============================================================================
-- Bloqueos de agenda — "me desconecto 4 horas" / día completo.
--
-- Un bloqueo no es un turno: no tiene cliente ni pago, sólo marca un tramo
-- (o el día entero, si start_time/end_time son null) como no disponible para
-- ese barbero. `buildSlots` (src/lib/slots.ts) lo cruza igual que hace con
-- los turnos para armar la grilla de horarios.
--
-- RLS mismo patrón que `appointments`: admin todo, editor sólo su propio
-- barbero (vía `profiles.barber_id`, no `auth.uid()` directo — ver el
-- comentario en 0002_rbac_auth.sql sobre por qué). El público (booking
-- anónimo) nunca toca esta tabla directo: `/api/availability` la lee con la
-- service_role, como ya hace con `appointments`.
--
-- Ejecutar una sola vez, después de 0005. Es idempotente.
-- ============================================================================

create table if not exists public.schedule_blocks (
  id         uuid primary key default gen_random_uuid(),
  barber_id  uuid not null references public.barbers (id) on delete cascade,
  date       text not null check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  start_time text check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time   text check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  reason     text not null default '',
  created_at timestamptz not null default now(),
  constraint schedule_blocks_range_check check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and start_time < end_time)
  )
);

create index if not exists schedule_blocks_barber_date_idx on public.schedule_blocks (barber_id, date);

alter table public.schedule_blocks enable row level security;

drop policy if exists schedule_blocks_admin_all on public.schedule_blocks;
create policy schedule_blocks_admin_all on public.schedule_blocks
  for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists schedule_blocks_editor_select on public.schedule_blocks;
create policy schedule_blocks_editor_select on public.schedule_blocks
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'editor' and p.barber_id = schedule_blocks.barber_id
    )
  );

drop policy if exists schedule_blocks_editor_insert on public.schedule_blocks;
create policy schedule_blocks_editor_insert on public.schedule_blocks
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'editor' and p.barber_id = schedule_blocks.barber_id
    )
  );

drop policy if exists schedule_blocks_editor_delete on public.schedule_blocks;
create policy schedule_blocks_editor_delete on public.schedule_blocks
  for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'editor' and p.barber_id = schedule_blocks.barber_id
    )
  );
