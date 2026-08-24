'use client';

import { useState } from 'react';

import { Field } from '@/components/ui/Field';
import { api } from '@/lib/api-client';
import { WEEKDAY_LABELS } from '@/lib/date';
import { SLOT_INTERVALS, type Settings, type SlotInterval } from '@/lib/types';

interface ScheduleSettingsPanelProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

export function ScheduleSettingsPanel({
  settings,
  onChange,
}: ScheduleSettingsPanelProps) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: number): void => {
    const workingDays = draft.workingDays.includes(day)
      ? draft.workingDays.filter((item) => item !== day)
      : [...draft.workingDays, day].sort((a, b) => a - b);

    setDraft({ ...draft, workingDays });
  };

  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const { settings: saved } = await api.settings.update(draft);
      onChange(saved);
      setDraft(saved);
      setMessage('Configuración actualizada. Ya impacta en la agenda pública.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="admin-settings-title">
      <header>
        <h2
          id="admin-settings-title"
          className="text-xl font-extrabold tracking-[-0.02em] text-ink"
        >
          Configuración de la agenda
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Parámetros globales usados para generar los bloques de horarios.
        </p>
      </header>

      <form onSubmit={save} className="card mt-7 max-w-2xl p-7">
        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
            Intervalo entre turnos
          </legend>
          <div className="mt-3 inline-flex w-full gap-1 rounded-full bg-gray-100 p-1">
            {SLOT_INTERVALS.map((minutes) => {
              const active = draft.slotIntervalMin === minutes;
              return (
                <label
                  key={minutes}
                  className={`flex-1 cursor-pointer rounded-full px-3 py-2 text-center text-sm font-semibold transition-all ${
                    active
                      ? 'bg-brand text-white shadow-brand'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  <input
                    type="radio"
                    name="slotInterval"
                    className="sr-only"
                    checked={active}
                    onChange={() =>
                      setDraft({
                        ...draft,
                        slotIntervalMin: minutes as SlotInterval,
                      })
                    }
                  />
                  {minutes} min
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-7 grid gap-5 sm:grid-cols-3">
          <Field label="Apertura" htmlFor="opening">
            <input
              id="opening"
              type="time"
              step={900}
              value={draft.openingTime}
              onChange={(event) =>
                setDraft({ ...draft, openingTime: event.target.value })
              }
            />
          </Field>

          <Field label="Cierre" htmlFor="closing">
            <input
              id="closing"
              type="time"
              step={900}
              value={draft.closingTime}
              onChange={(event) =>
                setDraft({ ...draft, closingTime: event.target.value })
              }
            />
          </Field>

          <Field
            label="Descanso (min)"
            htmlFor="buffer"
            hint="Entre un turno y el siguiente."
          >
            <input
              id="buffer"
              type="number"
              min={0}
              max={60}
              step={5}
              value={draft.bufferMin}
              onChange={(event) =>
                setDraft({ ...draft, bufferMin: Number(event.target.value) })
              }
            />
          </Field>
        </div>

        <fieldset className="mt-7">
          <legend className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
            Días laborables
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {WEEKDAY_LABELS.map((label, day) => {
              const active = draft.workingDays.includes(day);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(day)}
                  aria-pressed={active}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
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
        </fieldset>

        {message && (
          <p className="mt-6 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-8 flex justify-end">
          <button type="submit" disabled={busy} className="pill-primary px-8 py-3">
            {busy ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>
      </form>
    </section>
  );
}
