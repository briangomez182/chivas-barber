'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { api } from '@/lib/api-client';
import { formatDuration, formatLongDate, todayIso } from '@/lib/date';
import type { Appointment, Barber, Service } from '@/lib/types';

interface AppointmentsPanelProps {
  barbers: Barber[];
  services: Service[];
}

const STATUS_STYLES: Record<Appointment['status'], string> = {
  confirmed: 'bg-brand-50 text-brand',
  pending: 'bg-amber-50 text-amber-600',
  done: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-gray-100 text-ink-muted line-through',
};

const STATUS_LABELS: Record<Appointment['status'], string> = {
  confirmed: 'Confirmado',
  pending: 'Pendiente',
  done: 'Atendido',
  cancelled: 'Cancelado',
};

export function AppointmentsPanel({ barbers, services }: AppointmentsPanelProps) {
  const [date, setDate] = useState<string>(todayIso());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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
              <th scope="col" className="px-6 py-4">Estado</th>
              <th scope="col" className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-ink-muted">
                  Cargando turnos…
                </td>
              </tr>
            )}

            {!loading && appointments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-ink-soft">
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
                  <td className="whitespace-nowrap px-6 py-4 text-ink-soft">
                    {barberName(appointment.barberId)}
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
    </section>
  );
}
