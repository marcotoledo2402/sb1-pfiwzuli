import { useState } from 'react';
import { Check, Sparkles, MessageCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/data';
import { showToast } from '@/components/Toaster';

const FREE_FEATURES = [
  'Insumos, productos y recetas ilimitados',
  'Control de stock con historial de ajustes',
  'Registro de producción y ventas',
  'Cálculo automático de costos y márgenes',
  'Hasta 1 usuario por negocio',
];

const PRO_FEATURES = [
  'Todo lo del plan gratuito',
  'Exportar insumos, productos y ventas a Excel',
  'Varios usuarios por negocio (equipo)',
  'Reportes de rentabilidad por período',
  'Soporte prioritario por WhatsApp',
];

export function PlansPage() {
  const { user, business } = useAuth();
  const [sentInterest, setSentInterest] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleInterest() {
    if (!user) return;
    setSending(true);
    await logActivity(
      user.id,
      'plan_interest',
      `${business?.name || 'El negocio'} mostró interés en el plan Pro`
    );
    setSending(false);
    setSentInterest(true);
    showToast('success', '¡Gracias! Te vamos a avisar apenas esté disponible.');
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-ink-900">Planes y precios</h1>
        <p className="text-ink-500 text-sm mt-0.5">
          MakerFlow está en beta gratuita. Así va a quedar la estructura de planes cuando se lance la versión paga.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Free plan */}
        <div className="card p-5 flex flex-col">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-display font-bold text-ink-900">Gratis</h2>
              <span className="text-xs font-medium px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg">
                Tu plan actual
              </span>
            </div>
            <p className="text-sm text-ink-500">Para empezar a ordenar tu producción y tus costos.</p>
          </div>
          <div className="text-3xl font-display font-bold text-ink-900 mb-4">
            $0 <span className="text-sm font-normal text-ink-400">/ mes</span>
          </div>
          <ul className="space-y-2.5 flex-1">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-ink-700">
                <Check size={16} className="text-primary-600 flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro plan */}
        <div className="card p-5 flex flex-col border-2 border-primary-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-primary-600 text-white text-xs font-medium px-3 py-1 rounded-bl-xl">
            Próximamente
          </div>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={18} className="text-accent-500" />
              <h2 className="text-lg font-display font-bold text-ink-900">Pro</h2>
            </div>
            <p className="text-sm text-ink-500">Para cuando tu negocio ya no entra en una planilla.</p>
          </div>
          <div className="text-3xl font-display font-bold text-ink-900 mb-1">
            A definir <span className="text-sm font-normal text-ink-400">/ mes</span>
          </div>
          <p className="text-xs text-ink-400 mb-4">
            El precio final se define con los primeros usuarios. Si te interesa, dejanos tu interés y te contactamos antes del lanzamiento.
          </p>
          <ul className="space-y-2.5 flex-1 mb-4">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-ink-700">
                <Check size={16} className="text-primary-600 flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={handleInterest}
            disabled={sending || sentInterest}
            className="btn-primary w-full"
          >
            <MessageCircle size={16} />
            {sentInterest ? 'Ya avisaste tu interés' : sending ? 'Enviando...' : 'Quiero este plan'}
          </button>
        </div>
      </div>

      <div className="card p-5 text-sm text-ink-500">
        ¿Tenés dudas sobre precios o necesitás algo puntual para tu negocio? Escribinos directo, estamos armando MakerFlow con el feedback de los primeros usuarios.
      </div>
    </div>
  );
}
