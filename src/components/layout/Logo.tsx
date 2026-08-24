import Link from 'next/link';

import { BRAND } from '@/lib/brand';

interface LogoProps {
  className?: string;
}

/** Marca compacta: monograma en negro + nombre. */
export function Logo({ className = '' }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label={`${BRAND.name} — inicio`}
      className={`group inline-flex items-center gap-2.5 ${className}`}
    >
      <span
        aria-hidden="true"
        className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-[13px] font-extrabold tracking-tight text-white transition-colors duration-300 group-hover:bg-brand"
      >
        CB
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-extrabold tracking-[-0.02em] text-ink">
          Chivas
        </span>
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Barbería Club
        </span>
      </span>
    </Link>
  );
}
