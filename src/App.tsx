import { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { Toaster } from '@/components/Toaster';
import { AuthPage } from '@/pages/AuthPage';
import { AppLayout } from '@/components/AppLayout';
import { Dashboard } from '@/pages/Dashboard';
import { IngredientsPage } from '@/pages/IngredientsPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { ProductionPage } from '@/pages/ProductionPage';
import { SalesPage } from '@/pages/SalesPage';
import { ProfitabilityPage } from '@/pages/ProfitabilityPage';
import { PlansPage } from '@/pages/PlansPage';
import { SettingsPage } from '@/pages/SettingsPage';
import type { AppView } from '@/lib/types';

function AppContent() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<AppView>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-ink-400">Cargando MakerFlow...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <AppLayout current={view} onNavigate={setView}>
      {view === 'dashboard' && <Dashboard onNavigate={setView} />}
      {view === 'ingredients' && <IngredientsPage />}
      {view === 'products' && <ProductsPage />}
      {view === 'production' && <ProductionPage />}
      {view === 'sales' && <SalesPage />}
      {view === 'profitability' && <ProfitabilityPage />}
      {view === 'plans' && <PlansPage />}
      {view === 'settings' && <SettingsPage onNavigate={setView} />}
    </AppLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
