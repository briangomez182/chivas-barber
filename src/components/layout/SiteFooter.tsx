import Link from 'next/link';

import { BRAND, TEL_LINK, whatsappLink } from '@/lib/brand';

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="container-page grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className="text-2xl font-extrabold tracking-[-0.03em] text-ink">
            {BRAND.name}
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
            {BRAND.tagline} Turnos online, atención personalizada y producto
            profesional.
          </p>
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noreferrer noopener"
            className="pill-primary mt-6 inline-flex"
          >
            Escribinos por WhatsApp
          </a>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">
            Visitanos
          </h2>
          <address className="mt-4 not-italic text-sm leading-relaxed text-ink-soft">
            <a
              href={BRAND.mapsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
            >
              {BRAND.street}
            </a>
            <br />
            {BRAND.postalCode}, {BRAND.city}
            <br />
            <a
              href={TEL_LINK}
              className="mt-2 inline-block text-brand underline-offset-4 hover:underline"
            >
              {BRAND.phoneDisplay}
            </a>
          </address>
        </div>

        <nav aria-label="Enlaces del pie">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">
            Navegación
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              { href: '#servicios', label: 'Servicios' },
              { href: '#barberos', label: 'Barberos' },
              { href: '#agenda', label: 'Reservar turno' },
            ].map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="text-ink-soft transition-colors hover:text-brand"
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <Link
                href="/register"
                className="text-ink-soft transition-colors hover:text-brand"
              >
                Crear cuenta
              </Link>
            </li>
            <li>
              <Link
                href="/login"
                className="text-ink-soft transition-colors hover:text-brand"
              >
                Panel de administración
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-gray-100">
        <div className="container-page flex flex-col items-start justify-between gap-2 py-6 text-xs text-ink-muted sm:flex-row sm:items-center">
          <p>
            © {year} {BRAND.name}. Todos los derechos reservados. ·{' '}
            <Link href="/terminos" className="underline-offset-2 hover:text-brand hover:underline">
              Términos y Condiciones
            </Link>
          </p>
          <p>Lunes a sábado · 10:00 — 20:00</p>
        </div>
      </div>
    </footer>
  );
}
