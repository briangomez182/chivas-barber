'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

import { BRAND, TEL_LINK } from '@/lib/brand';

/** La escena 3D sólo se carga en el cliente: WebGL no existe en el server. */
const ClipperScene = dynamic(() => import('./ClipperScene'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200" />
  ),
});

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
} as const;

export function Hero() {
  return (
    <section
      id="inicio"
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-gray-50"
    >
      {/*
        Lienzo 3D. En mobile ocupa la franja inferior (debajo del texto);
        desde `lg` pasa a la mitad derecha y convive con la tipografía.
      */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[360px] lg:inset-0 lg:left-[42%] lg:h-auto">
        <div className="pointer-events-auto h-full w-full">
          <ClipperScene />
        </div>
      </div>

      {/* Degradado que garantiza contraste del texto sobre el canvas. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden lg:block lg:bg-gradient-to-r lg:from-gray-50 lg:via-gray-50/60 lg:to-transparent"
      />

      <div className="container-page relative z-10 flex min-h-[760px] flex-col justify-start pb-[390px] pt-16 sm:pt-20 lg:min-h-[780px] lg:justify-center lg:pb-32 lg:pt-32">
        <motion.div
          initial="hidden"
          animate="show"
          transition={{ staggerChildren: 0.09, delayChildren: 0.08 }}
          className="max-w-2xl"
        >
          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="eyebrow"
          >
            Est. Buenos Aires · San Cristóbal
          </motion.p>

          <motion.h1
            id="hero-title"
            variants={fadeUp}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 text-balance text-5xl font-extrabold leading-[0.95] tracking-[-0.045em] text-ink sm:text-7xl lg:text-[5.5rem]"
          >
            Agendá
            <br />
            tu turno
            <span className="text-brand">.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-md text-balance text-base leading-relaxed text-ink-soft sm:text-lg"
          >
            {BRAND.tagline} Cortes de precisión, fades a piel y afeitado clásico
            con toalla caliente. Reservá online en menos de un minuto.
          </motion.p>

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <a href="#agenda" className="pill-primary px-7 py-3 text-[15px]">
              Reservar ahora
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-4 w-4 fill-current"
              >
                <path d="M7.05 3.55 5.64 4.96 10.68 10l-5.04 5.04 1.41 1.41L13.5 10z" />
              </svg>
            </a>
            <a href="#servicios" className="pill-outline px-7 py-3 text-[15px]">
              Ver servicios
            </a>
          </motion.div>

          <motion.dl
            variants={fadeUp}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-gray-200 pt-8"
          >
            {[
              { value: '3+', label: 'Barberos en el club' },
              { value: '15’—60’', label: 'Turnos configurables' },
              { value: 'Lun—Sáb', label: '10:00 a 20:00' },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-2xl font-extrabold tracking-tight text-ink">
                  {stat.value}
                </dt>
                <dd className="mt-1 text-xs leading-snug text-ink-muted">
                  {stat.label}
                </dd>
              </div>
            ))}
          </motion.dl>

          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 text-sm text-ink-soft"
          >
            ¿Preferís hablar?{' '}
            <a
              href={TEL_LINK}
              className="font-semibold text-brand underline-offset-4 hover:underline"
            >
              {BRAND.phoneDisplay}
            </a>
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
