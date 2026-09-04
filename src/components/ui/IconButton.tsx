type Tone = 'default' | 'success' | 'danger' | 'brand';

interface IconButtonProps {
  label: string;
  icon: React.ReactNode;
  tone?: Tone;
  /** Acción como botón (ej. cambiar estado). Ignorado si se pasa `href`. */
  onClick?: () => void;
  /** Acción como link (ej. abrir WhatsApp). Se abre en una pestaña nueva. */
  href?: string;
}

const TONE_STYLES: Record<Tone, string> = {
  default: 'text-ink-soft hover:bg-gray-100 hover:text-ink',
  success: 'text-emerald-600 hover:bg-emerald-50',
  danger: 'text-red-500 hover:bg-red-50',
  brand: 'text-brand hover:bg-brand-50',
};

/**
 * Botón de acción minimalista, sólo ícono — usado en las filas de las
 * tablas de turnos (Atendido / Cancelar / Reagendar / Eliminar / WhatsApp).
 * `label` es el texto que antes se veía: queda como tooltip (`title`) y
 * nombre accesible (`aria-label`), no desaparece, sólo deja de ocupar
 * espacio. Con `href` se renderiza como link (abre en pestaña nueva) en vez
 * de botón.
 */
export function IconButton({ label, icon, tone = 'default', onClick, href }: IconButtonProps) {
  const className = `inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${TONE_STYLES[tone]}`;

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        title={label}
        aria-label={label}
        className={className}
      >
        {icon}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={className}>
      {icon}
    </button>
  );
}
