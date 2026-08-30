'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  /** Milisegundos antes de auto-ocultarse. */
  duration?: number;
}

/** Notificación breve, autodescartable, fija abajo a la derecha. */
export function Toast({ message, onDismiss, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-6 right-6 z-[70] max-w-sm rounded-2xl bg-ink px-5 py-4 text-sm font-medium text-white shadow-2xl"
        >
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-0.5 text-brand-300">
              ●
            </span>
            <p className="leading-snug">{message}</p>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Cerrar notificación"
              className="ml-auto shrink-0 text-white/60 transition-colors hover:text-white"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
