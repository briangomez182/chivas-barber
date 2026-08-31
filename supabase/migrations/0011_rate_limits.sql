-- ============================================================================
-- Rate limiting para los endpoints públicos (login, register, book, checkout).
--
-- Ninguno de esos endpoints tenía límite de requests: cualquiera podía
-- reintentar login sin parar (fuerza bruta), registrar cuentas en masa, o
-- generar turnos/preferencias de pago sin límite. El conteo se guarda en
-- Postgres en vez de en memoria del proceso: en Vercel cada invocación
-- serverless es una instancia nueva que no comparte memoria con las demás,
-- así que un contador en RAM no serviría de nada.
--
-- Ventana fija por `key` (ej. "login:1.2.3.4"): la fila se reinicia sola
-- cuando `window_start` queda más vieja que la ventana pedida. Una sola
-- sentencia INSERT ... ON CONFLICT hace el chequeo atómico bajo concurrencia
-- (el lock de fila del UPSERT evita la carrera entre leer y escribir).
--
-- Ejecutar una sola vez, después de 0010. Es idempotente.
-- ============================================================================

create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  count        integer not null default 1
);

create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case
          when public.rate_limits.window_start <= now() - make_interval(secs => p_window_seconds)
            then 1
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start <= now() - make_interval(secs => p_window_seconds)
            then now()
          else public.rate_limits.window_start
        end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Mismo patrón que book_appointment en schema.sql: `security definer` corre
-- la función como su dueño (salta RLS), así que el acceso se restringe a
-- mano — sólo la service_role (los Route Handlers) puede invocarla.
revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

alter table public.rate_limits enable row level security;
