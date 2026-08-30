'use client';

import { useState } from 'react';

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
>;

/** Ícono de ojo. `open` = visible (ojo abierto), tachado cuando está oculta. */
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 fill-none stroke-current stroke-[1.6]">
      <path
        d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {!open && <path d="M2.5 2.5l15 15" strokeLinecap="round" />}
    </svg>
  );
}

/** Input de contraseña con un toggle para mostrarla/ocultarla. */
export function PasswordInput({ className = '', ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState<boolean>(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`pr-11 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-muted transition-colors hover:text-ink"
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}
