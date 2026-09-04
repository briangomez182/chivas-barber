'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { CalendarIcon, CheckIcon, CopyIcon, WhatsAppIcon, XIcon } from '@/components/ui/icons';
import { Logo } from '@/components/layout/Logo';
import { Modal } from '@/components/ui/Modal';
import {
  SortableColumnHeader,
  type SortDirection,
} from '@/components/ui/SortableColumnHeader';
import { Toast } from '@/components/ui/Toast';
import { BarberPortfolioPanel } from '@/components/admin/BarberPortfolioPanel';
import { api } from '@/lib/api-client';
import { customerWhatsappLink, formatCustomerPhone } from '@/lib/brand';
import {
  formatDuration,
  formatLongDate,
  formatPrice,
  formatShortDate,
  todayIso,
} from '@/lib/date';
import { compareSortValues } from '@/lib/sort';
import type { Appointment, Barber, ScheduleBlock, Service, Settings } from '@/lib/types';

type SortKey = 'date' | 'time' | 'customer' | 'service' | 'debt' | 'status';

interface EditorTurnosPanelProps {
  editorName: string;
  barber: Barber;
  services: Service[];
  settings: Settings;
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

interface BlockDraft {
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  reason: string;
}

const EMPTY_BLOCK: BlockDraft = {
  date: todayIso(),
  allDay: false,
  startTime: '',
  endTime: '',
  reason: '',
};

export function EditorTurnosPanel({
  editorName,
  barber,
  services,
  settings,
}: EditorTurnosPanelProps) {
  const router = useRouter();

  const [date, setDate] = useState<string>(todayIso());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const [reschedule, setReschedule] = useState<RescheduleDraft | null>(null);
  const [newDraft, setNewDraft] = useState<NewDraft | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState<boolean>(true);
  const [blockDraft, setBlockDraft] = useState<BlockDraft | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const { appointments: list, total: count } = await api.appointments.list(
        date,
        undefined,
        page,
      );
      setAppointments(list);
      setTotal(count);
    } finally {
      setLoading(false);
    }
  }, [date, page]);

  useEffect(() => {
    setPage(1);
  }, [date]);

  const loadBlocks = useCallback(async (): Promise<void> => {
    setLoadingBlocks(true);
    try {
      const { blocks: list } = await api.blocks.list(date);
      setBlocks(list);
    } finally {
      setLoadingBlocks(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    void loadBlocks();
  }, [loadBlocks]);

  const logout = async (): Promise<void> => {
    await api.auth.logout();
    router.push('/login');
    router.refresh();
  };

  const serviceName = (id: string | null): string =>
    id ? (services.find((item) => item.id === id)?.name ?? '—') : 'Sin servicio';

  /**
   * Lo que falta cobrar en el local. Sólo se resta la seña si Mercado Pago
   * la confirmó (`paymentStatus === 'approved'`) — cualquier otro estado
   * (sin pago, pendiente, rechazado) debe el servicio completo. `null`
   * cuando no hay servicio elegido (no hay precio de referencia) o el turno
   * está cancelado (no hay nada que cobrar).
   */
  const debtOf = (appointment: Appointment): number | null => {
    if (appointment.status === 'cancelled') return null;
    const service = appointment.serviceId
      ? services.find((item) => item.id === appointment.serviceId)
      : null;
    if (!service) return null;

    const depositPaid = appointment.paymentStatus === 'approved';
    return depositPaid
      ? Math.max(service.price - (appointment.amount ?? 0), 0)
      : service.price;
  };

  const debtLabel = (appointment: Appointment): string => {
    const debt = debtOf(appointment);
    return debt !== null ? formatPrice(debt) : '—';
  };

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const toggleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortValue = (appointment: Appointment, key: SortKey): string | number => {
    switch (key) {
      case 'date':
        return `${appointment.date} ${appointment.time}`;
      case 'time':
        return appointment.time;
      case 'customer':
        return appointment.customerName;
      case 'service':
        return serviceName(appointment.serviceId);
      case 'debt':
        return debtOf(appointment) ?? -1;
      case 'status':
        return STATUS_LABELS[appointment.status];
    }
  };

  const sortedAppointments = useMemo(() => {
    if (!sortKey) return appointments;
    return [...appointments].sort((a, b) =>
      compareSortValues(sortValue(a, sortKey), sortValue(b, sortKey), sortDir),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, sortKey, sortDir, services]);

  const copyPhone = async (appointment: Appointment): Promise<void> => {
    const phone = formatCustomerPhone(appointment.customerPhone);
    try {
      await navigator.clipboard.writeText(phone);
      setToast(`Teléfono de ${appointment.customerName} copiado: ${phone}`);
    } catch {
      setToast('No se pudo copiar el teléfono');
    }
  };

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

  const saveBlock = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!blockDraft) return;

    setBusy(true);
    setBlockError(null);
    try {
      await api.blocks.create({
        date: blockDraft.date,
        startTime: blockDraft.allDay ? null : blockDraft.startTime,
        endTime: blockDraft.allDay ? null : blockDraft.endTime,
        reason: blockDraft.reason,
      });
      const schedule = blockDraft.allDay
        ? 'todo el día'
        : `de ${blockDraft.startTime} a ${blockDraft.endTime}`;
      setToast(
        `${barber.name} tiene bloqueado ${schedule} el ${formatLongDate(blockDraft.date)} por: ${blockDraft.reason}`,
      );
      setBlockDraft(null);
      if (blockDraft.date === date) void loadBlocks();
    } catch (cause) {
      setBlockError(cause instanceof Error ? cause.message : 'No se pudo bloquear el horario');
    } finally {
      setBusy(false);
    }
  };

  const removeBlock = async (block: ScheduleBlock): Promise<void> => {
    await api.blocks.remove(block.id);
    setBlocks((current) => current.filter((item) => item.id !== block.id));
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
              <p className="mt-1 text-sm text-ink-soft">
                {date ? formatLongDate(date) : 'Todas las fechas'}
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end">
              <label htmlFor="filter-date" className="sr-only">
                Fecha
              </label>
              <input
                id="filter-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm sm:w-auto"
              />
              <button
                type="button"
                onClick={() => setNewDraft({ ...EMPTY_NEW, date: date || todayIso() })}
                className="pill-primary w-full sm:w-auto"
              >
                + Turno manual
              </button>
            </div>
          </header>

          {loading && (
            <div className="card mt-7 px-6 py-12 text-center text-sm text-ink-muted">
              Cargando turnos…
            </div>
          )}

          {!loading && appointments.length === 0 && (
            <div className="card mt-7 px-6 py-12 text-center text-sm text-ink-soft">
              No tenés turnos para esta fecha.
            </div>
          )}

          {!loading && appointments.length > 0 && (
            <>
              {/* Tabla: desde lg hacia arriba, donde entran todas las columnas sin scroll. */}
              <div className="card mt-7 hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Mis turnos del día seleccionado</caption>
                  <thead className="border-b border-gray-100 bg-gray-50/60">
                    <tr className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">
                      <SortableColumnHeader
                        label="Día"
                        sortKey="date"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={toggleSort}
                      />
                      <SortableColumnHeader
                        label="Hora"
                        sortKey="time"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={toggleSort}
                      />
                      <SortableColumnHeader
                        label="Cliente"
                        sortKey="customer"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={toggleSort}
                      />
                      <SortableColumnHeader
                        label="Servicio"
                        sortKey="service"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={toggleSort}
                      />
                      <SortableColumnHeader
                        label="Deuda"
                        sortKey="debt"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={toggleSort}
                      />
                      <SortableColumnHeader
                        label="Estado"
                        sortKey="status"
                        activeKey={sortKey}
                        direction={sortDir}
                        onSort={toggleSort}
                      />
                      <th scope="col" className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedAppointments.map((appointment, index) => (
                      <motion.tr
                        key={appointment.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.03 }}
                      >
                        <td className="whitespace-nowrap px-6 py-4 font-semibold text-ink">
                          {formatShortDate(appointment.date)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <p className="font-bold text-ink">{appointment.time}</p>
                          <p className="text-xs text-ink-muted">
                            {formatDuration(appointment.durationMin)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-ink">{appointment.customerName}</p>
                        </td>
                        <td className="px-6 py-4 text-ink-soft">
                          {serviceName(appointment.serviceId)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 font-semibold text-ink">
                          {debtLabel(appointment)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[appointment.status]}`}
                          >
                            {STATUS_LABELS[appointment.status]}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <IconButton
                              label={`Copiar teléfono de ${appointment.customerName}`}
                              icon={<CopyIcon />}
                              onClick={() => copyPhone(appointment)}
                            />
                            <IconButton
                              label={`WhatsApp a ${appointment.customerName}`}
                              tone="success"
                              icon={<WhatsAppIcon />}
                              href={customerWhatsappLink(appointment.customerPhone)}
                            />
                            {appointment.status !== 'done' && (
                              <IconButton
                                label="Marcar como atendido"
                                tone="success"
                                icon={<CheckIcon />}
                                onClick={() => setStatus(appointment, 'done')}
                              />
                            )}
                            {appointment.status !== 'cancelled' && (
                              <IconButton
                                label="Cancelar turno"
                                icon={<XIcon />}
                                onClick={() => setStatus(appointment, 'cancelled')}
                              />
                            )}
                            <IconButton
                              label="Reagendar turno"
                              tone="brand"
                              icon={<CalendarIcon />}
                              onClick={() =>
                                setReschedule({
                                  appointment,
                                  date: appointment.date,
                                  time: appointment.time,
                                })
                              }
                            />
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tarjetas: mobile y tablet, para no tener que scrollear horizontal. */}
              <div className="mt-7 space-y-3 lg:hidden">
                {sortedAppointments.map((appointment, index) => (
                  <motion.div
                    key={appointment.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                    className="card p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-bold text-ink">
                        {formatShortDate(appointment.date)} · {appointment.time}
                      </p>
                      <span
                        className={`inline-block shrink-0 rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[appointment.status]}`}
                      >
                        {STATUS_LABELS[appointment.status]}
                      </span>
                    </div>

                    <p className="mt-3 font-semibold text-ink">{appointment.customerName}</p>

                    <div className="mt-3 border-t border-gray-100 pt-3 text-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">
                        Deuda
                      </p>
                      <p className="mt-1 font-semibold text-ink">{debtLabel(appointment)}</p>
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-1 border-t border-gray-100 pt-3">
                      <IconButton
                        label={`Copiar teléfono de ${appointment.customerName}`}
                        icon={<CopyIcon />}
                        onClick={() => copyPhone(appointment)}
                      />
                      <IconButton
                        label={`WhatsApp a ${appointment.customerName}`}
                        tone="success"
                        icon={<WhatsAppIcon />}
                        href={customerWhatsappLink(appointment.customerPhone)}
                      />
                      {appointment.status !== 'done' && (
                        <IconButton
                          label="Marcar como atendido"
                          tone="success"
                          icon={<CheckIcon />}
                          onClick={() => setStatus(appointment, 'done')}
                        />
                      )}
                      {appointment.status !== 'cancelled' && (
                        <IconButton
                          label="Cancelar turno"
                          icon={<XIcon />}
                          onClick={() => setStatus(appointment, 'cancelled')}
                        />
                      )}
                      <IconButton
                        label="Reagendar turno"
                        tone="brand"
                        icon={<CalendarIcon />}
                        onClick={() =>
                          setReschedule({
                            appointment,
                            date: appointment.date,
                            time: appointment.time,
                          })
                        }
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}

          {total > 0 && (
            <div
              className={`mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-soft ${
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
        </section>

        <section aria-labelledby="editor-blocks-title" className="mt-12">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2
                id="editor-blocks-title"
                className="text-xl font-extrabold tracking-[-0.02em] text-ink"
              >
                Disponibilidad
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                Bloqueos de tu agenda para {date ? formatLongDate(date) : 'todas las fechas'} —
                nadie puede reservarte en esos horarios.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBlockDraft({ ...EMPTY_BLOCK, date: date || todayIso() })}
              className="pill-outline"
            >
              + Bloquear horario
            </button>
          </header>

          <div className="card mt-5 divide-y divide-gray-100">
            {loadingBlocks && (
              <p className="px-6 py-6 text-center text-sm text-ink-muted">Cargando…</p>
            )}
            {!loadingBlocks && blocks.length === 0 && (
              <p className="px-6 py-6 text-center text-sm text-ink-soft">
                No tenés bloqueos para esta fecha.
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
        </section>

        <section aria-labelledby="editor-portfolio-title" className="mt-12">
          <header>
            <h2
              id="editor-portfolio-title"
              className="text-xl font-extrabold tracking-[-0.02em] text-ink"
            >
              Mi portafolio
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Estas fotos aparecen en la página principal cuando los clientes pasan el mouse sobre tu tarjeta.
            </p>
          </header>

          <div className="card mt-5 p-6">
            <BarberPortfolioPanel barberId={barber.id} barberName={barber.name} />
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

      <Modal
        open={blockDraft !== null}
        title="Bloquear horario"
        onClose={() => setBlockDraft(null)}
      >
        {blockDraft && (
          <form onSubmit={saveBlock} className="space-y-5">
            <Field label="Fecha" htmlFor="block-date">
              <input
                id="block-date"
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
                <Field label="Desde" htmlFor="block-start">
                  <input
                    id="block-start"
                    type="time"
                    required={!blockDraft.allDay}
                    value={blockDraft.startTime}
                    onChange={(event) =>
                      setBlockDraft({ ...blockDraft, startTime: event.target.value })
                    }
                  />
                </Field>
                <Field label="Hasta" htmlFor="block-end">
                  <input
                    id="block-end"
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

            <Field label="Motivo" htmlFor="block-reason">
              <input
                id="block-reason"
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
              <button type="submit" disabled={busy} className="pill-primary flex-1">
                {busy ? 'Guardando…' : 'Bloquear'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
