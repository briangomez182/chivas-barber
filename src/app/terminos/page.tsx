import type { Metadata } from 'next';
import Link from 'next/link';

import { Logo } from '@/components/layout/Logo';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Términos y Condiciones',
  description: `Términos y condiciones de uso y reserva de ${BRAND.name}.`,
};

interface Section {
  title: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    title: '1. Aceptación de los términos',
    body: (
      <p>
        Al crear una cuenta, reservar un turno o utilizar de cualquier forma
        el sitio de {BRAND.name}, aceptás estos Términos y Condiciones. Si no
        estás de acuerdo, te pedimos que no uses el sitio ni reserves turnos
        a través de él.
      </p>
    ),
  },
  {
    title: '2. Reservas de turnos',
    body: (
      <p>
        Los turnos se agendan online eligiendo barbero, servicio y horario
        disponible. Los datos de contacto (nombre, teléfono y, opcionalmente,
        email) son necesarios para confirmar la reserva y para que podamos
        comunicarnos con vos ante cualquier cambio. Es tu responsabilidad que
        esos datos sean correctos.
      </p>
    ),
  },
  {
    title: '3. Seña y pago',
    body: (
      <p>
        Cuando el cobro de seña está habilitado, la reserva online se
        confirma recién cuando Mercado Pago aprueba el pago de la seña
        indicada al momento de reservar. El monto restante del servicio se
        abona directamente en el local. La seña puede no ser reembolsable en
        caso de inasistencia sin aviso previo; consultanos por WhatsApp ante
        cualquier duda puntual sobre tu reserva.
      </p>
    ),
  },
  {
    title: '4. Cancelaciones y reprogramación',
    body: (
      <p>
        Si necesitás cancelar o reprogramar tu turno, contactanos con la
        mayor anticipación posible por WhatsApp o teléfono. Nos reservamos el
        derecho de reprogramar turnos por causas de fuerza mayor (por
        ejemplo, ausencia imprevista del barbero), avisando con la mayor
        anticipación posible.
      </p>
    ),
  },
  {
    title: '5. Cuentas de usuario',
    body: (
      <p>
        Si creás una cuenta, sos responsable de mantener la confidencialidad
        de tu contraseña y de toda actividad que ocurra bajo tu cuenta.
        Avisanos si sospechás un uso no autorizado.
      </p>
    ),
  },
  {
    title: '6. Datos personales',
    body: (
      <p>
        Los datos personales que nos proporcionás (nombre, teléfono, email)
        se utilizan exclusivamente para gestionar tus reservas y para
        comunicarnos con vos sobre ellas, conforme a la Ley N.º 25.326 de
        Protección de los Datos Personales. No compartimos tus datos con
        terceros salvo lo necesario para procesar el pago (Mercado Pago).
        Podés solicitar la baja o corrección de tus datos escribiéndonos a{' '}
        <a href={`mailto:${BRAND.email}`} className="text-brand hover:underline">
          {BRAND.email}
        </a>
        .
      </p>
    ),
  },
  {
    title: '7. Propiedad del contenido',
    body: (
      <p>
        Los textos, imágenes, logo y demás contenido del sitio pertenecen a{' '}
        {BRAND.name} o se usan con la autorización correspondiente. No está
        permitida su reproducción sin autorización previa.
      </p>
    ),
  },
  {
    title: '8. Cambios a estos términos',
    body: (
      <p>
        Podemos actualizar estos Términos y Condiciones en cualquier
        momento. Los cambios entran en vigencia desde su publicación en esta
        misma página.
      </p>
    ),
  },
  {
    title: '9. Contacto',
    body: (
      <p>
        Ante cualquier consulta sobre estos términos, escribinos a{' '}
        <a href={`mailto:${BRAND.email}`} className="text-brand hover:underline">
          {BRAND.email}
        </a>{' '}
        o visitanos en {BRAND.street}, {BRAND.city}.
      </p>
    ),
  },
];

export default function TerminosPage() {
  return (
    <>
      <header className="border-b border-gray-100">
        <div className="container-page flex h-[72px] items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            ← Volver al sitio
          </Link>
        </div>
      </header>

      <main className="container-page max-w-3xl py-16 sm:py-20">
        <p className="eyebrow">Legal</p>
        <h1 className="section-title mt-3">Términos y Condiciones</h1>
        <p className="mt-4 text-sm text-ink-soft">
          Última actualización: agosto de 2026.
        </p>

        <p className="mt-6 rounded-2xl bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-800">
          Este texto es un modelo general de referencia y no reemplaza el
          asesoramiento de un profesional. Antes de considerarlo definitivo,
          te recomendamos que lo revise un abogado.
        </p>

        <div className="mt-10 space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-extrabold tracking-[-0.02em] text-ink">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
                {section.body}
              </div>
            </section>
          ))}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
