'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { api } from '@/lib/api-client';
import type { BarberPortfolioImage } from '@/lib/types';

interface BarberPortfolioPanelProps {
  barberId: string;
  barberName: string;
}

const MAX_IMAGES = 5;
const ALLOWED_PHOTO_TYPES = new Set(['image/png', 'image/jpeg']);

export function BarberPortfolioPanel({ barberId, barberName }: BarberPortfolioPanelProps) {
  const [images, setImages] = useState<BarberPortfolioImage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const { images: list } = await api.barbers.portfolio.list(barberId);
      setImages(list);
    } finally {
      setLoading(false);
    }
  }, [barberId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      setError('Sólo se permiten imágenes PNG, JPG o JPEG');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { image } = await api.barbers.portfolio.add(barberId, file);
      setImages((prev) => [...prev, image]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo agregar la imagen');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async (image: BarberPortfolioImage): Promise<void> => {
    const confirmed = window.confirm('¿Eliminar esta imagen del portafolio?');
    if (!confirmed) return;

    try {
      await api.barbers.portfolio.remove(barberId, image.id);
      setImages((prev) => prev.filter((img) => img.id !== image.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar la imagen');
    }
  };

  const atMax = images.length >= MAX_IMAGES;

  return (
    <div className="mt-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-ink">
            Portafolio de {barberName}
          </h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            {images.length} de {MAX_IMAGES} imágenes · Se muestran en la página principal al pasar el mouse
          </p>
        </div>
      </div>

      {/* Grid de imágenes */}
      {loading ? (
        <p className="py-8 text-center text-sm text-ink-muted">Cargando imágenes…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          <AnimatePresence>
            {images.map((img, index) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
                className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-gray-100 bg-gray-50"
              >
                <img
                  src={img.imageUrl}
                  alt={`Foto ${index + 1} de ${barberName}`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />

                {/* Número de orden */}
                <span className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[10px] font-bold text-white backdrop-blur-sm">
                  {index + 1}
                </span>

                {/* Botón eliminar */}
                <button
                  type="button"
                  onClick={() => handleRemove(img)}
                  aria-label="Eliminar imagen"
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </motion.div>
            ))}

            {/* Slot vacío */}
            {images.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center"
              >
                <svg className="mx-auto mb-3 text-gray-300" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p className="text-sm font-medium text-ink-muted">Sin imágenes aún</p>
                <p className="mt-1 text-xs text-ink-muted">Agregá fotos de tus trabajos abajo</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Selector de archivo para agregar nueva imagen */}
      {!atMax && (
        <div>
          <label htmlFor={`portfolio-photo-${barberId}`} className="sr-only">
            Agregar foto al portafolio
          </label>
          <input
            ref={fileInputRef}
            id={`portfolio-photo-${barberId}`}
            type="file"
            accept="image/png,image/jpeg"
            disabled={busy}
            onChange={handleAdd}
            className="w-full text-xs text-ink-soft file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-600 disabled:opacity-60"
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            {busy ? 'Subiendo…' : 'PNG, JPG o JPEG, hasta 5 MB.'}
          </p>
        </div>
      )}

      {atMax && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Llegaste al máximo de {MAX_IMAGES} imágenes. Eliminá una para poder agregar otra.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
