import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Leaf,
  Factory,
  ShoppingBag,
  RefreshCw,
  Package,
  DollarSign,
  TrendingUp,
  Percent,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatMargin, formatRelativeTime, formatToday, formatNumber } from '@/lib/format';
import { margin } from '@/lib/calc';
import { logActivity, fetchActivity, seedDemoData } from '@/lib/data';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { showToast } from '@/components/Toaster';
import type { AppView } from '@/lib/types';
import type { Ingredient, Product, Production, Sale, ActivityLog, ProductComponent } from '@/lib/types';

interface DashboardProps {
  onNavigate: (view: AppView) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { user, business, settings, refreshBusiness } = useAuth();
  const symbol = business?.currency_symbol || '$';

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recentProductions, setRecentProductions] = useState<Production[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [components, setComponents] = useState<ProductComponent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [ingRes, prodRes, prodRes2, salesRes, actRes] = await Promise.all([
      supabase.from('ingredients').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('productions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('sales').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      fetchActivity(user.id, 6),
    ]);

    setIngredients(ingRes.data as Ingredient[] || []);
    setProducts(prodRes.data as Product[] || []);
    setRecentProductions(prodRes2.data as Production[] || []);
    setRecentSales(salesRes.data as Sale[] || []);
    setActivity(actRes);

    // Load product components to compute stock needs
    if (prodRes.data && prodRes.data.length > 0) {
      const { data: comps } = await supabase
        .from('product_components')
        .select('*, ingredient!inner(*)')
        .in('product_id', (prodRes.data as Product[]).map((p) => p.id));
      setComponents(comps as ProductComponent[] || []);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute indicators
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthSales = recentSales.filter(
    (s) => new Date(s.sold_at) >= monthStart
  );
  const totalRevenue = monthSales.reduce((sum, s) => sum + s.total_revenue, 0);
  const totalProfit = monthSales.reduce((sum, s) => sum + s.total_profit, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const monthProductions = recentProductions.filter(
    (p) => new Date(p.produced_at) >= monthStart
  );
  const totalProductionCost = monthProductions.reduce((sum, p) => sum + p.total_cost, 0);

  const activeProducts = products.filter((p) => p.is_active).length;

  // Onboarding checklist
  const checklist = [
    { label: 'Agregá tu primer insumo', done: ingredients.length > 0 },
    { label: 'Creá tu primer producto', done: products.length > 0 },
    { label: 'Definí cómo se fabrica', done: products.some((p) => p.current_cost > 0) },
    { label: 'Calculá tu costo', done: products.some((p) => p.current_cost > 0) },
    { label: 'Definí tu precio de venta', done: products.some((p) => p.sell_price > 0) },
    { label: 'Registrá tu primera producción', done: recentProductions.length > 0 },
  ];
  const checklistDone = checklist.filter((c) => c.done).length;
  const checklistComplete = checklistDone === checklist.length;

  // Alerts
  const alerts: { id: string; message: string; action: () => void; actionLabel: string }[] = [];

  // Check for outdated ingredients (not updated in 30+ days)
  const outdated = ingredients.filter((ing) => {
    const updated = new Date(ing.updated_at);
    const days = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
    return days >= 30;
  });
  if (outdated.length > 0) {
    alerts.push({
      id: 'outdated',
      message: `${outdated.length} ${outdated.length === 1 ? 'insumo tiene' : 'insumos tienen'} costos desactualizados (hace 30+ días).`,
      action: () => onNavigate('ingredients'),
      actionLabel: 'Ver insumos',
    });
  }

  // Check for low-margin products
  products.forEach((p) => {
    if (p.sell_price > 0 && p.current_cost > 0) {
      const m = margin(p.sell_price, p.current_cost);
      if (m < 20) {
        alerts.push({
          id: `low-margin-${p.id}`,
          message: `El margen de ${p.name} bajó a ${formatMargin(m)}.`,
          action: () => onNavigate('products'),
          actionLabel: 'Ver producto',
        });
      }
    }
  });

  // Check for products with no price
  const noPrice = products.filter((p) => p.sell_price <= 0 && p.current_cost > 0);
  if (noPrice.length > 0) {
    alerts.push({
      id: 'no-price',
      message: `${noPrice.length} ${noPrice.length === 1 ? 'producto no tiene' : 'productos no tienen'} precio de venta definido.`,
      action: () => onNavigate('products'),
      actionLabel: 'Ver productos',
    });
  }

  // Predictive stock alert: compare ingredient stock against what the next typical production batch needs
  // Use the most recent production for each product as the "typical batch size"
  const lastProductionByProduct: Record<string, Production> = {};
  for (const prod of recentProductions) {
    if (!lastProductionByProduct[prod.product_id]) {
      lastProductionByProduct[prod.product_id] = prod;
    }
  }

  // For each ingredient, check if any product that uses it has insufficient stock for its typical batch
  const ingredientShortages: { ingredientName: string; productName: string; needed: number; available: number; unit: string; shortfall: number }[] = [];
  for (const ing of ingredients) {
    const usingComponents = components.filter((c) => c.ingredient_id === ing.id);
    for (const comp of usingComponents) {
      const lastProd = lastProductionByProduct[comp.product_id];
      if (!lastProd) continue;
      const product = products.find((p) => p.id === comp.product_id);
      if (!product) continue;
      const needed = comp.quantity * lastProd.quantity;
      const available = ing.current_stock ?? 0;
      if (available < needed) {
        ingredientShortages.push({
          ingredientName: ing.name,
          productName: product.name,
          needed,
          available,
          unit: ing.unit,
          shortfall: needed - available,
        });
      }
    }
  }

  // Show top 3 unique ingredient shortages as alerts
  const shownShortages = ingredientShortages.slice(0, 3);
  for (const s of shownShortages) {
    alerts.push({
      id: `stock-shortage-${s.ingredientName}-${s.productName}`,
      message: `Te faltan ${formatNumber(s.shortfall)} ${s.unit} de ${s.ingredientName} para tu próxima tanda de ${s.productName}.`,
      action: () => onNavigate('ingredients'),
      actionLabel: 'Reponer',
    });
  }

  // Check for low-stock finished products
  const lowProductStock = products.filter((p) => (p.current_stock ?? 0) <= 0 && p.is_active);
  if (lowProductStock.length > 0 && lowProductStock.length <= 5) {
    alerts.push({
      id: 'low-product-stock',
      message: `${lowProductStock.length} ${lowProductStock.length === 1 ? 'producto sin' : 'productos sin'} stock para vender.`,
      action: () => onNavigate('production'),
      actionLabel: 'Fabricar',
    });
  }

  const quickActions = [
    { label: 'Nuevo producto', icon: Plus, view: 'products' as AppView, color: 'bg-primary-600' },
    { label: 'Nuevo insumo', icon: Leaf, view: 'ingredients' as AppView, color: 'bg-blue-500' },
    { label: 'Nueva producción', icon: Factory, view: 'production' as AppView, color: 'bg-accent-500' },
    { label: 'Registrar venta', icon: ShoppingBag, view: 'sales' as AppView, color: 'bg-ink-700' },
    { label: 'Actualizar costos', icon: RefreshCw, view: 'ingredients' as AppView, color: 'bg-ink-600' },
  ];

  async function handleSeedDemo() {
    if (!user) return;
    const ok = await seedDemoData(user.id);
    if (ok) {
      await loadData();
      await refreshBusiness();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const isEmpty = ingredients.length === 0 && products.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-ink-900">
          Hola {user?.email?.[0]?.toUpperCase() ?? ''} 👋
        </h1>
        <p className="text-ink-500 text-sm mt-1 capitalize">{formatToday()}</p>
      </div>

      {/* Empty state / onboarding */}
      {isEmpty && (
        <div className="card p-6 sm:p-8 animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={20} className="text-accent-500" />
            <h2 className="text-lg font-display font-bold text-ink-900">Empezá por acá</h2>
          </div>
          <p className="text-ink-500 text-sm mb-5">
            MakerFlow te ayuda a saber cuánto te cuesta fabricar y cuánto ganás.
            Cargá tus primeros datos o empezá con ejemplos de demostración.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => onNavigate('ingredients')} className="btn-primary">
              <Plus size={18} /> Agregar mi primer insumo
            </button>
            <button onClick={handleSeedDemo} className="btn-secondary">
              <Sparkles size={18} /> Cargar datos de ejemplo
            </button>
          </div>
        </div>
      )}

      {/* Onboarding checklist */}
      {!isEmpty && !checklistComplete && (
        <div className="card p-5 sm:p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-accent-500" />
              <h2 className="text-base font-display font-bold text-ink-900">Empezá por acá</h2>
            </div>
            <span className="text-xs font-medium text-ink-400">{checklistDone}/{checklist.length}</span>
          </div>
          <div className="space-y-2.5">
            {checklist.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                {item.done ? (
                  <CheckCircle2 size={20} className="text-primary-600 flex-shrink-0" />
                ) : (
                  <Circle size={20} className="text-ink-300 flex-shrink-0" />
                )}
                <span className={`text-sm ${item.done ? 'text-ink-400 line-through' : 'text-ink-700'}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
          {checklistComplete && (
            <div className="mt-4 text-sm text-primary-600 font-medium">
              ¡MakerFlow está listo! 🎉
            </div>
          )}
        </div>
      )}

      {/* Indicators */}
      {!isEmpty && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatCard
            label="Costo producción"
            value={formatCurrency(totalProductionCost, symbol)}
            subtext="Este mes"
            icon={<Factory size={18} />}
            accent="accent"
          />
          <StatCard
            label="Ventas"
            value={formatCurrency(totalRevenue, symbol)}
            subtext="Este mes"
            icon={<DollarSign size={18} />}
            accent="primary"
          />
          <StatCard
            label="Ganancia"
            value={formatCurrency(totalProfit, symbol)}
            subtext="Este mes"
            icon={<TrendingUp size={18} />}
            accent={totalProfit >= 0 ? 'primary' : 'ink'}
          />
          <StatCard
            label="Margen"
            value={formatMargin(avgMargin)}
            subtext="Promedio"
            icon={<Percent size={18} />}
            accent="blue"
          />
          <StatCard
            label="Productos"
            value={String(activeProducts)}
            subtext="Activos"
            icon={<Package size={18} />}
            accent="ink"
          />
        </div>
      )}

      {/* Quick actions */}
      {!isEmpty && (
        <div>
          <h2 className="text-base font-display font-bold text-ink-900 mb-3">¿Qué querés hacer?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => onNavigate(action.view)}
                  className="card p-4 flex flex-col items-center gap-2.5 hover:shadow-card-hover hover:border-ink-300 transition-all active:scale-[0.98] group"
                >
                  <div className={`w-10 h-10 rounded-xl ${action.color} text-white flex items-center justify-center group-hover:scale-105 transition`}>
                    <Icon size={20} />
                  </div>
                  <span className="text-sm font-medium text-ink-700 text-center">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Alerts + Activity */}
      {!isEmpty && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Alerts */}
          <div>
            <h2 className="text-base font-display font-bold text-ink-900 mb-3 flex items-center gap-2">
              <AlertTriangle size={18} className="text-warning-500" />
              Atención
            </h2>
            {alerts.length === 0 ? (
              <div className="card p-5">
                <div className="flex items-center gap-2.5 text-sm text-ink-500">
                  <CheckCircle2 size={18} className="text-primary-500" />
                  Todo en orden. Sin alertas por ahora.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div key={alert.id} className="card p-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1">
                      <AlertTriangle size={18} className="text-warning-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-ink-700">{alert.message}</span>
                    </div>
                    <button
                      onClick={alert.action}
                      className="text-xs font-medium text-primary-600 hover:underline flex items-center gap-1 flex-shrink-0"
                    >
                      {alert.actionLabel}
                      <ArrowRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity */}
          <div>
            <h2 className="text-base font-display font-bold text-ink-900 mb-3">Actividad reciente</h2>
            {activity.length === 0 ? (
              <div className="card p-5">
                <p className="text-sm text-ink-500">Todavía no registraste actividad.</p>
              </div>
            ) : (
              <div className="card divide-y divide-ink-100">
                {activity.map((item) => (
                  <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <span className="text-sm text-ink-700">{item.description}</span>
                    <span className="text-xs text-ink-400 flex-shrink-0">{formatRelativeTime(item.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
