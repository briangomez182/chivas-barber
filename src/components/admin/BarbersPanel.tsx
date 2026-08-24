'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

import { BarberAvatar } from '@/components/ui/BarberAvatar';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api-client';
import type { Barber } from '@/lib/types';

interface BarbersPanelProps {
  barbers: Barber[];
  onChange: (barbers: Barber[]) => void;
}

interface DraftBarber {
  id: string | null;
  name: string;
  role: string;
  specialty: string;
  photoUrl: string;
  active: boolean;
}

const EMPTY_DRAFT: DraftBarber = {
  id: null,
  name: '',
  role: 'Barber',
  specialty: '',
  photoUrl: '',
  active: true,
};

export function BarbersPanel({ barbers, onChange }: BarbersPanelProps) {
  const [draft, setDraft] = useState<DraftBarber | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const openNew = (): void => {
    setError(null);
    setDraft({ ...EMPTY_DRAFT });
  };

  const openEdit = (barber: Barber): void => {
    setError(null);
    setDraft({
      id: barber.id,
      name: barber.name,
      role: barber.role,
      specialty: barber.specialty,
      photoUrl: barber.photoUrl,
      active: barber.active,
    });
  };

  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!draft) return;

    setBusy(true);
    setError(null);

    try {
      const payload = {
        name: draft.name,
        role: draft.role,
        specialty: draft.specialty,
        photoUrl: draft.photoUrl,
        active: draft.active,
      };

      if (draft.id) {
        const { barber } = await api.barbers.update(draft.id, payload);
        onChange(barbers.map((item) => (item.id === barber.id ? barber : item)));
      } else {
        const { barber } = await api.barbers.create(payload);
        onChange([...barbers, barber]);
      }

      setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (barber: Barber): Promise<void> => {
    const confirmed = window.confirm(
      `¿Eliminar a ${barber.name}? También se borrarán sus turnos.`,
    );
    if (!confirmed) return;

    await api.barbers.remove(barber.id);
    onChange(barbers.filter((item) => item.id !== barber.id));
  };

  const toggleActive = async (barber: Barber): Promise<void> => {
    const { barber: updated } = await api.barbers.update(barber.id, {
      active: !barber.active,
    });
    onChange(barbers.map((item) => (item.id === updated.id ? updated : item)));
  };

  return (
    <section aria-labelledby="admin-barbers-title">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2
            id="admin-barbers-title"
            className="text-xl font-extrabold tracking-[-0.02em] text-ink"
          >
            Barberos
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {barbers.length} en total · {barbers.filter((b) => b.active).length}{' '}
            activos
          </p>
        </div>
        <button type="button" onClick={openNew} className="pill-primary">
          + Nuevo barbero
        </button>
      </header>

      <ul className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {barbers.map((barber, index) => (
          <motion.li
            key={barber.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.04 }}
            className="card flex flex-col p-6"
          >
            <div className="flex items-start gap-4">
              <BarberAvatar name={barber.name} photoUrl={barber.photoUrl} size={56} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-bold text-ink">
                  {barber.name}
                </h3>
                <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-brand">
                  {barber.role}
                </p>
                <p className="mt-1 truncate text-xs text-ink-soft">
                  {barber.specialty || '—'}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleActive(barber)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  barber.active
                    ? 'bg-brand-50 text-brand'
                    : 'bg-gray-100 text-ink-muted'
                }`}
              >
                {barber.active ? 'Activo' : 'Inactivo'}
              </button>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => openEdit(barber)}
                className="pill-ghost px-3 py-1.5 text-xs"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => remove(barber)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50"
              >
                Eliminar
              </button>
            </div>
          </motion.li>
        ))}
      </ul>

      <Modal
        open={draft !== null}
        title={draft?.id ? 'Editar barbero' : 'Nuevo barbero'}
        onClose={() => setDraft(null)}
      >
        {draft && (
          <form onSubmit={save} className="space-y-5">
            <Field label="Nombre" htmlFor="barber-name">
              <input
                id="barber-name"
                type="text"
                required
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </Field>

            <Field label="Rol / título" htmlFor="barber-role">
              <input
                id="barber-role"
                type="text"
                placeholder="Master Barber"
                value={draft.role}
                onChange={(event) =>
                  setDraft({ ...draft, role: event.target.value })
                }
              />
            </Field>

            <Field label="Especialidad" htmlFor="barber-specialty">
              <input
                id="barber-specialty"
                type="text"
                placeholder="Fades y diseños"
                value={draft.specialty}
                onChange={(event) =>
                  setDraft({ ...draft, specialty: event.target.value })
                }
              />
            </Field>

            <Field
              label="URL de la foto"
              htmlFor="barber-photo"
              hint="Dejalo vacío para mostrar las iniciales."
            >
              <input
                id="barber-photo"
                type="url"
                placeholder="https://…"
                value={draft.photoUrl}
                onChange={(event) =>
                  setDraft({ ...draft, photoUrl: event.target.value })
                }
              />
            </Field>

            <label className="flex items-center gap-3 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) =>
                  setDraft({ ...draft, active: event.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
              />
              Visible en el sitio y disponible para reservas
            </label>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="pill-outline flex-1"
              >
                Cancelar
              </button>
              <button type="submit" disabled={busy} className="pill-primary flex-1">
                {busy ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
