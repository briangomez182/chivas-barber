-- ============================================================================
-- Seña configurable para el cobro por Mercado Pago.
--
-- Hasta ahora `POST /api/checkout` cobraba el precio completo del servicio.
-- Pasa a cobrar `settings.deposit_amount` — un monto fijo en pesos que el
-- admin configura desde el panel (sección "Pagos") — y el resto se abona en
-- el local. Default 0: hay que configurarlo antes de que el checkout
-- funcione (ver checkout/route.ts, que rechaza el pago si es 0).
--
-- Ejecutar una sola vez, después de 0004. Es idempotente.
-- ============================================================================

alter table public.settings
  add column if not exists deposit_amount integer not null default 0 check (deposit_amount >= 0);
