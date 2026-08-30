-- ============================================================================
-- Switch explícito para habilitar/deshabilitar el cobro de seña.
--
-- Hasta ahora `deposit_amount = 0` era la única forma de "apagar" el cobro
-- (ver checkout/route.ts). Se agrega una columna booleana separada para que
-- el admin pueda desactivar el cobro sin perder el monto configurado —
-- útil para reactivarlo después con el mismo valor.
--
-- Migra el estado actual: si ya había una seña > 0 configurada, arranca
-- habilitada (no rompe el checkout que ya estaba funcionando).
--
-- Ejecutar una sola vez, después de 0007. Es idempotente.
-- ============================================================================

alter table public.settings
  add column if not exists deposit_enabled boolean not null default false;

update public.settings
  set deposit_enabled = true
  where deposit_amount > 0;
