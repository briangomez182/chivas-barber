'use client';

import { motion } from 'framer-motion';

import type { Slot } from '@/lib/types';

interface SlotGridProps {
  slots: Slot[];
  value: string | null;
  onChange: (time: string) => void;
  loading: boolean;
}

export function SlotGrid({ slots, value, onChange, loading }: SlotGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <div
            key={index}
            className="h-11 animate-pulse rounded-xl bg-gray-100"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="rounded-2xl bg-gray-50 px-5 py-8 text-center text-sm text-ink-soft">
        No hay horarios para este día. Probá con otra fecha.
      </p>
    );
  }

  const available = slots.filter((slot) => slot.available).length;

  return (
    <div>
      <p className="mb-3 text-xs font-medium text-ink-muted">
        {available} {available === 1 ? 'horario disponible' : 'horarios disponibles'}
      </p>

      <div
        role="listbox"
        aria-label="Horarios disponibles"
        className="scroll-slim grid max-h-[280px] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4"
      >
        {slots.map((slot, index) => {
          const selected = slot.time === value;

          return (
            <motion.button
              key={slot.time}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={!slot.available}
              onClick={() => onChange(slot.time)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.25,
                delay: Math.min(index * 0.015, 0.3),
                ease: [0.22, 1, 0.36, 1],
              }}
              title={
                slot.reason === 'taken'
                  ? 'Turno ya reservado'
                  : slot.reason === 'past'
                    ? 'Horario pasado'
                    : `${slot.time} — ${slot.endTime}`
              }
              className={`h-11 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                selected
                  ? 'border-brand bg-brand text-white shadow-brand'
                  : slot.available
                    ? 'border-gray-200 bg-white text-ink hover:border-brand hover:text-brand'
                    : 'cursor-not-allowed border-transparent bg-gray-50 text-gray-300 line-through'
              }`}
            >
              {slot.time}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
