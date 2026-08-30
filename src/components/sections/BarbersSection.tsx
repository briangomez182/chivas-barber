'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { BarberAvatar } from '@/components/ui/BarberAvatar';
import type { Barber, BarberPortfolioImage } from '@/lib/types';

interface BarbersSectionProps {
  barbers: Barber[];
  /** Selecciona el barbero y hace scroll hasta la agenda. */
  onSelect: (barberId: string) => void;
}

// ---------------------------------------------------------------------------
// Carrusel de portafolio que aparece al hover sobre la tarjeta del barbero
// ---------------------------------------------------------------------------

interface PortfolioCarouselProps {
  images: BarberPortfolioImage[];
  barberName: string;
}

function PortfolioCarousel({ images, barberName }: PortfolioCarouselProps) {
  const [current, setCurrent] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = images.length;

  const go = useCallback(
    (direction: 1 | -1) => {
      setCurrent((prev) => (prev + direction + total) % total);
    },
    [total],
  );

  // Avance automático cada 2.5 s mientras el carrusel está visible.
  useEffect(() => {
    if (total <= 1) return;
    timerRef.current = setInterval(() => go(1), 2500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [go, total]);

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => go(1), 2500);
  };

  const goTo = (index: number) => {
    setCurrent(index);
    resetTimer();
  };

  if (total === 0) return null;

  return (
    <div className="pointer-events-auto relative h-full w-full overflow-hidden rounded-2xl">
      {/* Imágenes */}
      <AnimatePresence initial={false} mode="sync">
        <motion.img
          key={images[current].id}
          src={images[current].imageUrl}
          alt={`Trabajo de ${barberName} — foto ${current + 1}`}
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </AnimatePresence>

      {/* Degradado inferior */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Botones prev/next */}
      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
              resetTimer();
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            aria-label="Foto siguiente"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
              resetTimer();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          >
            <ChevronRightIcon />
          </button>
        </>
      )}

      {/* Dots */}
      {total > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              aria-label={`Ir a foto ${i + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                goTo(i);
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current
                  ? 'w-4 bg-white'
                  : 'w-1.5 bg-white/50 hover:bg-white/75'
              }`}
            />
          ))}
        </div>
      )}

      {/* Contador */}
      <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-bold text-white/90 backdrop-blur-sm">
        {current + 1}/{total}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Íconos inline (sin dependencia extra)
// ---------------------------------------------------------------------------

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta de barbero con carrusel hover
// ---------------------------------------------------------------------------

interface BarberCardProps {
  barber: Barber;
  index: number;
  onSelect: (id: string) => void;
}

function BarberCard({ barber, index, onSelect }: BarberCardProps) {
  const [hovered, setHovered] = useState<boolean>(false);
  const images = barber.portfolioImages ?? [];
  const hasImages = images.length > 0;

  return (
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
      className="card relative flex flex-col items-center overflow-hidden p-8 text-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Carrusel de portafolio — overlay en hover */}
      <AnimatePresence>
        {hovered && hasImages && (
          <motion.div
            key="carousel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-10"
          >
            <PortfolioCarousel images={images} barberName={barber.name} />

            {/* Botón de reserva sobre el overlay */}
            <div className="absolute inset-x-4 bottom-4 z-20">
              <button
                type="button"
                onClick={() => onSelect(barber.id)}
                className="pill-primary w-full shadow-lg"
              >
                Reservar con {barber.name}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contenido normal de la tarjeta */}
      <motion.div
        animate={{ scale: hovered && hasImages ? 0.92 : 1, opacity: hovered && hasImages ? 0.15 : 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center"
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

        {/* Indicador de portafolio */}
        {hasImages && (
          <p className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-ink-muted">
            <PhotoIcon />
            {images.length} foto{images.length !== 1 ? 's' : ''} · Pasá el mouse para ver
          </p>
        )}

        <button
          type="button"
          onClick={() => onSelect(barber.id)}
          className="pill-primary mt-7 w-full"
        >
          Reservar con {barber.name}
        </button>
      </motion.div>
    </motion.article>
  );
}

function PhotoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sección principal
// ---------------------------------------------------------------------------

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
            <BarberCard
              key={barber.id}
              barber={barber}
              index={index}
              onSelect={onSelect}
            />
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
