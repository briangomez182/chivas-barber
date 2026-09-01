'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { api } from '@/lib/api-client';
import { STAFF_PASSWORD_RULES, passwordHint, validatePassword } from '@/lib/password';
import type { Barber, Profile, UserRole } from '@/lib/types';

interface UsersPanelProps {
  barbers: Barber[];
}

interface DraftUser {
  id: string | null;
  email: string;
  password: string;
  name: string;
  phone: string;
  role: Extract<UserRole, 'admin' | 'editor'>;
  barberId: string;
}

const EMPTY_DRAFT: DraftUser = {
  id: null,
  email: '',
  password: '',
  name: '',
  phone: '',
  role: 'editor',
  barberId: '',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  editor: 'Barbero (editor)',
};

export function UsersPanel({ barbers }: UsersPanelProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [draft, setDraft] = useState<DraftUser | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const { users: list } = await api.users.list();
      setUsers(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const barberName = (id: string | null): string =>
    barbers.find((item) => item.id === id)?.name ?? '—';

  const openNew = (): void => {
    setError(null);
    setDraft({ ...EMPTY_DRAFT });
  };

  const openEdit = (user: Profile): void => {
    setError(null);
    setDraft({
      id: user.id,
      email: user.email,
      password: '',
      name: user.name,
      phone: user.phone,
      role: user.role === 'admin' ? 'admin' : 'editor',
      barberId: user.barberId ?? '',
    });
  };

  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!draft) return;

    if (draft.role === 'editor' && !draft.barberId) {
      setError('Elegí el barbero al que se vincula');
      return;
    }
    if (!draft.id || draft.password) {
      const passwordError = validatePassword(draft.password, STAFF_PASSWORD_RULES);
      if (passwordError) {
        setError(passwordError);
        return;
      }
    }

    setBusy(true);
    setError(null);

    try {
      if (draft.id) {
        const { user } = await api.users.update(draft.id, {
          name: draft.name,
          phone: draft.phone,
          role: draft.role,
          barberId: draft.role === 'editor' ? draft.barberId : null,
          ...(draft.password ? { password: draft.password } : {}),
        });
        setUsers((current) => current.map((item) => (item.id === user.id ? user : item)));
      } else {
        const { user } = await api.users.create({
          email: draft.email,
          password: draft.password,
          name: draft.name,
          phone: draft.phone,
          role: draft.role,
          barberId: draft.role === 'editor' ? draft.barberId : null,
        });
        setUsers((current) => [...current, user]);
      }

      setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (user: Profile): Promise<void> => {
    const confirmed = window.confirm(`¿Eliminar a ${user.name}? Pierde el acceso al panel.`);
    if (!confirmed) return;

    try {
      await api.users.remove(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'No se pudo eliminar');
    }
  };

  return (
    <section aria-labelledby="admin-users-title">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2
            id="admin-users-title"
            className="text-xl font-extrabold tracking-[-0.02em] text-ink"
          >
            Usuarios
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Administradores y barberos con acceso al panel.
          </p>
        </div>
        <button type="button" onClick={openNew} className="pill-primary">
          + Nuevo usuario
        </button>
      </header>

      <div className="card mt-7 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Usuarios del panel</caption>
          <thead className="border-b border-gray-100 bg-gray-50/60">
            <tr className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">
              <th scope="col" className="px-6 py-4">Nombre</th>
              <th scope="col" className="px-6 py-4">Email</th>
              <th scope="col" className="px-6 py-4">Rol</th>
              <th scope="col" className="px-6 py-4">Barbero</th>
              <th scope="col" className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-ink-muted">
                  Cargando usuarios…
                </td>
              </tr>
            )}

            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-ink-soft">
                  No hay usuarios de staff todavía.
                </td>
              </tr>
            )}

            {!loading &&
              users.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                >
                  <td className="px-6 py-4 font-semibold text-ink">{user.name}</td>
                  <td className="px-6 py-4 text-ink-soft">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand">
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-ink-soft">
                    {user.role === 'editor' ? barberName(user.barberId) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      className="pill-ghost px-3 py-1.5 text-xs"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(user)}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </motion.tr>
              ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={draft !== null}
        title={draft?.id ? 'Editar usuario' : 'Nuevo usuario'}
        onClose={() => setDraft(null)}
      >
        {draft && (
          <form onSubmit={save} className="space-y-5">
            <Field label="Nombre" htmlFor="user-name">
              <input
                id="user-name"
                type="text"
                required
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </Field>

            <Field label="Email" htmlFor="user-email">
              <input
                id="user-email"
                type="email"
                required
                disabled={draft.id !== null}
                value={draft.email}
                onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              />
            </Field>

            <Field
              label={draft.id ? 'Nueva contraseña' : 'Contraseña'}
              htmlFor="user-password"
              hint={
                draft.id
                  ? 'Dejalo vacío para no cambiarla.'
                  : passwordHint(STAFF_PASSWORD_RULES)
              }
            >
              <PasswordInput
                id="user-password"
                required={!draft.id}
                minLength={STAFF_PASSWORD_RULES.minLength}
                autoComplete="new-password"
                value={draft.password}
                onChange={(event) => setDraft({ ...draft, password: event.target.value })}
              />
            </Field>

            <Field label="Teléfono" htmlFor="user-phone">
              <input
                id="user-phone"
                type="tel"
                value={draft.phone}
                onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
              />
            </Field>

            <Field label="Rol" htmlFor="user-role">
              <select
                id="user-role"
                value={draft.role}
                onChange={(event) =>
                  setDraft({ ...draft, role: event.target.value as DraftUser['role'] })
                }
              >
                <option value="editor">Barbero (editor)</option>
                <option value="admin">Administrador</option>
              </select>
            </Field>

            {draft.role === 'editor' && (
              <Field label="Barbero vinculado" htmlFor="user-barber">
                <select
                  id="user-barber"
                  required
                  value={draft.barberId}
                  onChange={(event) => setDraft({ ...draft, barberId: event.target.value })}
                >
                  <option value="">Elegí un barbero…</option>
                  {barbers.map((barber) => (
                    <option key={barber.id} value={barber.id}>
                      {barber.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="pill-outline flex-1"
              >
                Cancelar
              </button>
              <button type="submit" disabled={busy} className="pill-primary flex-1">
                {busy ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
