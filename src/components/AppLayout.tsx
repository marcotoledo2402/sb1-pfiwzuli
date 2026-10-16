import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Factory,
  ShoppingBag,
  TrendingUp,
  Settings as SettingsIcon,
  Leaf,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  CreditCard,
} from 'lucide-react';
import type { AppView } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface AppLayoutProps {
  current: AppView;
  onNavigate: (view: AppView) => void;
  children: ReactNode;
}

const NAV_ITEMS: { view: AppView; label: string; icon: typeof LayoutDashboard }[] = [
  { view: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
  { view: 'production', label: 'Producción', icon: Factory },
  { view: 'sales', label: 'Ventas', icon: ShoppingBag },
  { view: 'ingredients', label: 'Insumos', icon: Leaf },
  { view: 'products', label: 'Productos', icon: Package },
  { view: 'profitability', label: 'Rentabilidad', icon: TrendingUp },
  { view: 'plans', label: 'Planes', icon: CreditCard },
  { view: 'settings', label: 'Configuración', icon: SettingsIcon },
];

const MOBILE_NAV: AppView[] = ['dashboard', 'production', 'sales', 'ingredients', 'products'];

export function AppLayout({ current, onNavigate, children }: AppLayoutProps) {
  const { user, business, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const initials = user?.email?.[0]?.toUpperCase() ?? '?';

  function handleNav(view: AppView) {
    onNavigate(view);
    setSidebarOpen(false);
  }

  const ThemeToggle = (
    <button
      onClick={toggleTheme}
      className="icon-btn text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
      title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );

  const SidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-ink-100 dark:border-ink-800">
        <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
          <Package size={20} className="text-white" />
        </div>
        <div>
          <span className="text-base font-display font-bold text-ink-900 dark:text-ink-100 block leading-tight">MakerFlow</span>
          <span className="text-[10px] text-ink-400 leading-tight">Fabricá. Calculá. Ganá.</span>
        </div>
        <div className="ml-auto">{ThemeToggle}</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = current === item.view;
          return (
            <button
              key={item.view}
              onClick={() => handleNav(item.view)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'text-ink-600 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800'
              }`}
            >
              <Icon size={18} className={active ? 'text-primary-600 dark:text-primary-400' : 'text-ink-400'} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-4 border-t border-ink-100 dark:border-ink-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-400 flex items-center justify-center text-sm font-bold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-ink-800 dark:text-ink-200 truncate">{business?.name || 'Mi negocio'}</div>
            <div className="text-xs text-ink-400 truncate">{user?.email}</div>
          </div>
        </div>
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 transition"
        >
          <LogOut size={18} className="text-ink-400" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-950">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-ink-900 border-r border-ink-200/60 dark:border-ink-800 z-30">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-ink-900 shadow-pop animate-slide-up">
            <button
              onClick={() => setSidebarOpen(false)}
              className="icon-btn absolute top-3 right-3 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
            >
              <X size={20} />
            </button>
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-20 bg-white dark:bg-ink-900 border-b border-ink-200/60 dark:border-ink-800 px-4 h-14 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="icon-btn -ml-2.5 text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
              <Package size={16} className="text-white" />
            </div>
            <span className="font-display font-bold text-ink-900 dark:text-ink-100">MakerFlow</span>
          </div>
          {ThemeToggle}
        </div>

        {/* Page content */}
        <main className="px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-10 max-w-6xl mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-ink-900 border-t border-ink-200/60 dark:border-ink-800 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16">
          {MOBILE_NAV.map((view) => {
            const item = NAV_ITEMS.find((n) => n.view === view)!;
            const Icon = item.icon;
            const active = current === view;
            return (
              <button
                key={view}
                onClick={() => handleNav(view)}
                className={`flex-1 h-full flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] rounded-lg transition ${
                  active ? 'text-primary-600 dark:text-primary-400' : 'text-ink-400'
                }`}
              >
                <Icon size={22} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <ConfirmDialog
        open={showLogoutConfirm}
        title="Cerrar sesión"
        message="¿Seguro que querés salir? Tus datos quedan guardados."
        confirmLabel="Salir"
        danger
        onConfirm={async () => {
          setShowLogoutConfirm(false);
          await signOut();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
