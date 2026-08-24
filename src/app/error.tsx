'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Boundary global de errores del App Router. */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[chivas] error de render:', error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-gray-50 px-6">
      <div className="max-w-md text-center">
        <p className="eyebrow">Algo salió mal</p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.03em] text-ink">
          Se nos trabó la máquina.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Ocurrió un error inesperado. Podés reintentar o volver al inicio.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button type="button" onClick={reset} className="pill-primary px-7 py-3">
            Reintentar
          </button>
          <Link href="/" className="pill-outline px-7 py-3">
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
