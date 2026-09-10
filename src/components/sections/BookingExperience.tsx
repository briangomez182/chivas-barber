'use client';

import { useCallback, useState } from 'react';

import { BookingWidget } from '@/components/booking/BookingWidget';
import { BarbersSection } from '@/components/sections/BarbersSection';
import { ServicesSection } from '@/components/sections/ServicesSection';
import type { Barber, Service, Settings } from '@/lib/types';

interface BookingExperienceProps {
  barbers: Barber[];
  services: Service[];
  settings: Settings;
}

/**
 * Une la grilla de barberos con el widget de agenda: al tocar
 * "Reservar con X" se preselecciona el barbero y se baja a la agenda.
 */
export function BookingExperience({
  barbers,
  services,
  settings,
}: BookingExperienceProps) {
  const [selectedBarberId, setSelectedBarberId] = useState<string>(
    barbers[0]?.id ?? '',
  );

  const selectAndScroll = useCallback((barberId: string): void => {
    setSelectedBarberId(barberId);
    document.getElementById('agenda')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <>
      <BarbersSection barbers={barbers} onSelect={selectAndScroll} />
      <ServicesSection barbers={barbers} services={services} />
      <BookingWidget
        barbers={barbers}
        services={services}
        settings={settings}
        selectedBarberId={selectedBarberId}
        onSelectBarber={setSelectedBarberId}
      />
    </>
  );
}
