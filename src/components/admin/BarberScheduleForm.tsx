'use client';

import { useState } from 'react';

import { Field } from '@/components/ui/Field';
import { api } from '@/lib/api-client';
import { WEEKDAY_LABELS } from '@/lib/date';
import {
  MAX_BOOKING_WINDOW_DAYS,
  MIN_BOOKING_WINDOW_DAYS,
  SLOT_INTERVALS,
  type Barber,
  type SlotInterval,
} from '@/lib/types';

interface BarberScheduleFormProps {
  barber: Barber;
  /** Se llama con el barbero actualizado tras guardar. */
  onSaved: (barber: Barber) => void;
}

interface Draft {
  openingTime: string;
  closingTime: string;
  workingDays: number[];
  slotIntervalMin: SlotInterval;
  bufferMin: number;
  bookingWindowDays: number;
}

function toDraft(barber: Barber): Draft {
  return {
    openingTime: barber.openingTime,
    closingTime: barber.closingTime,
    workingDays: barber.workingDays,
    slotIntervalMin: barber.slotIntervalMin,
    bufferMin: barber.bufferMin,
    bookingWindowDays: barber.bookingWindowDays,
  };
}

/**
 * Agenda propia de un barbero: apertura/cierre, días laborables, intervalo
 * entre bloques y descanso. Reemplaza a la vieja pestaña "Agenda" global.
 * Se muestra dentro de la tarjeta del barbero en el panel de admin.
 */
export function BarberScheduleForm({ barber, onSaved }: BarberScheduleFormProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(barber));
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: number): void => {
    setDraft((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((item) => item !== day)
        : [...prev.workingDays, day].sort((a, b) => a - b),
    }));
  };

  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (draft.openingTime >= draft.closingTime) {
      setError('La apertura tiene que ser antes del cierre.');
      return;
    }
    if (draft.workingDays.length === 0) {
      setError('Elegí al menos un día laborable.');
      return;
    }
    if (
      !Number.isInteger(draft.bookingWindowDays) ||
      draft.bookingWindowDays < MIN_BOOKING_WINDOW_DAYS ||
      draft.bookingWindowDays > MAX_BOOKING_WINDOW_DAYS
    ) {
      setError(
        `Los días habilitados para turnos deben estar entre ${MIN_BOOKING_WINDOW_DAYS} y ${MAX_BOOKING_WINDOW_DAYS}.`,
      );
      return;
    }

    setBusy(true);
    try {
      const { barber: saved } = await api.barbers.update(barber.id, {
        openingTime: draft.openingTime,
        closingTime: draft.closingTime,
        workingDays: draft.workingDays,
        slotIntervalMin: draft.slotIntervalMin,
        bufferMin: draft.bufferMin,
        bookingWindowDays: draft.bookingWindowDays,
      });
      onSaved(saved);
      setDraft(toDraft(saved));
      setMessage('Agenda actualizada. Ya impacta en la reserva pública.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="mt-5 space-y-6 rounded-2xl border border-gray-100 bg-white p-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
          Intervalo entre bloques
        </p>
        <div className="mt-2 inline-flex w-full gap-1 rounded-full bg-gray-100 p-1">
          {SLOT_INTERVALS.map((minutes) => {
            const active = draft.slotIntervalMin === minutes;
            return (
              <label
                key={minutes}
                className={`flex-1 cursor-pointer rounded-full px-2 py-1.5 text-center text-xs font-semibold transition-all ${
                  active ? 'bg-brand text-white shadow-brand' : 'text-ink-soft hover:text-ink'
                }`}
              >
                <input
                  type="radio"
                  name={`slot-interval-${barber.id}`}
                  className="sr-only"
                  checked={active}
                  onChange={() =>
                    setDraft((prev) => ({ ...prev, slotIntervalMin: minutes }))
                  }
                />
                {minutes} min
              </label>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-ink-muted">
          Cada servicio del barbero define su duración; el intervalo es el paso
          con el que arrancan los bloques.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Apertura" htmlFor={`opening-${barber.id}`}>
          <input
            id={`opening-${barber.id}`}
            type="time"
            step={900}
            value={draft.openingTime}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, openingTime: event.target.value }))
            }
          />
        </Field>

        <Field label="Cierre" htmlFor={`closing-${barber.id}`}>
          <input
            id={`closing-${barber.id}`}
            type="time"
            step={900}
            value={draft.closingTime}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, closingTime: event.target.value }))
            }
          />
        </Field>

        <Field
          label="Descanso (min)"
          htmlFor={`buffer-${barber.id}`}
          hint="Entre un turno y el siguiente."
        >
          <input
            id={`buffer-${barber.id}`}
            type="number"
            min={0}
            max={120}
            step={5}
            value={draft.bufferMin}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                bufferMin: Math.max(0, Number(event.target.value) || 0),
              }))
            }
          />
        </Field>
      </div>

      <Field
        label="Días habilitados para turnos"
        htmlFor={`booking-window-${barber.id}`}
        hint="Cuántos días hacia adelante se puede reservar, contando hoy. Con 7, nadie saca turno para el día 8."
      >
        <input
          id={`booking-window-${barber.id}`}
          type="number"
          min={MIN_BOOKING_WINDOW_DAYS}
          max={MAX_BOOKING_WINDOW_DAYS}
          step={1}
          value={draft.bookingWindowDays}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              bookingWindowDays: Math.trunc(Number(event.target.value)) || 0,
            }))
          }
        />
      </Field>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
          Días laborables
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((label, day) => {
            const active = draft.workingDays.includes(day);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(day)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? 'border-brand bg-brand text-white shadow-brand'
                    : 'border-gray-200 bg-white text-ink-soft hover:border-ink hover:text-ink'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {message && (
        <p className="rounded-xl bg-brand-50 px-4 py-2.5 text-xs font-medium text-brand">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={busy} className="pill-primary px-6 py-2 text-xs">
          {busy ? 'Guardando…' : 'Guardar agenda'}
        </button>
      </div>
    </form>
  );
}
