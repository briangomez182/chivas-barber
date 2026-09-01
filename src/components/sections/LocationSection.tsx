import { BRAND, TEL_LINK, whatsappLink } from '@/lib/brand';

/** Sección de local + horarios, con `<address>` semántico. */
export function LocationSection() {
  const schedule: { day: string; hours: string }[] = [
    { day: 'Lunes a viernes', hours: '10:00 — 20:00' },
    { day: 'Sábados', hours: '10:00 — 20:00' },
    { day: 'Domingos', hours: 'Cerrado' },
  ];

  return (
    <section
      id="local"
      aria-labelledby="local-title"
      className="border-t border-gray-100 bg-white py-24 lg:py-32"
    >
      <div className="container-page grid gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <p className="eyebrow">Dónde estamos</p>
          <h2 id="local-title" className="section-title mt-3">
            El local
          </h2>

          <address className="mt-8 not-italic">
            <p className="text-2xl font-bold tracking-[-0.02em] text-ink">
              {BRAND.street}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {BRAND.postalCode} · {BRAND.city}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={BRAND.mapsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="pill-outline"
              >
                Cómo llegar
              </a>
              <a href={TEL_LINK} className="pill-outline">
                Llamar
              </a>
              <a
                href={whatsappLink()}
                target="_blank"
                rel="noreferrer noopener"
                className="pill-primary"
              >
                WhatsApp
              </a>
            </div>
          </address>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-gray-100 px-8 py-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-ink-muted">
              Horarios
            </h3>
          </div>
          <dl className="divide-y divide-gray-100">
            {schedule.map((item) => (
              <div
                key={item.day}
                className="flex items-center justify-between px-8 py-5"
              >
                <dt className="text-sm font-semibold text-ink">{item.day}</dt>
                <dd
                  className={`text-sm font-medium ${
                    item.hours === 'Cerrado' ? 'text-ink-muted' : 'text-brand'
                  }`}
                >
                  {item.hours}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
