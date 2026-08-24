'use client';

import { motion } from 'framer-motion';

import { BarberAvatar } from '@/components/ui/BarberAvatar';
import type { Barber } from '@/lib/types';

interface BarbersSectionProps {
  barbers: Barber[];
  /** Selecciona el barbero y hace scroll hasta la agenda. */
  onSelect: (barberId: string) => void;
}

export function BarbersSection({ barbers, onSelect }: BarbersSectionProps) {
  return (
    <section
      id="barberos"
      aria-labelledby="barberos-title"
      className="border-t border-gray-100 bg-gray-50 py-24 lg:py-32"
    >
      <div className="container-page">
        <div className="max-w-xl">
          <p className="eyebrow">El equipo</p>
          <h2 id="barberos-title" className="section-title mt-3">
            Barberos del club
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            Elegí con quién querés atenderte. Cada barbero tiene su propia
            agenda y disponibilidad en tiempo real.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {barbers.map((barber, index) => (
            <motion.article
              key={barber.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{
                duration: 0.55,
                delay: index * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={{ y: -4 }}
              className="card flex flex-col items-center p-8 text-center"
            >
              <BarberAvatar name={barber.name} photoUrl={barber.photoUrl} size={128} />

              <h3 className="mt-6 text-xl font-extrabold tracking-[-0.02em] text-ink">
                {barber.name}
              </h3>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-brand">
                {barber.role}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {barber.specialty}
              </p>

              <button
                type="button"
                onClick={() => onSelect(barber.id)}
                className="pill-primary mt-7 w-full"
              >
                Reservar con {barber.name}
              </button>
            </motion.article>
          ))}
        </div>

        {barbers.length === 0 && (
          <p className="mt-12 rounded-2xl bg-white p-8 text-center text-sm text-ink-soft">
            No hay barberos activos por el momento.
          </p>
        )}
      </div>
    </section>
  );
}
