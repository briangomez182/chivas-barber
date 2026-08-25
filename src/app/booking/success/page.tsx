import { Suspense } from 'react';
import type { Metadata } from 'next';

import { BookingStatusPage } from '@/components/booking/BookingStatusPage';

export const metadata: Metadata = {
  title: 'Pago aprobado',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BookingStatusPage kind="success" />
    </Suspense>
  );
}
