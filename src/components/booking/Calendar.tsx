'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import {
  MONTH_LABELS,
  WEEKDAY_LABELS,
  monthGrid,
  parseIsoDate,
  todayIso,
  weekdayOf,
} from '@/lib/date';

interface CalendarProps {
  value: string;
  onChange: (date: string) => void;
  /** Días laborables (0 = domingo). */
  workingDays: number[];
  /** Cuántos días hacia adelante se pueden reservar. */
  horizonDays?: number;
}

export function Calendar({
  value,
  onChange,
  workingDays,
  horizonDays = 60,
}: CalendarProps) {
  const today = todayIso();
  const initial = parseIsoDate(value || today);

  const [cursor, setCursor] = useState<{ year: number; month: number }>({
    year: initial.year,
    month: initial.month,
  });
  const [direction, setDirection] = useState<number>(1);

  const cells = useMemo<(string | null)[]>(
    () => monthGrid(cursor.year, cursor.month),
    [cursor],
  );

  const maxDate = useMemo<string>(() => {
    const { year, month, day } = parseIsoDate(today);
    const limit = new Date(Date.UTC(year, month, day + horizonDays));
    return limit.toISOString().slice(0, 10);
  }, [today, horizonDays]);

  const move = (step: number): void => {
    setDirection(step);
    setCursor((current) => {
      const next = new Date(Date.UTC(current.year, current.month + step, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  };

  const isDisabled = (iso: string): boolean =>
    iso < today || iso > maxDate || !workingDays.includes(weekdayOf(iso));

  const monthKey = `${cursor.year}-${cursor.month}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold tracking-[-0.01em] text-ink">
          {MONTH_LABELS[cursor.month]}{' '}
          <span className="text-ink-muted">{cursor.year}</span>
        </h3>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Mes anterior"
            className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 text-ink transition-colors hover:bg-gray-50"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
              <path d="M12.95 4.55 11.54 3.14 4.68 10l6.86 6.86 1.41-1.41L7.5 10z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Mes siguiente"
            className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 text-ink transition-colors hover:bg-gray-50"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
              <path d="M7.05 3.14 5.64 4.55 10.68 10l-5.04 5.45 1.41 1.41L13.5 10z" />
            </svg>
          </button>
        </div>
      </div>

      <div
        role="grid"
        aria-label="Calendario de turnos"
        className="mt-6 overflow-hidden"
      >
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_LABELS.map((label) => (
            <abbr
              key={label}
              title={label}
              className="pb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted no-underline"
            >
              {label[0]}
            </abbr>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={monthKey}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-7 gap-1"
          >
            {cells.map((iso, index) => {
              if (!iso) {
                return <span key={`empty-${index}`} aria-hidden="true" />;
              }

              const disabled = isDisabled(iso);
              const selected = iso === value;
              const isToday = iso === today;
              const dayNumber = Number(iso.slice(8));

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={iso}
                  onClick={() => onChange(iso)}
                  className={`relative aspect-square rounded-xl text-sm font-semibold transition-all duration-200 ${
                    selected
                      ? 'bg-brand text-white shadow-brand'
                      : disabled
                        ? 'cursor-not-allowed text-gray-300'
                        : 'text-ink hover:bg-gray-100'
                  }`}
                >
                  {dayNumber}
                  {isToday && !selected && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand"
                    />
                  )}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
