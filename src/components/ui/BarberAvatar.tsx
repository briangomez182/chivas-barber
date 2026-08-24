'use client';

import { useState } from 'react';

interface BarberAvatarProps {
  name: string;
  photoUrl?: string;
  size?: number;
  className?: string;
}

/**
 * Foto circular monocromática. Si no hay URL (o la imagen falla),
 * cae elegantemente en las iniciales sobre gris.
 */
export function BarberAvatar({
  name,
  photoUrl,
  size = 128,
  className = '',
}: BarberAvatarProps) {
  const [failed, setFailed] = useState<boolean>(false);

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const showImage = Boolean(photoUrl) && !failed;

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 overflow-hidden rounded-full bg-gray-100 ring-1 ring-gray-200 ${className}`}
    >
      {showImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={photoUrl}
          alt={`Retrato de ${name}`}
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover grayscale transition-[filter,transform] duration-500 hover:scale-105 hover:grayscale-0"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-full w-full place-items-center font-extrabold tracking-tight text-ink-muted"
          style={{ fontSize: size / 3 }}
        >
          {initials || '—'}
        </span>
      )}
    </div>
  );
}
