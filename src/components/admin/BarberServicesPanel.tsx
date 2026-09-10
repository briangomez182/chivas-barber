'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Toast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import { formatDuration, formatPrice } from '@/lib/date';
import { SLOT_INTERVALS, type Service } from '@/lib/types';

interface BarberServicesPanelProps {
  barberId: string;
  barberName: string;
  /** Se llama tras cada alta, edición o baja para que el contenedor recargue su copia. */
  onChanged?: () => void;
}

interface DraftService {
  id: string | null;
  name: string;
  description: string;
  durationMin: number;
  /** Texto crudo del input de precio — se parsea a number recién al guardar. */
  price: string;
}

const EMPTY_DRAFT: DraftService = {
  id: null,
  name: '',
  description: '',
  durationMin: 30,
  price: '0',
};

/**
 * Carta de servicios de un barbero: alta, edición y baja. Cada barbero tiene
 * su propia lista (nombre, descripción, duración y precio propios). Se
 * muestra dentro de la tarjeta del barbero en el panel de admin.
 */
export function BarberServicesPanel({
  barberId,
  barberName,
  onChanged,
}: BarberServicesPanelProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [draft, setDraft] = useState<DraftService | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const { services: list } = await api.services.list(barberId);
      setServices(list);
    } finally {
      setLoading(false);
    }
  }, [barberId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!draft) return;

    setBusy(true);
    setError(null);

    try {
      if (draft.id) {
        const { service } = await api.services.update(draft.id, {
          name: draft.name,
          description: draft.description,
          durationMin: draft.durationMin,
          price: Number(draft.price) || 0,
        });
        setServices((prev) =>
          prev.map((item) => (item.id === service.id ? service : item)),
        );
      } else {
        const { service } = await api.services.create({
          barberId,
          name: draft.name,
          description: draft.description,
          durationMin: draft.durationMin,
          price: Number(draft.price) || 0,
        });
        setServices((prev) => [...prev, service]);
      }
      setDraft(null);
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async (): Promise<void> => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.services.remove(toDelete.id);
      setServices((prev) => prev.filter((item) => item.id !== toDelete.id));
      setToast(`Servicio "${toDelete.name}" eliminado`);
      setToDelete(null);
      onChanged?.();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-ink">Servicios de {barberName}</h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            {services.length} cargado{services.length === 1 ? '' : 's'} · La
            duración define los bloques de la agenda.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setDraft({ ...EMPTY_DRAFT });
          }}
          className="pill-primary shrink-0 px-3 py-1.5 text-xs"
        >
          + Nuevo servicio
        </button>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-ink-muted">Cargando servicios…</p>
      ) : services.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-gray-200 py-8 text-center text-sm text-ink-muted">
          Este barbero todavía no tiene servicios cargados.
        </p>
      ) : (
        <ul className="space-y-2">
          {services.map((service, index) => (
            <motion.li
              key={service.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.03 }}
              className="rounded-2xl border border-gray-100 bg-white p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-ink">{service.name}</p>
                  {service.description && (
                    <p className="mt-0.5 text-xs text-ink-soft">{service.description}</p>
                  )}
                  <p className="mt-1 text-xs">
                    <span className="font-semibold text-brand">
                      {formatDuration(service.durationMin)}
                    </span>
                    <span aria-hidden="true" className="text-ink-muted"> · </span>
                    <span className="font-semibold text-ink">
                      {formatPrice(service.price)}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setDraft({
                        id: service.id,
                        name: service.name,
                        description: service.description,
                        durationMin: service.durationMin,
                        price: String(service.price),
                      });
                    }}
                    className="pill-ghost px-3 py-1.5 text-xs"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setToDelete(service)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      <Modal
        open={draft !== null}
        title={draft?.id ? 'Editar servicio' : 'Nuevo servicio'}
        onClose={() => setDraft(null)}
      >
        {draft && (
          <form onSubmit={save} className="space-y-5">
            <Field label="Nombre" htmlFor="barber-service-name">
              <input
                id="barber-service-name"
                type="text"
                required
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </Field>

            <Field label="Descripción" htmlFor="barber-service-description">
              <textarea
                id="barber-service-description"
                rows={2}
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Duración (min)" htmlFor="barber-service-duration">
                <select
                  id="barber-service-duration"
                  value={draft.durationMin}
                  onChange={(event) =>
                    setDraft({ ...draft, durationMin: Number(event.target.value) })
                  }
                >
                  {SLOT_INTERVALS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} min
                    </option>
                  ))}
                  <option value={90}>90 min</option>
                  <option value={120}>120 min</option>
                </select>
              </Field>

              <Field label="Precio (ARS)" htmlFor="barber-service-price">
                <input
                  id="barber-service-price"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={draft.price}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      price: event.target.value.replace(/[^\d]/g, ''),
                    })
                  }
                  onFocus={(event) => event.target.select()}
                />
              </Field>
            </div>

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

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar servicio"
        description={`¿Eliminar el servicio "${toDelete?.name}"? Esta acción no se puede deshacer.`}
        busy={deleting}
        onConfirm={confirmRemove}
        onCancel={() => setToDelete(null)}
      />

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
