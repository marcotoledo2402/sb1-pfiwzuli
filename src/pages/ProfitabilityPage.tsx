import { useEffect, useState, useCallback, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Percent, Award, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatMargin } from '@/lib/format';
import { margin as calcMargin } from '@/lib/calc';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import type { Sale, Product } from '@/lib/types';

type Period = 'today' | 'week' | 'month' | 'custom';

export function ProfitabilityPage() {
  const { user, business } = useAuth();
  const symbol = business?.currency_symbol || '$';

  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const [salesRes, prodRes] = await Promise.all([
      supabase
        .from('sales')
        .select('*, product!inner(*)')
        .eq('user_id', user.id)
        .order('sold_at', { ascending: false }),
      supabase.from('products').select('*').eq('user_id', user.id),
    ]);
    setSales(salesRes.data as Sale[] || []);
    setProducts(prodRes.data as Product[] || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const dateRange = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start: Date;
    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'custom':
        start = customStart ? new Date(customStart) : new Date(0);
        const customEndDate = customEnd ? new Date(customEnd) : now;
        customEndDate.setHours(23, 59, 59);
        return { start, end: customEndDate };
    }
    return { start, end };
  }, [period, customStart, customEnd]);

  const periodSales = sales.filter((s) => {
    const d = new Date(s.sold_at);
    return d >= dateRange.start && d <= dateRange.end;
  });

  const totalRevenue = periodSales.reduce((sum, s) => sum + s.total_revenue, 0);
  const totalCost = periodSales.reduce((sum, s) => sum + s.total_cost, 0);
  const totalProfit = periodSales.reduce((sum, s) => sum + s.total_profit, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Per-product profitability
  const productStats = useMemo(() => {
    const map: Record<string, { product: Product; revenue: number; cost: number; profit: number; qty: number }> = {};
    periodSales.forEach((s) => {
      if (!s.product) return;
      if (!map[s.product_id]) {
        map[s.product_id] = { product: s.product, revenue: 0, cost: 0, profit: 0, qty: 0 };
      }
      map[s.product_id].revenue += s.total_revenue;
      map[s.product_id].cost += s.total_cost;
      map[s.product_id].profit += s.total_profit;
      map[s.product_id].qty += s.quantity;
    });
    return Object.values(map).sort((a, b) => b.profit - a.profit);
  }, [periodSales]);

  const mostProfitable = productStats.slice(0, 3);
  const leastProfitable = [...productStats].sort((a, b) => a.profit - b.profit).slice(0, 3);

  const periods: { value: Period; label: string }[] = [
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Esta semana' },
    { value: 'month', label: 'Este mes' },
    { value: 'custom', label: 'Personalizado' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold text-ink-900">Rentabilidad</h1>
        <p className="text-ink-500 text-sm mt-0.5">Analizá tus ganancias y márgenes</p>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-2">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
              period === p.value
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Desde</label>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input" />
          </div>
        </div>
      )}

      {periodSales.length === 0 ? (
        <EmptyState
          icon={<TrendingUp size={28} />}
          title="Sin ventas en este período"
          description="Registrá ventas para ver tu rentabilidad."
        />
      ) : (
        <>
          {/* Indicators */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard label="Ventas" value={formatCurrency(totalRevenue, symbol)} icon={<DollarSign size={18} />} accent="primary" />
            <StatCard label="Costos" value={formatCurrency(totalCost, symbol)} icon={<TrendingDown size={18} />} accent="ink" />
            <StatCard label="Ganancia" value={formatCurrency(totalProfit, symbol)} icon={<TrendingUp size={18} />} accent={totalProfit >= 0 ? 'primary' : 'ink'} />
            <StatCard label="Margen" value={formatMargin(avgMargin)} icon={<Percent size={18} />} accent="blue" />
          </div>

          {/* Most profitable */}
          {mostProfitable.length > 0 && (
            <div>
              <h2 className="text-base font-display font-bold text-ink-900 mb-3 flex items-center gap-2">
                <Award size={18} className="text-accent-500" />
                Productos más rentables
              </h2>
              <div className="space-y-2">
                {mostProfitable.map((stat, idx) => {
                  const m = stat.revenue > 0 ? (stat.profit / stat.revenue) * 100 : 0;
                  return (
                    <div key={stat.product.id} className="card p-4 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                        idx === 0 ? 'bg-accent-100 text-accent-700' : 'bg-ink-100 text-ink-600'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-ink-900 truncate">{stat.product.name}</div>
                        <div className="text-xs text-ink-400">{stat.qty} unidades vendidas</div>
                      </div>
                      <div className="text-right">
                        <div className="font-display font-bold text-primary-600">{formatCurrency(stat.profit, symbol)}</div>
                        <div className="text-xs text-ink-400">{formatMargin(m)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Least profitable */}
          {leastProfitable.length > 0 && leastProfitable[0].profit < mostProfitable[0]?.profit && (
            <div>
              <h2 className="text-base font-display font-bold text-ink-900 mb-3 flex items-center gap-2">
                <AlertTriangle size={18} className="text-warning-500" />
                Productos menos rentables
              </h2>
              <div className="space-y-2">
                {leastProfitable.map((stat) => {
                  const m = stat.revenue > 0 ? (stat.profit / stat.revenue) * 100 : 0;
                  return (
                    <div key={stat.product.id} className="card p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-warning-600 bg-warning-50 flex-shrink-0">
                        <AlertTriangle size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-ink-900 truncate">{stat.product.name}</div>
                        <div className="text-xs text-ink-400">{stat.qty} unidades · {formatMargin(m)}</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-display font-bold ${stat.profit >= 0 ? 'text-ink-700' : 'text-error-600'}`}>
                          {formatCurrency(stat.profit, symbol)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
