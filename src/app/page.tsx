import { Hero } from '@/components/hero/Hero';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { BookingExperience } from '@/components/sections/BookingExperience';
import { LocationSection } from '@/components/sections/LocationSection';
import { ServicesSection } from '@/components/sections/ServicesSection';
import { getSettings, listBarbers, listServices } from '@/lib/db';

/** Los datos cambian con cada reserva: la home siempre se renderiza al vuelo. */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [barbers, services, settings] = await Promise.all([
    listBarbers(),
    listServices(),
    getSettings(),
  ]);

  return (
    <>
      <SiteHeader />

      <main>
        <Hero />
        <ServicesSection services={services} />
        <BookingExperience
          barbers={barbers}
          services={services}
          settings={settings}
        />
        <LocationSection />
      </main>

      <SiteFooter />
    </>
  );
}
