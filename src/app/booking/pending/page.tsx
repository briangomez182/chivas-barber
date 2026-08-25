import { Suspense } from 'react';
import type { Metadata } from 'next';

import { BookingStatusPage } from '@/components/booking/BookingStatusPage';

export const metadata: Metadata = {
  title: 'Pago pendiente',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BookingStatusPage kind="pending" />
    </Suspense>
  );
}
