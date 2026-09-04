import { LoyaltyLookup } from '@/components/loyalty/LoyaltyLookup';

interface LoyaltySectionProps {
  /** Sellos necesarios para completar la tarjeta (`settings.loyaltyStampsGoal`). */
  stampsGoal: number;
}

/** Sección "Programa de fidelización" de la home. */
export function LoyaltySection({ stampsGoal }: LoyaltySectionProps) {
  return (
    <section
      id="lealtad"
      aria-labelledby="lealtad-title"
      className="border-t border-gray-100 bg-gray-50 py-24 lg:py-32"
    >
      <div className="container-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Programa de fidelización</p>
            <h2 id="lealtad-title" className="section-title mt-3">
              Tarjeta de Lealtad
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            Sumás un sello por cada corte. Al completar {stampsGoal}, el
            siguiente es gratis. Consultá tu tarjeta con tu número de teléfono.
          </p>
        </div>

        <div className="mt-14">
          <LoyaltyLookup stampsGoal={stampsGoal} />
        </div>
      </div>
    </section>
  );
}
