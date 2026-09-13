'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

import { Logo } from '@/components/layout/Logo';
import { api } from '@/lib/api-client';
import type { Barber, Service, Settings } from '@/lib/types';

import { AppointmentsPanel } from './AppointmentsPanel';
import { BarbersPanel } from './BarbersPanel';
import { ConfiguracionesPanel } from './ConfiguracionesPanel';
import { LoyaltyPanel } from './LoyaltyPanel';
import { UsersPanel } from './UsersPanel';

interface AdminDashboardProps {
  adminName: string;
  initialBarbers: Barber[];
  initialServices: Service[];
  initialSettings: Settings;
}

type TabId =
  | 'turnos'
  | 'barberos'
  | 'lealtad'
  | 'usuarios'
  | 'configuraciones';

const TABS: { id: TabId; label: string }[] = [
  { id: 'turnos', label: 'Turnos' },
  { id: 'barberos', label: 'Barberos' },
  { id: 'lealtad', label: 'Lealtad' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'configuraciones', label: 'Configuraciones' },
];

export function AdminDashboard({
  adminName,
  initialBarbers,
  initialServices,
  initialSettings,
}: AdminDashboardProps) {
  const router = useRouter();

  const [tab, setTab] = useState<TabId>('turnos');
  const [barbers, setBarbers] = useState<Barber[]>(initialBarbers);
  // Sólo para mostrar el nombre del servicio y calcular deudas en la grilla de
  // turnos. La carta se administra por barbero (pestaña Barberos › Servicios).
  const [services] = useState<Service[]>(initialServices);
  const [settings, setSettings] = useState<Settings>(initialSettings);

  const visibleTabs = settings.loyaltyEnabled
    ? TABS
    : TABS.filter((item) => item.id !== 'lealtad');

  // Si se apaga el módulo de lealtad estando parado en esa pestaña, vuelve a
  // Turnos en vez de dejar la pestaña activa oculta del nav.
  useEffect(() => {
    if (tab === 'lealtad' && !settings.loyaltyEnabled) {
      setTab('turnos');
    }
  }, [tab, settings.loyaltyEnabled]);

  const logout = async (): Promise<void> => {
    await api.auth.logout();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/85 backdrop-blur-xl">
        <div className="container-wide flex min-h-[72px] flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <div className="flex items-center gap-5">
            <Logo />
            <span className="hidden rounded-full bg-ink px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white sm:inline-block">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="max-w-[45vw] truncate text-sm text-ink-soft sm:max-w-none">
              <span className="hidden sm:inline">Hola, </span>
              <strong className="font-semibold text-ink">{adminName}</strong>
            </span>
            <Link href="/admin/turnero" className="pill-primary shrink-0 text-sm">
              Turnero
            </Link>
            <button type="button" onClick={logout} className="pill-outline shrink-0 text-sm">
              Salir
            </button>
          </div>
        </div>

        <nav aria-label="Secciones del panel" className="container-wide">
          <ul className="flex gap-1 overflow-x-auto pb-3">
            {visibleTabs.map((item) => {
              const active = item.id === tab;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setTab(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      active ? 'text-white' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="admin-tab"
                        className="absolute inset-0 rounded-full bg-brand shadow-brand"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="container-wide py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === 'turnos' && (
              <AppointmentsPanel barbers={barbers} services={services} settings={settings} />
            )}
            {tab === 'barberos' && (
              <BarbersPanel barbers={barbers} onChange={setBarbers} />
            )}
            {tab === 'lealtad' && (
              <LoyaltyPanel stampsGoal={settings.loyaltyStampsGoal} />
            )}
            {tab === 'usuarios' && <UsersPanel barbers={barbers} />}
            {tab === 'configuraciones' && (
              <ConfiguracionesPanel settings={settings} onChange={setSettings} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
