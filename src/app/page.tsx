import { Hero } from '@/components/hero/Hero';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { BookingExperience } from '@/components/sections/BookingExperience';
import { LocationSection } from '@/components/sections/LocationSection';
import { ServicesSection } from '@/components/sections/ServicesSection';
import { getSettings, listBarberPortfolioImages, listBarbers, listServices } from '@/lib/db';

/** Los datos cambian con cada reserva: la home siempre se renderiza al vuelo. */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [barbers, services, settings] = await Promise.all([
    listBarbers(),
    listServices(),
    getSettings(),
  ]);

  // Cargamos las imágenes de portafolio de cada barbero en paralelo.
  const portfolioByBarber = await Promise.all(
    barbers.map((barber) => listBarberPortfolioImages(barber.id)),
  );

  const barbersWithPortfolio = barbers.map((barber, index) => ({
    ...barber,
    portfolioImages: portfolioByBarber[index],
  }));

  return (
    <>
      <SiteHeader />

      <main>
        <Hero />
        <ServicesSection services={services} />
        <BookingExperience
          barbers={barbersWithPortfolio}
          services={services}
          settings={settings}
        />
        <LocationSection />
      </main>

      <SiteFooter />
    </>
  );
}
