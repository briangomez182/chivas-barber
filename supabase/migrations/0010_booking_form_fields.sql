-- ============================================================================
-- Switch para el módulo "Formulario de turnos" de Configuraciones: controla
-- si el formulario público de reserva (BookingWidget) muestra los campos de
-- email y comentarios, o los oculta por completo. Ambos son opcionales, así
-- que ocultarlos no afecta la validación de la reserva.
--
-- Ejecutar una sola vez, después de 0009. Es idempotente.
-- ============================================================================

alter table public.settings
  add column if not exists show_optional_booking_fields boolean not null default true;
