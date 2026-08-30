-- ============================================================================
-- Switch para el módulo "Turnos" de Configuraciones: controla si la
-- paginación de la vista de turnos (admin y editor) muestra el texto
-- "Página X de Y · N turnos", o sólo los botones Anterior/Siguiente.
--
-- Ejecutar una sola vez, después de 0008. Es idempotente.
-- ============================================================================

alter table public.settings
  add column if not exists show_pagination_count boolean not null default true;
