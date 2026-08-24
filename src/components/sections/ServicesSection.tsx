'use client';

import { motion } from 'framer-motion';

import { formatDuration, formatPrice } from '@/lib/date';
import type { Service } from '@/lib/types';

interface ServicesSectionProps {
  services: Service[];
}

export function ServicesSection({ services }: ServicesSectionProps) {
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
            Precios finales. La duración de cada servicio define automáticamente
            los bloques disponibles en la agenda.
          </p>
        </div>

        <ul className="mt-14 divide-y divide-gray-100 border-y border-gray-100">
          {services.map((service, index) => (
            <motion.li
              key={service.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{
                duration: 0.5,
                delay: index * 0.05,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <article className="group grid gap-2 py-7 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8">
                <div>
                  <h3 className="flex flex-wrap items-center gap-3 text-xl font-bold tracking-[-0.02em] text-ink">
                    {service.name}
                    {service.featured && (
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand">
                        Más pedido
                      </span>
                    )}
                  </h3>
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
            </motion.li>
          ))}
        </ul>

        {services.length === 0 && (
          <p className="mt-12 rounded-2xl bg-gray-50 p-8 text-center text-sm text-ink-soft">
            Todavía no hay servicios cargados. Se dan de alta desde el panel de
            administración.
          </p>
        )}
      </div>
    </section>
  );
}
