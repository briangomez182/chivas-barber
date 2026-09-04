import type { SortDirection } from '@/components/ui/SortableColumnHeader';

/** Compara dos valores (string u number) y aplica la dirección. */
export function compareSortValues(
  a: string | number,
  b: string | number,
  direction: SortDirection,
): number {
  const factor = direction === 'asc' ? 1 : -1;

  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * factor;
  }

  return String(a).localeCompare(String(b), 'es') * factor;
}
