import { SLOT_INTERVALS } from '@/lib/types';

interface DurationPillsProps {
  value: number;
  /** `true` cuando ya hay un servicio elegido: recién ahí se muestra en color. */
  highlighted: boolean;
  label?: string;
}

/**
 * Indicador (no editable) de la duración de la sesión. La duración la fija
 * el servicio elegido — el usuario no puede tocarla directamente, por eso no
 * hay inputs ni `onChange`. Se ve sin colores hasta que hay un servicio
 * seleccionado.
 */
export function DurationPills({
  value,
  highlighted,
  label = 'Duración de la sesión',
}: DurationPillsProps) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </p>

      <div
        role="status"
        aria-label={`${label}: ${value} minutos`}
        className="mt-3 inline-flex w-full gap-1 rounded-full bg-gray-100 p-1"
      >
        {SLOT_INTERVALS.map((minutes) => {
          const active = highlighted && value === minutes;
          return (
            <span
              key={minutes}
              aria-hidden="true"
              className={`flex-1 select-none rounded-full px-3 py-2 text-center text-sm font-semibold transition-colors duration-200 ${
                active ? 'bg-brand text-white shadow-brand' : 'text-ink-muted'
              }`}
            >
              {minutes} min
            </span>
          );
        })}
      </div>
    </div>
  );
}
