import { ScissorsIcon } from '@/components/ui/icons';
import type { LoyaltyCard } from '@/lib/types';

interface LoyaltyStampCardProps {
  card: LoyaltyCard;
  /** Sellos necesarios para completar la tarjeta (`settings.loyaltyStampsGoal`). */
  goal: number;
  /** Texto chico arriba a la izquierda (eyebrow). */
  title?: string;
}

/** Poste de barbería decorativo — barra vertical con espiral y topes cromados. */
function BarberPole() {
  return (
    <div className="flex w-5 shrink-0 flex-col items-stretch">
      <span className="h-2.5 rounded-t-full bg-gradient-to-b from-gray-200 to-gray-400" />
      <span
        className="flex-1 border-x border-ink/10"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, #c8102e 0 9px, #fff 9px 18px, #1e3a8a 18px 27px, #fff 27px 36px)',
        }}
      />
      <span className="h-2.5 rounded-b-full bg-gradient-to-b from-gray-400 to-gray-200" />
    </div>
  );
}

/**
 * Tarjeta de sellos visual — estética de tarjeta de papel impresa (fondo
 * crema, líneas finas en tinta, tijeras en círculos), inspirada en
 * `public/tarjeta.png`. La comparten la vista pública y el panel de admin.
 *
 * Nota sobre el "premio": al llegar a `goal` el contador se reinicia en la
 * base y sube `rewardsEarned`, así que el banner se muestra cuando hay un
 * corte gratis recién acreditado (`rewardsEarned > 0` y tarjeta en curso en
 * 0).
 */
export function LoyaltyStampCard({
  card,
  goal,
  title = 'Tarjeta de sellos',
}: LoyaltyStampCardProps) {
  const filled = Math.max(0, Math.min(goal, card.completedStamps));
  const remaining = goal - filled;
  const hasReward = card.rewardsEarned > 0;
  const justCompleted = hasReward && filled === 0;
  const showRewardBanner = remaining === 0 || justCompleted;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-ink/15 bg-[#f5f1e6] p-5 text-ink shadow-card sm:p-6">
      {/* Doble filete interior, estilo ticket impreso. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[6px] rounded-[1.25rem] border border-ink/15"
      />

      <div className="relative flex items-stretch gap-4">
        <BarberPole />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-ink/50">
                {title}
              </p>
              <p className="font-serif text-2xl italic leading-tight text-ink">
                Tarjeta de sellos
              </p>
            </div>
            <ScissorsIcon className="mt-1 h-5 w-5 shrink-0 text-ink/70" />
          </div>

          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">
            {goal} sellos = un corte gratis
          </p>

          <ul
            aria-label={`${filled} de ${goal} sellos`}
            className="mt-5 grid grid-cols-5 gap-2.5 sm:gap-3"
          >
            {Array.from({ length: goal }).map((_, index) => {
              const isFilled = index < filled;
              return (
                <li
                  key={index}
                  aria-hidden="true"
                  className={`flex aspect-square items-center justify-center rounded-full border ${
                    isFilled
                      ? 'border-ink bg-ink text-[#f5f1e6]'
                      : 'border-dashed border-ink/30 text-ink/20'
                  }`}
                >
                  <ScissorsIcon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                </li>
              );
            })}
          </ul>

          <div className="mt-5 space-y-2">
            {showRewardBanner ? (
              <div className="rounded-xl bg-ink px-4 py-3 text-sm font-bold leading-snug text-[#f5f1e6]">
                🎉 ¡Corte gratis acreditado! Mostrá esta tarjeta en tu próxima
                visita.
              </div>
            ) : (
              <p className="text-sm text-ink/70">
                {filled === 0
                  ? 'Todavía no sumaste sellos. Cada corte suma uno.'
                  : remaining === 1
                    ? '¡Te falta 1 corte para tu premio!'
                    : `¡Te faltan ${remaining} cortes para tu premio!`}
              </p>
            )}

            {hasReward && (
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/60">
                ★ Cortes gratis disponibles: {card.rewardsEarned}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
