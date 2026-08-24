'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

import { Logo } from '@/components/layout/Logo';
import { BRAND, TEL_LINK } from '@/lib/brand';

/**
 * 404 interactiva: el "404" tiene parallax con el cursor y un halo azul
 * que lo persigue. Sin WebGL — puro CSS + Framer Motion.
 */
export default function NotFound() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState<boolean>(false);

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);

  const springX = useSpring(pointerX, { stiffness: 120, damping: 18, mass: 0.6 });
  const springY = useSpring(pointerY, { stiffness: 120, damping: 18, mass: 0.6 });

  const tiltX = useTransform(springY, [-0.5, 0.5], [8, -8]);
  const tiltY = useTransform(springX, [-0.5, 0.5], [-12, 12]);
  const glowX = useTransform(springX, [-0.5, 0.5], ['-30%', '30%']);
  const glowY = useTransform(springY, [-0.5, 0.5], ['-30%', '30%']);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent): void => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return;

      pointerX.set((event.clientX - bounds.left) / bounds.width - 0.5);
      pointerY.set((event.clientY - bounds.top) / bounds.height - 0.5);
    };

    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [pointerX, pointerY]);

  return (
    <main
      ref={containerRef}
      className="relative flex min-h-dvh flex-col overflow-hidden bg-gray-50"
    >
      <div className="container-page flex h-[72px] items-center">
        <Logo />
      </div>

      {/* Halo azul que sigue al cursor */}
      <motion.div
        aria-hidden="true"
        style={{ x: glowX, y: glowY }}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/20 blur-[120px]"
      />

      <div className="container-page relative flex flex-1 flex-col items-center justify-center py-20 text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="eyebrow"
        >
          Error 404
        </motion.p>

        <motion.div
          style={{ rotateX: tiltX, rotateY: tiltY, transformPerspective: 1000 }}
          onHoverStart={() => setHovering(true)}
          onHoverEnd={() => setHovering(false)}
          className="mt-4 select-none"
        >
          <motion.h1
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className={`text-[26vw] font-extrabold leading-[0.8] tracking-[-0.06em] transition-colors duration-500 sm:text-[16rem] ${
              hovering ? 'text-brand' : 'text-ink'
            }`}
          >
            404
          </motion.h1>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-8 text-balance text-2xl font-extrabold tracking-[-0.03em] text-ink sm:text-3xl"
        >
          Esta página se fue al ras cero.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22 }}
          className="mt-4 max-w-md text-balance text-sm leading-relaxed text-ink-soft"
        >
          No encontramos lo que buscabas, pero tu turno en {BRAND.shortName} sigue
          disponible.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link href="/" className="pill-primary px-7 py-3">
            Volver al inicio
          </Link>
          <Link href="/#agenda" className="pill-outline px-7 py-3">
            Reservar un turno
          </Link>
        </motion.div>

        <motion.address
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-14 not-italic text-xs leading-relaxed text-ink-muted"
        >
          {BRAND.street} · {BRAND.city}
          <br />
          <a href={TEL_LINK} className="text-brand hover:underline">
            {BRAND.phoneDisplay}
          </a>
        </motion.address>
      </div>
    </main>
  );
}
