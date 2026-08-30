'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api-client';
import { formatDuration, formatPrice } from '@/lib/date';
import { SLOT_INTERVALS, type Service } from '@/lib/types';

interface ServicesPanelProps {
  services: Service[];
  onChange: (services: Service[]) => void;
}

interface DraftService {
  id: string | null;
  name: string;
  description: string;
  durationMin: number;
  /**
   * Texto crudo del input de precio — no un `number`. Dos motivos para no
   * usar `type="number"` + estado numérico acá:
   *  1) Convertir a `Number(...)` en cada tecleo y usarlo como `value`
   *     "normaliza" el texto en cada keystroke (p. ej. "500" con el cursor
   *     en el medio pasa a mostrar sólo "5" al borrar un dígito).
   *  2) `type="number"` tiene comportamiento de selección/borrado
   *     inconsistente entre navegadores. El input usa `type="text"` +
   *     `inputMode="numeric"` y filtra no-dígitos a mano.
   * Se parsea a number recién al guardar.
   */
  price: string;
  featured: boolean;
}

const EMPTY_DRAFT: DraftService = {
  id: null,
  name: '',
  description: '',
  durationMin: 30,
  price: '0',
  featured: false,
};

export function ServicesPanel({ services, onChange }: ServicesPanelProps) {
  const [draft, setDraft] = useState<DraftService | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!draft) return;

    setBusy(true);
    setError(null);

    try {
      const payload = {
        name: draft.name,
        description: draft.description,
        durationMin: draft.durationMin,
        price: Number(draft.price) || 0,
        featured: draft.featured,
      };

      if (draft.id) {
        const { service } = await api.services.update(draft.id, payload);
        onChange(services.map((item) => (item.id === service.id ? service : item)));
      } else {
        const { service } = await api.services.create(payload);
        onChange([...services, service]);
      }

      setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (service: Service): Promise<void> => {
    if (!window.confirm(`¿Eliminar el servicio "${service.name}"?`)) return;
    await api.services.remove(service.id);
    onChange(services.filter((item) => item.id !== service.id));
  };

  return (
    <section aria-labelledby="admin-services-title">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2
            id="admin-services-title"
            className="text-xl font-extrabold tracking-[-0.02em] text-ink"
          >
            Servicios
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            La duración define los bloques que ve el cliente en la agenda.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setDraft({ ...EMPTY_DRAFT });
          }}
          className="pill-primary"
        >
          + Nuevo servicio
        </button>
      </header>

      <div className="card mt-7 overflow-hidden">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Listado de servicios</caption>
          <thead className="border-b border-gray-100 bg-gray-50/60">
            <tr className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">
              <th scope="col" className="px-6 py-4">Servicio</th>
              <th scope="col" className="px-6 py-4">Duración</th>
              <th scope="col" className="px-6 py-4">Precio</th>
              <th scope="col" className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {services.map((service, index) => (
              <motion.tr
                key={service.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
              >
                <td className="px-6 py-4">
                  <p className="font-bold text-ink">
                    {service.name}
                    {service.featured && (
                      <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                        Destacado
                      </span>
                    )}
                  </p>
                  {service.description && (
                    <p className="mt-0.5 max-w-md text-xs text-ink-soft">
                      {service.description}
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 font-semibold text-brand">
                  {formatDuration(service.durationMin)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 font-semibold text-ink">
                  {formatPrice(service.price)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right">
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
                        featured: service.featured,
                      });
                    }}
                    className="pill-ghost px-3 py-1.5 text-xs"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(service)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </td>
              </motion.tr>
            ))}

            {services.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-ink-soft">
                  Todavía no hay servicios cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={draft !== null}
        title={draft?.id ? 'Editar servicio' : 'Nuevo servicio'}
        onClose={() => setDraft(null)}
      >
        {draft && (
          <form onSubmit={save} className="space-y-5">
            <Field label="Nombre" htmlFor="service-name">
              <input
                id="service-name"
                type="text"
                required
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </Field>

            <Field label="Descripción" htmlFor="service-description">
              <textarea
                id="service-description"
                rows={2}
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Duración (min)" htmlFor="service-duration">
                <select
                  id="service-duration"
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

              <Field label="Precio (ARS)" htmlFor="service-price">
                <input
                  id="service-price"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={draft.price}
                  onChange={(event) =>
                    setDraft({ ...draft, price: event.target.value.replace(/[^\d]/g, '') })
                  }
                  onFocus={(event) => event.target.select()}
                />
              </Field>
            </div>

            <label className="flex items-center gap-3 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(event) =>
                  setDraft({ ...draft, featured: event.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
              />
              Marcar como &ldquo;Más pedido&rdquo;
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
