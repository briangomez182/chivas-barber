import type { MetadataRoute } from 'next';

import { BRAND } from '@/lib/brand';

/**
 * Web App Manifest — habilita "instalar como app" en Android/Chrome y es
 * requisito para las notificaciones push de la PWA (ver `public/sw.js` y
 * `lib/push.ts`). Next lo sirve en `/manifest.webmanifest`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    // Nombre bajo el ícono al instalar la PWA en Android.
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b0f1a',
    theme_color: '#0066FF',
    lang: 'es-AR',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
