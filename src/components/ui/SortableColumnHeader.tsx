import { ChevronDownIcon } from '@/components/ui/icons';

export type SortDirection = 'asc' | 'desc';

interface SortableColumnHeaderProps<Key extends string> {
  label: string;
  sortKey: Key;
  activeKey: Key | null;
  direction: SortDirection;
  onSort: (key: Key) => void;
  align?: 'left' | 'right';
}

/**
 * `<th>` clickeable para tablas ordenables. La flechita queda tenue cuando
 * la columna no es la activa, y marca la dirección (arriba = ascendente)
 * cuando sí lo es.
 */
export function SortableColumnHeader<Key extends string>({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = 'left',
}: SortableColumnHeaderProps<Key>) {
  const active = activeKey === sortKey;

  return (
    <th scope="col" className={`px-6 py-4 ${align === 'right' ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Ordenar por ${label}${active ? (direction === 'asc' ? ', ascendente' : ', descendente') : ''}`}
        className={`inline-flex items-center gap-1 transition-colors hover:text-ink ${
          active ? 'text-ink' : ''
        } ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {label}
        <ChevronDownIcon
          className={`h-3 w-3 shrink-0 transition-transform ${
            active ? 'opacity-100' : 'opacity-30'
          } ${active && direction === 'asc' ? 'rotate-180' : ''}`}
        />
      </button>
    </th>
  );
}
