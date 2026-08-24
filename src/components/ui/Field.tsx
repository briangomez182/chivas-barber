interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

/** Etiqueta + control + ayuda, con el estilo del sistema de diseño. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className = '',
}: FieldProps) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted"
      >
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
