import { Hero } from '@/components/hero/Hero';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { BookingExperience } from '@/components/sections/BookingExperience';
import { LocationSection } from '@/components/sections/LocationSection';
import { ServicesSection } from '@/components/sections/ServicesSection';
import { readDb } from '@/lib/db';

/** El store cambia con cada reserva: la home siempre se renderiza al vuelo. */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const db = await readDb();
  const barbers = db.barbers.filter((barber) => barber.active);

  return (
    <>
      <SiteHeader />

      <main>
        <Hero />
        <ServicesSection services={db.services} />
        <BookingExperience
          barbers={barbers}
          services={db.services}
          settings={db.settings}
        />
        <LocationSection />
      </main>

      <SiteFooter />
    </>
  );
}
