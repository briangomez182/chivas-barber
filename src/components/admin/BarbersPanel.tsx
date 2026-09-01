'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { BarberAvatar } from '@/components/ui/BarberAvatar';
import { BarberPortfolioPanel } from '@/components/admin/BarberPortfolioPanel';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Toast } from '@/components/ui/Toast';
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

const ALLOWED_PHOTO_TYPES = new Set(['image/png', 'image/jpeg']);

/** Acordeón expandible con la gestión de portafolio de un barbero. */
function PortfolioAccordion({ barber }: { barber: Barber }) {
  const [open, setOpen] = useState<boolean>(false);

  return (
    <div className="border-t border-gray-100 pt-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between py-1.5 text-left text-xs font-semibold text-ink-soft transition-colors hover:text-ink"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          Portafolio de fotos
        </span>
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <BarberPortfolioPanel barberId={barber.id} barberName={barber.name} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BarbersPanel({ barbers, onChange }: BarbersPanelProps) {
  const [draft, setDraft] = useState<DraftBarber | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Barber | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const resetPhotoPick = (): void => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const openNew = (): void => {
    setError(null);
    resetPhotoPick();
    setDraft({ ...EMPTY_DRAFT });
  };

  const openEdit = (barber: Barber): void => {
    setError(null);
    resetPhotoPick();
    setDraft({
      id: barber.id,
      name: barber.name,
      role: barber.role,
      specialty: barber.specialty,
      photoUrl: barber.photoUrl,
      active: barber.active,
    });
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0] ?? null;
    if (!draft) return;

    if (!file) {
      resetPhotoPick();
      return;
    }
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      setError('Sólo se permiten imágenes PNG, JPG o JPEG');
      resetPhotoPick();
      return;
    }

    setError(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
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
        let { barber } = await api.barbers.update(draft.id, payload);
        if (photoFile) {
          ({ barber } = await api.barbers.uploadPhoto(draft.id, photoFile));
        }
        onChange(barbers.map((item) => (item.id === barber.id ? barber : item)));
      } else {
        let { barber } = await api.barbers.create(payload);
        if (photoFile) {
          ({ barber } = await api.barbers.uploadPhoto(barber.id, photoFile));
        }
        onChange([...barbers, barber]);
      }

      setDraft(null);
      resetPhotoPick();
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
      await api.barbers.remove(toDelete.id);
      onChange(barbers.filter((item) => item.id !== toDelete.id));
      setToast(`Barbero "${toDelete.name}" eliminado`);
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
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

          <div className="mt-5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
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
                onClick={() => setToDelete(barber)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50"
              >
                Eliminar
              </button>
            </div>

            {/* Portafolio expandible */}
            <PortfolioAccordion barber={barber} />
          </div>
          </motion.li>
        ))}
      </ul>

      <Modal
        open={draft !== null}
        title={draft?.id ? 'Editar barbero' : 'Nuevo barbero'}
        onClose={() => {
          setDraft(null);
          resetPhotoPick();
        }}
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
              label="Foto"
              htmlFor="barber-photo"
              hint="PNG, JPG o JPEG, hasta 5 MB. Dejalo vacío para mostrar las iniciales."
            >
              <div className="flex items-center gap-4">
                <BarberAvatar
                  name={draft.name || '—'}
                  photoUrl={photoPreview ?? draft.photoUrl}
                  size={56}
                />
                <div className="flex-1">
                  <input
                    ref={photoInputRef}
                    id="barber-photo"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handlePhotoChange}
                    className="w-full text-xs text-ink-soft file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-600"
                  />
                  {(photoPreview || draft.photoUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        resetPhotoPick();
                        setDraft({ ...draft, photoUrl: '' });
                      }}
                      className="mt-2 text-xs font-semibold text-ink-muted hover:text-red-500"
                    >
                      Quitar foto
                    </button>
                  )}
                </div>
              </div>
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
                onClick={() => {
                  setDraft(null);
                  resetPhotoPick();
                }}
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
        title="Eliminar barbero"
        description={`¿Eliminar a ${toDelete?.name}? También se borrarán sus turnos. Esta acción no se puede deshacer.`}
        busy={deleting}
        onConfirm={confirmRemove}
        onCancel={() => setToDelete(null)}
      />

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </section>
  );
}
