'use client';

import { motion } from 'framer-motion';

import { BarberAvatar } from '@/components/ui/BarberAvatar';
import { formatDuration, formatPrice } from '@/lib/date';
import type { Barber, Service } from '@/lib/types';

interface ServicesSectionProps {
  barbers: Barber[];
  services: Service[];
}

/**
 * Carta de servicios agrupada por barbero: cada barbero tiene su propia lista
 * (nombre, descripción y precio propios). Se muestra sólo a los barberos que
 * tienen al menos un servicio cargado.
 */
export function ServicesSection({ barbers, services }: ServicesSectionProps) {
  const groups = barbers
    .map((barber) => ({
      barber,
      services: services.filter((service) => service.barberId === barber.id),
    }))
    .filter((group) => group.services.length > 0);

  return (
    <section
      id="servicios"
      aria-labelledby="servicios-title"
      className="border-t border-gray-100 bg-white py-24 lg:py-32"
    >
      <div className="container-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Carta</p>
            <h2 id="servicios-title" className="section-title mt-3">
              Servicios
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            Cada barbero arma su propia carta. Precios finales; la duración de
            cada servicio define los bloques disponibles en la agenda.
          </p>
        </div>

        {groups.length === 0 ? (
          <p className="mt-12 rounded-2xl bg-gray-50 p-8 text-center text-sm text-ink-soft">
            Todavía no hay servicios cargados. Se dan de alta desde el panel de
            administración, dentro de cada barbero.
          </p>
        ) : (
          <div className="mt-14 space-y-16">
            {groups.map((group, groupIndex) => (
              <motion.div
                key={group.barber.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{
                  duration: 0.5,
                  delay: groupIndex * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <div className="flex items-center gap-3">
                  <BarberAvatar
                    name={group.barber.name}
                    photoUrl={group.barber.photoUrl}
                    size={40}
                  />
                  <div>
                    <h3 className="text-lg font-extrabold tracking-[-0.02em] text-ink">
                      {group.barber.name}
                    </h3>
                    {group.barber.role && (
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">
                        {group.barber.role}
                      </p>
                    )}
                  </div>
                </div>

                <ul className="mt-6 divide-y divide-gray-100 border-y border-gray-100">
                  {group.services.map((service) => (
                    <li key={service.id}>
                      <article className="grid gap-2 py-6 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8">
                        <div>
                          <h4 className="text-lg font-bold tracking-[-0.02em] text-ink">
                            {service.name}
                          </h4>
                          {service.description && (
                            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-soft">
                              {service.description}
                            </p>
                          )}
                        </div>

                        <p className="flex items-baseline gap-2 text-brand sm:justify-end">
                          <span className="text-sm font-semibold">
                            {formatDuration(service.durationMin)}
                          </span>
                          <span aria-hidden="true" className="text-ink-muted">
                            —
                          </span>
                          <span className="text-xl font-extrabold tracking-tight">
                            {formatPrice(service.price)}
                          </span>
                        </p>
                      </article>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
