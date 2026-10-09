import { useState } from 'react';
import { Settings as SettingsIcon, Save, Sparkles, LogOut, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { seedDemoData } from '@/lib/data';
import { showToast } from '@/components/Toaster';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const CURRENCIES = [
  { code: 'ARS', symbol: '$', label: 'Peso argentino (ARS)' },
  { code: 'USD', symbol: 'US$', label: 'Dólar (USD)' },
  { code: 'EUR', symbol: '€', label: 'Euro (EUR)' },
  { code: 'MXN', symbol: 'MX$', label: 'Peso mexicano (MXN)' },
  { code: 'COP', symbol: 'COL$', label: 'Peso colombiano (COP)' },
  { code: 'CLP', symbol: 'CLP$', label: 'Peso chileno (CLP)' },
  { code: 'PEN', symbol: 'S/', label: 'Sol peruano (PEN)' },
  { code: 'UYU', symbol: '$U', label: 'Peso uruguayo (UYU)' },
];

export function SettingsPage() {
  const { user, business, refreshBusiness, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [name, setName] = useState(business?.name || 'Mi negocio');
  const [currency, setCurrency] = useState(business?.currency || 'ARS');
  const [defaultMargin, setDefaultMargin] = useState(String(business?.default_margin || 50));
  const [roundPrices, setRoundPrices] = useState(business?.round_prices || false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);

  async function handleSave() {
    if (!user || !business) return;
    setSaving(true);
    const curr = CURRENCIES.find((c) => c.code === currency);
    const { error } = await supabase
      .from('businesses')
      .update({
        name: name.trim(),
        currency,
        currency_symbol: curr?.symbol || '$',
        default_margin: parseFloat(defaultMargin) || 50,
        round_prices: roundPrices,
      })
      .eq('id', business.id);
    if (!error) {
      await refreshBusiness();
      showToast('success', 'Configuración guardada.');
    } else {
      showToast('error', 'No se pudo guardar.');
    }
    setSaving(false);
  }

  async function handleSeedDemo() {
    if (!user) return;
    setSeeding(true);
    const ok = await seedDemoData(user.id);
    setSeeding(false);
    setShowSeedConfirm(false);
    if (ok) {
      await refreshBusiness();
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-ink-900">Configuración</h1>
        <p className="text-ink-500 text-sm mt-0.5">Datos del negocio y preferencias</p>
      </div>

      {/* Business settings */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <SettingsIcon size={18} className="text-ink-500" />
          <h2 className="text-base font-display font-bold text-ink-900">Datos del negocio</h2>
        </div>

        <div>
          <label className="label">Nombre del negocio</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>

        <div>
          <label className="label">Moneda</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input">
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Margen predeterminado</label>
            <div className="relative">
              <input type="number" value={defaultMargin} onChange={(e) => setDefaultMargin(e.target.value)} className="input pr-8" />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400">%</span>
            </div>
          </div>
          <div>
            <label className="label">Redondeo de precios</label>
            <button
              onClick={() => setRoundPrices(!roundPrices)}
              className={`input flex items-center justify-between cursor-pointer ${roundPrices ? 'text-primary-700' : 'text-ink-500'}`}
            >
              <span>{roundPrices ? 'Activado' : 'Desactivado'}</span>
              <div className={`w-10 h-5 rounded-full transition relative ${roundPrices ? 'bg-primary-500' : 'bg-ink-200'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${roundPrices ? 'left-5' : 'left-0.5'}`} />
              </div>
            </button>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full sm:w-auto">
          <Save size={16} /> {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Demo data */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={18} className="text-accent-500" />
          <h2 className="text-base font-display font-bold text-ink-900">Datos de demostración</h2>
        </div>
        <p className="text-sm text-ink-500 mb-4">
          Cargá productos e insumos de ejemplo para explorar MakerFlow rápidamente.
          {business?.has_demo_data && (
            <span className="block mt-1 text-xs text-ink-400">Ya cargaste datos de ejemplo antes. Si lo hacés de nuevo, se pueden crear insumos y productos duplicados.</span>
          )}
        </p>
        <button
          onClick={() => {
            if (business?.has_demo_data) {
              setShowSeedConfirm(true);
            } else {
              handleSeedDemo();
            }
          }}
          disabled={seeding}
          className="btn-secondary"
        >
          <Sparkles size={16} />
          {seeding ? 'Cargando...' : 'Cargar datos de ejemplo'}
        </button>
      </div>

      {/* Appearance */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          {theme === 'light' ? <Sun size={18} className="text-accent-500" /> : <Moon size={18} className="text-primary-400" />}
          <h2 className="text-base font-display font-bold text-ink-900 dark:text-ink-100">Apariencia</h2>
        </div>
        <div className="flex items-center justify-between p-3.5 bg-ink-50 dark:bg-ink-800 rounded-xl">
          <div>
            <div className="text-sm font-medium text-ink-700 dark:text-ink-200">Tema</div>
            <div className="text-xs text-ink-400">
              {theme === 'light' ? 'Modo claro activado' : 'Modo oscuro activado'}
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`w-12 h-6 rounded-full transition relative ${theme === 'dark' ? 'bg-primary-500' : 'bg-ink-200'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${theme === 'dark' ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Account */}
      <div className="card p-5">
        <h2 className="text-base font-display font-bold text-ink-900 mb-3">Cuenta</h2>
        <div className="text-sm text-ink-500 mb-4">
          {user?.email}
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between p-3.5 bg-ink-50 rounded-xl">
            <div>
              <div className="text-sm font-medium text-ink-700">Plan actual</div>
              <div className="text-xs text-ink-400">Versión gratuita</div>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg">Free</span>
          </div>
          <button onClick={() => setShowLogout(true)} className="btn-danger">
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </div>

      <div className="text-center text-xs text-ink-400 pt-2">
        MakerFlow · Fabricá. Calculá. Ganá.
      </div>

      <ConfirmDialog
        open={showLogout}
        title="Cerrar sesión"
        message="¿Seguro que querés salir? Tus datos quedan guardados."
        confirmLabel="Salir"
        danger
        onConfirm={async () => { setShowLogout(false); await signOut(); }}
        onCancel={() => setShowLogout(false)}
      />

      <ConfirmDialog
        open={showSeedConfirm}
        title="Cargar datos de ejemplo"
        message="Ya cargaste datos de ejemplo antes. ¿Querés cargarlos de nuevo? Esto puede crear productos e insumos duplicados."
        confirmLabel="Cargar de todas formas"
        onConfirm={handleSeedDemo}
        onCancel={() => setShowSeedConfirm(false)}
      />
    </div>
  );
}
