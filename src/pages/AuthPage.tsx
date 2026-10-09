import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Package } from 'lucide-react';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fn = mode === 'login' ? signIn : signUp;
    const { error } = await fn(email, password);
    if (error) setError(error);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-700 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-600 rounded-full -translate-y-1/3 translate-x-1/3 opacity-30" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-primary-500 rounded-full translate-y-1/3 -translate-x-1/4 opacity-20" />

        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <Package size={22} className="text-primary-700" />
            </div>
            <span className="text-xl font-display font-bold">MakerFlow</span>
          </div>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-4xl font-display font-bold leading-tight">
            Fabricá.<br />Calculá.<br />Ganá.
          </h1>
          <p className="text-primary-100 text-lg leading-relaxed max-w-sm">
            Sabé cuánto te cuesta fabricar y cuánto ganás con cada producto.
            Reemplazá Excel, papel y cálculos manuales.
          </p>
          <div className="space-y-3 pt-4">
            {[
              'Costos calculados automáticamente',
              'Margen y ganancia en tiempo real',
              'Detectá cambios de precio al instante',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-primary-50">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">✓</div>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-primary-200 text-sm">
          «Un sistema simple para pequeños fabricantes.»
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-ink-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <Package size={22} className="text-white" />
            </div>
            <span className="text-xl font-display font-bold text-ink-900">MakerFlow</span>
          </div>

          <h2 className="text-2xl font-display font-bold text-ink-900">
            {mode === 'login' ? 'Bienvenido de nuevo' : 'Creá tu cuenta'}
          </h2>
          <p className="text-ink-500 text-sm mt-1.5 mb-8">
            {mode === 'login'
              ? 'Ingresá para gestionar tu negocio.'
              : 'Empezá a controlar tus costos en menos de 2 minutos.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="input"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="input"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {error && (
              <div className="text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? 'Cargando...' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-ink-500">
            {mode === 'login' ? (
              <>
                ¿No tenés cuenta?{' '}
                <button onClick={() => { setMode('signup'); setError(null); }} className="text-primary-600 font-medium hover:underline">
                  Creá una
                </button>
              </>
            ) : (
              <>
                ¿Ya tenés cuenta?{' '}
                <button onClick={() => { setMode('login'); setError(null); }} className="text-primary-600 font-medium hover:underline">
                  Ingresá
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
