'use client';

import { SLOT_INTERVALS, type SlotInterval } from '@/lib/types';

interface DurationPillsProps {
  value: number;
  onChange: (minutes: SlotInterval) => void;
  label?: string;
  name?: string;
}

/** Selector de duración de la sesión: 15 / 30 / 45 / 60 minutos. */
export function DurationPills({
  value,
  onChange,
  label = 'Duración de la sesión',
  name = 'duration',
}: DurationPillsProps) {
  return (
    <fieldset>
      <legend className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </legend>

      <div className="mt-3 inline-flex w-full gap-1 rounded-full bg-gray-100 p-1">
        {SLOT_INTERVALS.map((minutes) => {
          const active = value === minutes;
          return (
            <label
              key={minutes}
              className={`flex-1 cursor-pointer rounded-full px-3 py-2 text-center text-sm font-semibold transition-all duration-200 ${
                active
                  ? 'bg-brand text-white shadow-brand'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={minutes}
                checked={active}
                onChange={() => onChange(minutes as SlotInterval)}
                className="sr-only"
              />
              {minutes} min
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
