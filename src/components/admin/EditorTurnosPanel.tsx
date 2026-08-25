'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import { Field } from '@/components/ui/Field';
import { Logo } from '@/components/layout/Logo';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api-client';
import { formatDuration, formatLongDate, todayIso } from '@/lib/date';
import type { Appointment, Barber, Service } from '@/lib/types';

interface EditorTurnosPanelProps {
  editorName: string;
  barber: Barber;
  services: Service[];
}

const STATUS_STYLES: Record<Appointment['status'], string> = {
  confirmed: 'bg-brand-50 text-brand',
  pending: 'bg-amber-50 text-amber-600',
  pending_payment: 'bg-orange-50 text-orange-600',
  done: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-gray-100 text-ink-muted line-through',
};

const STATUS_LABELS: Record<Appointment['status'], string> = {
  confirmed: 'Confirmado',
  pending: 'Pendiente',
  pending_payment: 'Esperando pago',
  done: 'Atendido',
  cancelled: 'Cancelado',
};

interface RescheduleDraft {
  appointment: Appointment;
  date: string;
  time: string;
}

interface NewDraft {
  serviceId: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  notes: string;
}

const EMPTY_NEW: NewDraft = {
  serviceId: '',
  date: todayIso(),
  time: '',
  customerName: '',
  customerPhone: '',
  notes: '',
};

export function EditorTurnosPanel({ editorName, barber, services }: EditorTurnosPanelProps) {
  const router = useRouter();

  const [date, setDate] = useState<string>(todayIso());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [reschedule, setReschedule] = useState<RescheduleDraft | null>(null);
  const [newDraft, setNewDraft] = useState<NewDraft | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const { appointments: list } = await api.appointments.list(date);
      setAppointments(list);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const logout = async (): Promise<void> => {
    await api.auth.logout();
    router.push('/login');
    router.refresh();
  };

  const serviceName = (id: string | null): string =>
    id ? (services.find((item) => item.id === id)?.name ?? '—') : 'Sin servicio';

  const setStatus = async (
    appointment: Appointment,
    status: Appointment['status'],
  ): Promise<void> => {
    const { appointment: updated } = await api.appointments.setStatus(appointment.id, status);
    setAppointments((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  };

  const saveReschedule = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!reschedule) return;

    setBusy(true);
    setError(null);
    try {
      const { appointment: updated } = await api.appointments.reschedule(
        reschedule.appointment.id,
        { date: reschedule.date, time: reschedule.time },
      );
      setAppointments((current) =>
        updated.date === date
          ? current.map((item) => (item.id === updated.id ? updated : item))
          : current.filter((item) => item.id !== updated.id),
      );
      setReschedule(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo reagendar');
    } finally {
      setBusy(false);
    }
  };

  const saveNew = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!newDraft) return;

    setBusy(true);
    setError(null);
    try {
      await api.appointments.create({
        serviceId: newDraft.serviceId || null,
        date: newDraft.date,
        time: newDraft.time,
        customerName: newDraft.customerName,
        customerPhone: newDraft.customerPhone,
        notes: newDraft.notes || null,
      });
      setNewDraft(null);
      if (newDraft.date === date) void load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el turno');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/85 backdrop-blur-xl">
        <div className="container-page flex h-[72px] items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Logo />
            <span className="hidden rounded-full bg-ink px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white sm:inline-block">
              {barber.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-soft sm:inline">
              Hola, <strong className="font-semibold text-ink">{editorName}</strong>
            </span>
            <Link href="/" className="pill-ghost text-sm">
              Ver sitio
            </Link>
            <button type="button" onClick={logout} className="pill-outline text-sm">
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="container-page py-12">
        <section aria-labelledby="editor-appointments-title">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1
                id="editor-appointments-title"
                className="text-xl font-extrabold tracking-[-0.02em] text-ink"
              >
                Mis turnos
              </h1>
              <p className="mt-1 text-sm text-ink-soft">{formatLongDate(date)}</p>
            </div>

            <div className="flex items-end gap-3">
              <label htmlFor="filter-date" className="sr-only">
                Fecha
              </label>
              <input
                id="filter-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-auto rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
              />
              <button
                type="button"
                onClick={() => setNewDraft({ ...EMPTY_NEW, date })}
                className="pill-primary"
              >
                + Turno manual
              </button>
            </div>
          </header>

          <div className="card mt-7 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Mis turnos del día seleccionado</caption>
              <thead className="border-b border-gray-100 bg-gray-50/60">
                <tr className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">
                  <th scope="col" className="px-6 py-4">Hora</th>
                  <th scope="col" className="px-6 py-4">Cliente</th>
                  <th scope="col" className="px-6 py-4">Servicio</th>
                  <th scope="col" className="px-6 py-4">Estado</th>
                  <th scope="col" className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-ink-muted">
                      Cargando turnos…
                    </td>
                  </tr>
                )}

                {!loading && appointments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-ink-soft">
                      No tenés turnos para esta fecha.
                    </td>
                  </tr>
                )}

                {!loading &&
                  appointments.map((appointment, index) => (
                    <motion.tr
                      key={appointment.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <p className="font-bold text-ink">{appointment.time}</p>
                        <p className="text-xs text-ink-muted">
                          {formatDuration(appointment.durationMin)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-ink">{appointment.customerName}</p>
                        <a
                          href={`tel:${appointment.customerPhone}`}
                          className="text-xs text-brand hover:underline"
                        >
                          {appointment.customerPhone}
                        </a>
                      </td>
                      <td className="px-6 py-4 text-ink-soft">
                        {serviceName(appointment.serviceId)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[appointment.status]}`}
                        >
                          {STATUS_LABELS[appointment.status]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        {appointment.status !== 'done' && (
                          <button
                            type="button"
                            onClick={() => setStatus(appointment, 'done')}
                            className="pill-ghost px-3 py-1.5 text-xs"
                          >
                            Atendido
                          </button>
                        )}
                        {appointment.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => setStatus(appointment, 'cancelled')}
                            className="pill-ghost px-3 py-1.5 text-xs"
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setReschedule({
                              appointment,
                              date: appointment.date,
                              time: appointment.time,
                            })
                          }
                          className="pill-ghost px-3 py-1.5 text-xs"
                        >
                          Reagendar
                        </button>
                      </td>
                    </motion.tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Modal
        open={reschedule !== null}
        title="Reagendar turno"
        onClose={() => setReschedule(null)}
      >
        {reschedule && (
          <form onSubmit={saveReschedule} className="space-y-5">
            <Field label="Fecha" htmlFor="reschedule-date">
              <input
                id="reschedule-date"
                type="date"
                required
                value={reschedule.date}
                onChange={(event) =>
                  setReschedule({ ...reschedule, date: event.target.value })
                }
              />
            </Field>
            <Field label="Hora" htmlFor="reschedule-time">
              <input
                id="reschedule-time"
                type="time"
                required
                value={reschedule.time}
                onChange={(event) =>
                  setReschedule({ ...reschedule, time: event.target.value })
                }
              />
            </Field>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReschedule(null)}
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

      <Modal open={newDraft !== null} title="Turno manual" onClose={() => setNewDraft(null)}>
        {newDraft && (
          <form onSubmit={saveNew} className="space-y-5">
            <Field label="Servicio" htmlFor="new-service">
              <select
                id="new-service"
                value={newDraft.serviceId}
                onChange={(event) =>
                  setNewDraft({ ...newDraft, serviceId: event.target.value })
                }
              >
                <option value="">Sin servicio</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fecha" htmlFor="new-date">
              <input
                id="new-date"
                type="date"
                required
                value={newDraft.date}
                onChange={(event) => setNewDraft({ ...newDraft, date: event.target.value })}
              />
            </Field>
            <Field label="Hora" htmlFor="new-time">
              <input
                id="new-time"
                type="time"
                required
                value={newDraft.time}
                onChange={(event) => setNewDraft({ ...newDraft, time: event.target.value })}
              />
            </Field>
            <Field label="Cliente" htmlFor="new-customer-name">
              <input
                id="new-customer-name"
                type="text"
                required
                value={newDraft.customerName}
                onChange={(event) =>
                  setNewDraft({ ...newDraft, customerName: event.target.value })
                }
              />
            </Field>
            <Field label="Teléfono" htmlFor="new-customer-phone">
              <input
                id="new-customer-phone"
                type="tel"
                required
                value={newDraft.customerPhone}
                onChange={(event) =>
                  setNewDraft({ ...newDraft, customerPhone: event.target.value })
                }
              />
            </Field>
            <Field label="Notas" htmlFor="new-notes">
              <input
                id="new-notes"
                type="text"
                value={newDraft.notes}
                onChange={(event) => setNewDraft({ ...newDraft, notes: event.target.value })}
              />
            </Field>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setNewDraft(null)}
                className="pill-outline flex-1"
              >
                Cancelar
              </button>
              <button type="submit" disabled={busy} className="pill-primary flex-1">
                {busy ? 'Guardando…' : 'Crear turno'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
