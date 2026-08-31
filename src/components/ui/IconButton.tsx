type Tone = 'default' | 'success' | 'danger' | 'brand';

interface IconButtonProps {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  tone?: Tone;
}

const TONE_STYLES: Record<Tone, string> = {
  default: 'text-ink-soft hover:bg-gray-100 hover:text-ink',
  success: 'text-emerald-600 hover:bg-emerald-50',
  danger: 'text-red-500 hover:bg-red-50',
  brand: 'text-brand hover:bg-brand-50',
};

/**
 * Botón de acción minimalista, sólo ícono — usado en las filas de las
 * tablas de turnos (Atendido / Cancelar / Reagendar / Eliminar). `label` es
 * el texto que antes se veía: queda como tooltip (`title`) y nombre
 * accesible (`aria-label`), no desaparece, sólo deja de ocupar espacio.
 */
export function IconButton({ label, onClick, icon, tone = 'default' }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${TONE_STYLES[tone]}`}
    >
      {icon}
    </button>
  );
}
