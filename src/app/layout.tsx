import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';

import { BRAND } from '@/lib/brand';

import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://chivasbarberiaclub.com'),
  title: {
    default: `${BRAND.name} — Barbería en Av. San Juan, CABA`,
    template: `%s · ${BRAND.name}`,
  },
  description:
    'Barbería de autor en Av. San Juan 2454, CABA. Cortes, fades, barba y afeitado clásico. Reservá tu turno online en segundos.',
  keywords: [
    'barbería',
    'barbería Buenos Aires',
    'corte de pelo CABA',
    'fade',
    'afeitado clásico',
    'turnos barbería',
  ],
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    title: BRAND.name,
    description: BRAND.tagline,
    siteName: BRAND.name,
    images: [{ url: '/barberia.jpg', width: 1200, height: 630, alt: BRAND.name }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0066FF',
  width: 'device-width',
  initialScale: 1,
};

/** Datos estructurados para Google (barbería local). */
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HairSalon',
  name: BRAND.name,
  telephone: BRAND.phone,
  address: {
    '@type': 'PostalAddress',
    streetAddress: BRAND.street,
    addressLocality: BRAND.city,
    postalCode: BRAND.postalCode,
    addressCountry: 'AR',
  },
  openingHours: 'Mo-Sa 10:00-20:00',
  priceRange: '$$',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={jakarta.variable}>
      <body className="min-h-dvh bg-white font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
