import type {
  Appointment,
  Barber,
  Profile,
  Service,
  Session,
  Settings,
  Slot,
} from './types';

interface TrackedAppointment {
  id: string;
  date: string;
  time: string;
  durationMin: number;
  status: Appointment['status'];
  paymentStatus: string | null;
  amount: number | null;
  barberName: string | null;
  serviceName: string | null;
}

/** Wrapper `fetch` tipado para los componentes cliente. */
export async function apiFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  const payload: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as { error: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : 'Ocurrió un error inesperado';
    throw new Error(message);
  }

  return payload as T;
}

export const api = {
  barbers: {
    list: (includeInactive = false) =>
      apiFetch<{ barbers: Barber[] }>(
        `/api/barbers${includeInactive ? '?all=1' : ''}`,
      ),
    create: (data: Partial<Barber>) =>
      apiFetch<{ barber: Barber }>('/api/barbers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Barber>) =>
      apiFetch<{ barber: Barber }>(`/api/barbers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      apiFetch<{ ok: true }>(`/api/barbers/${id}`, { method: 'DELETE' }),
  },
  services: {
    list: () => apiFetch<{ services: Service[] }>('/api/services'),
    create: (data: Partial<Service>) =>
      apiFetch<{ service: Service }>('/api/services', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Service>) =>
      apiFetch<{ service: Service }>(`/api/services/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      apiFetch<{ ok: true }>(`/api/services/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get: () => apiFetch<{ settings: Settings }>('/api/settings'),
    update: (data: Partial<Settings>) =>
      apiFetch<{ settings: Settings }>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },
  availability: (params: {
    date: string;
    barberId?: string;
    duration?: number;
  }) => {
    const search = new URLSearchParams({ date: params.date });
    if (params.barberId) search.set('barberId', params.barberId);
    if (params.duration) search.set('duration', String(params.duration));
    return apiFetch<{ slots: Slot[]; durationMin: number }>(
      `/api/availability?${search.toString()}`,
    );
  },
  appointments: {
    list: (date?: string, barberId?: string) => {
      const search = new URLSearchParams();
      if (date) search.set('date', date);
      if (barberId) search.set('barberId', barberId);
      const query = search.toString();
      return apiFetch<{ appointments: Appointment[] }>(
        `/api/appointments${query ? `?${query}` : ''}`,
      );
    },
    create: (data: Record<string, unknown>) =>
      apiFetch<{ appointment: Appointment }>('/api/appointments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    setStatus: (id: string, status: Appointment['status']) =>
      apiFetch<{ appointment: Appointment }>(`/api/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    reschedule: (id: string, data: Record<string, unknown>) =>
      apiFetch<{ appointment: Appointment }>(`/api/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      apiFetch<{ ok: true }>(`/api/appointments/${id}`, { method: 'DELETE' }),
    /** Seguimiento público y acotado, usado en /booking/success|pending|failure. */
    track: (id: string) =>
      apiFetch<{ appointment: TrackedAppointment }>(`/api/appointments/track/${id}`),
  },
  /** Reserva pública con cobro: crea el turno `pending_payment` + preferencia de MP. */
  checkout: (data: Record<string, unknown>) =>
    apiFetch<{ appointment: Appointment; checkoutUrl: string }>('/api/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  users: {
    list: () => apiFetch<{ users: Profile[] }>('/api/users'),
    create: (data: {
      email: string;
      password: string;
      name: string;
      phone: string;
      role: 'admin' | 'editor';
      barberId: string | null;
    }) =>
      apiFetch<{ user: Profile }>('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: Partial<Omit<Profile, 'id' | 'email' | 'createdAt'>> & { password?: string },
    ) =>
      apiFetch<{ user: Profile }>(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      apiFetch<{ ok: true }>(`/api/users/${id}`, { method: 'DELETE' }),
  },
  auth: {
    login: (email: string, password: string) =>
      apiFetch<{ user: { id: string; name: string; role: string } }>(
        '/api/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
      ),
    register: (data: {
      name: string;
      email: string;
      phone: string;
      password: string;
    }) =>
      apiFetch<{
        user: { id: string; name: string };
        needsEmailConfirmation?: boolean;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    logout: () => apiFetch<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
    me: () => apiFetch<{ session: Session | null }>('/api/auth/me'),
  },
};
