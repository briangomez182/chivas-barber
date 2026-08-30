'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Toast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import { formatDuration, formatLongDate, formatPrice, todayIso } from '@/lib/date';
import type { Appointment, Barber, ScheduleBlock, Service, Settings } from '@/lib/types';

interface AppointmentsPanelProps {
  barbers: Barber[];
  services: Service[];
  settings: Settings;
}

interface BlockDraft {
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  reason: string;
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

export function AppointmentsPanel({ barbers, services, settings }: AppointmentsPanelProps) {
  const [date, setDate] = useState<string>(todayIso());
  const [barberFilter, setBarberFilter] = useState<string>('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState<boolean>(false);
  const [blockDraft, setBlockDraft] = useState<BlockDraft | null>(null);
  const [blockBusy, setBlockBusy] = useState<boolean>(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const { appointments: list, total: count } = await api.appointments.list(
        date,
        barberFilter || undefined,
        page,
      );
      setAppointments(list);
      setTotal(count);
    } finally {
      setLoading(false);
    }
  }, [date, barberFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [date, barberFilter]);

  const loadBlocks = useCallback(async (): Promise<void> => {
    if (!barberFilter) {
      setBlocks([]);
      return;
    }
    setLoadingBlocks(true);
    try {
      const { blocks: list } = await api.blocks.list(date, barberFilter);
      setBlocks(list);
    } finally {
      setLoadingBlocks(false);
    }
  }, [date, barberFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    void loadBlocks();
  }, [loadBlocks]);

  const reassignBarber = async (
    appointment: Appointment,
    barberId: string,
  ): Promise<void> => {
    if (barberId === appointment.barberId) return;
    const { appointment: updated } = await api.appointments.reschedule(appointment.id, {
      barberId,
    });
    setAppointments((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  };

  const barberName = (id: string): string =>
    barbers.find((item) => item.id === id)?.name ?? 'Barbero eliminado';

  const serviceName = (id: string | null): string =>
    id ? (services.find((item) => item.id === id)?.name ?? '—') : 'Sin servicio';

  const setStatus = async (
    appointment: Appointment,
    status: Appointment['status'],
  ): Promise<void> => {
    const { appointment: updated } = await api.appointments.setStatus(
      appointment.id,
      status,
    );
    setAppointments((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  };

  const remove = async (appointment: Appointment): Promise<void> => {
    if (!window.confirm(`¿Eliminar el turno de ${appointment.customerName}?`)) {
      return;
    }
    await api.appointments.remove(appointment.id);
    setAppointments((current) =>
      current.filter((item) => item.id !== appointment.id),
    );
  };

  const openBlockForm = (): void => {
    setBlockError(null);
    setBlockDraft({ date: date || todayIso(), allDay: false, startTime: '', endTime: '', reason: '' });
  };

  const saveBlock = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!blockDraft || !barberFilter) return;

    setBlockBusy(true);
    setBlockError(null);
    try {
      await api.blocks.create({
        barberId: barberFilter,
        date: blockDraft.date,
        startTime: blockDraft.allDay ? null : blockDraft.startTime,
        endTime: blockDraft.allDay ? null : blockDraft.endTime,
        reason: blockDraft.reason,
      });
      const schedule = blockDraft.allDay
        ? 'todo el día'
        : `de ${blockDraft.startTime} a ${blockDraft.endTime}`;
      setToast(
        `${barberName(barberFilter)} tiene bloqueado ${schedule} el ${formatLongDate(blockDraft.date)} por: ${blockDraft.reason}`,
      );
      setBlockDraft(null);
      if (blockDraft.date === date) void loadBlocks();
    } catch (cause) {
      setBlockError(cause instanceof Error ? cause.message : 'No se pudo bloquear el horario');
    } finally {
      setBlockBusy(false);
    }
  };

  const removeBlock = async (block: ScheduleBlock): Promise<void> => {
    await api.blocks.remove(block.id);
    setBlocks((current) => current.filter((item) => item.id !== block.id));
  };

  return (
    <section aria-labelledby="admin-appointments-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            id="admin-appointments-title"
            className="text-xl font-extrabold tracking-[-0.02em] text-ink"
          >
            Turnos
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {date ? formatLongDate(date) : 'Todas las fechas'}
          </p>
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
          <label htmlFor="filter-barber" className="sr-only">
            Barbero
          </label>
          <select
            id="filter-barber"
            value={barberFilter}
            onChange={(event) => setBarberFilter(event.target.value)}
            className="w-auto rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
          >
            <option value="">Todos los barberos</option>
            {barbers.map((barber) => (
              <option key={barber.id} value={barber.id}>
                {barber.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => load()} className="pill-outline">
            Actualizar
          </button>
        </div>
      </header>

      <div className="card mt-7 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">Turnos del día seleccionado</caption>
          <thead className="border-b border-gray-100 bg-gray-50/60">
            <tr className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">
              <th scope="col" className="px-6 py-4">Hora</th>
              <th scope="col" className="px-6 py-4">Cliente</th>
              <th scope="col" className="px-6 py-4">Barbero</th>
              <th scope="col" className="px-6 py-4">Servicio</th>
              <th scope="col" className="px-6 py-4">Pago</th>
              <th scope="col" className="px-6 py-4">Estado</th>
              <th scope="col" className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-ink-muted">
                  Cargando turnos…
                </td>
              </tr>
            )}

            {!loading && appointments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-ink-soft">
                  No hay turnos para esta fecha.
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
                    <p className="font-semibold text-ink">
                      {appointment.customerName}
                    </p>
                    <a
                      href={`tel:${appointment.customerPhone}`}
                      className="text-xs text-brand hover:underline"
                    >
                      {appointment.customerPhone}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <label className="sr-only" htmlFor={`barber-${appointment.id}`}>
                      Barbero de {appointment.customerName}
                    </label>
                    <select
                      id={`barber-${appointment.id}`}
                      value={appointment.barberId}
                      onChange={(event) => reassignBarber(appointment, event.target.value)}
                      className="w-auto rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-ink-soft"
                    >
                      {barbers.map((barber) => (
                        <option key={barber.id} value={barber.id}>
                          {barber.name}
                        </option>
                      ))}
                      {!barbers.some((b) => b.id === appointment.barberId) && (
                        <option value={appointment.barberId}>
                          {barberName(appointment.barberId)}
                        </option>
                      )}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-ink-soft">
                    {serviceName(appointment.serviceId)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <p className="font-semibold text-ink">
                      {appointment.amount !== null ? formatPrice(appointment.amount) : '—'}
                    </p>
                    {appointment.paymentStatus && (
                      <p className="text-xs text-ink-muted">MP: {appointment.paymentStatus}</p>
                    )}
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
                      onClick={() => remove(appointment)}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </motion.tr>
              ))}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div
          className={`mt-4 flex items-center gap-2 text-sm text-ink-soft ${
            settings.showPaginationCount ? 'justify-center' : 'justify-end'
          }`}
        >
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="pill-outline px-4 py-1.5 text-xs disabled:opacity-40"
          >
            Anterior
          </button>

          {settings.showPaginationCount && (
            <ul className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                <li key={number}>
                  <button
                    type="button"
                    onClick={() => setPage(number)}
                    aria-current={number === page ? 'page' : undefined}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                      number === page
                        ? 'bg-brand text-white shadow-brand'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {number}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
            className="pill-outline px-4 py-1.5 text-xs disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}

      {barberFilter && (
        <div className="mt-10">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-extrabold tracking-[-0.02em] text-ink">
                Disponibilidad — {barberName(barberFilter)}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">
                Bloqueos de agenda para {date ? formatLongDate(date) : 'todas las fechas'}.
              </p>
            </div>
            <button type="button" onClick={openBlockForm} className="pill-outline">
              + Bloquear horario
            </button>
          </header>

          <div className="card mt-5 divide-y divide-gray-100">
            {loadingBlocks && (
              <p className="px-6 py-6 text-center text-sm text-ink-muted">Cargando…</p>
            )}
            {!loadingBlocks && blocks.length === 0 && (
              <p className="px-6 py-6 text-center text-sm text-ink-soft">
                Sin bloqueos para esta fecha.
              </p>
            )}
            {!loadingBlocks &&
              blocks.map((block) => (
                <div
                  key={block.id}
                  className="flex items-center justify-between gap-4 px-6 py-4"
                >
                  <div>
                    <p className="font-semibold text-ink">
                      {block.startTime && block.endTime
                        ? `${block.startTime} – ${block.endTime}`
                        : 'Día completo'}
                    </p>
                    {block.reason && (
                      <p className="text-xs text-ink-muted">{block.reason}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBlock(block)}
                    className="pill-ghost px-3 py-1.5 text-xs"
                  >
                    Desbloquear
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      <Modal
        open={blockDraft !== null}
        title="Bloquear horario"
        onClose={() => setBlockDraft(null)}
      >
        {blockDraft && (
          <form onSubmit={saveBlock} className="space-y-5">
            <Field label="Fecha" htmlFor="admin-block-date">
              <input
                id="admin-block-date"
                type="date"
                required
                value={blockDraft.date}
                onChange={(event) =>
                  setBlockDraft({ ...blockDraft, date: event.target.value })
                }
              />
            </Field>

            <label className="flex items-center gap-3 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={blockDraft.allDay}
                onChange={(event) =>
                  setBlockDraft({ ...blockDraft, allDay: event.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
              />
              Bloquear el día completo
            </label>

            {!blockDraft.allDay && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Desde" htmlFor="admin-block-start">
                  <input
                    id="admin-block-start"
                    type="time"
                    required={!blockDraft.allDay}
                    value={blockDraft.startTime}
                    onChange={(event) =>
                      setBlockDraft({ ...blockDraft, startTime: event.target.value })
                    }
                  />
                </Field>
                <Field label="Hasta" htmlFor="admin-block-end">
                  <input
                    id="admin-block-end"
                    type="time"
                    required={!blockDraft.allDay}
                    value={blockDraft.endTime}
                    onChange={(event) =>
                      setBlockDraft({ ...blockDraft, endTime: event.target.value })
                    }
                  />
                </Field>
              </div>
            )}

            <Field label="Motivo" htmlFor="admin-block-reason">
              <input
                id="admin-block-reason"
                type="text"
                required
                placeholder="Almuerzo, trámite…"
                value={blockDraft.reason}
                onChange={(event) =>
                  setBlockDraft({ ...blockDraft, reason: event.target.value })
                }
              />
            </Field>

            {blockError && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {blockError}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBlockDraft(null)}
                className="pill-outline flex-1"
              >
                Cancelar
              </button>
              <button type="submit" disabled={blockBusy} className="pill-primary flex-1">
                {blockBusy ? 'Guardando…' : 'Bloquear'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </section>
  );
}
