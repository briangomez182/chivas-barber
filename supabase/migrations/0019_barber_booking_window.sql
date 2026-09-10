-- ============================================================================
-- Días habilitados para turnos, por barbero.
--
-- Cada barbero define cuántos días hacia adelante se puede reservar en su
-- agenda, contando hoy como día 1. Con `booking_window_days = 7`, un cliente
-- puede sacar turno para hoy y los 6 días siguientes; del día 8 en adelante
-- el calendario público y los endpoints de reserva (`/api/book`,
-- `/api/checkout`, `/api/availability`) rechazan la fecha.
--
-- Default 60 (mismo horizonte que tenía el calendario antes de este cambio),
-- así nada se restringe hasta que el admin baje el valor desde
-- Barberos › Agenda y horarios.
--
-- Ejecutar una sola vez, después de 0018. Es idempotente.
-- ============================================================================

alter table public.barbers
  add column if not exists booking_window_days integer not null default 60
    check (booking_window_days between 1 and 365);
