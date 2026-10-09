import { useEffect, useState, useCallback } from 'react';
import { Plus, ShoppingBag, Trash2, Boxes } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDateTime, formatNumber, formatMargin } from '@/lib/format';
import { margin as calcMargin } from '@/lib/calc';
import { logActivity } from '@/lib/data';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { showToast } from '@/components/Toaster';
import type { Product, Sale } from '@/lib/types';

export function SalesPage() {
  const { user, business } = useAuth();
  const symbol = business?.currency_symbol || '$';

  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const [salesRes, productRes] = await Promise.all([
      supabase
        .from('sales')
        .select('*, product!inner(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('user_id', user.id).eq('is_active', true).order('name'),
    ]);
    setSales(salesRes.data as Sale[] || []);
    setProducts(productRes.data as Product[] || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    const first = products[0];
    setSelectedProductId(first?.id || '');
    setQuantity('1');
    setUnitPrice(first ? String(first.sell_price) : '');
    setModalOpen(true);
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  const unitCost = selectedProduct?.current_cost || 0;
  const totalRevenue = price * qty;
  const totalCost = unitCost * qty;
  const totalProfit = totalRevenue - totalCost;
  const m = calcMargin(price, unitCost);

  async function handleSave() {
    if (!user || !selectedProductId || qty <= 0 || price <= 0) return;

    // Check stock availability
    if (selectedProduct && qty > (selectedProduct.current_stock ?? 0)) {
      showToast('error', `No hay stock suficiente. Disponible: ${formatNumber(selectedProduct.current_stock ?? 0)} ${selectedProduct.unit}.`);
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('sales').insert({
      user_id: user.id,
      product_id: selectedProductId,
      quantity: qty,
      unit_price: price,
      unit_cost_snapshot: unitCost,
      total_revenue: totalRevenue,
      total_cost: totalCost,
      total_profit: totalProfit,
      margin: m,
    });
    if (!error) {
      // Deduct product stock
      const newStock = (selectedProduct?.current_stock ?? 0) - qty;
      await supabase
        .from('products')
        .update({ current_stock: newStock })
        .eq('id', selectedProductId);

      const prod = products.find((p) => p.id === selectedProductId);
      await logActivity(
        user.id,
        'sale_created',
        `Registraste una venta de ${formatCurrency(totalRevenue, symbol)} (${prod?.name || 'producto'}).`,
        'sale'
      );
      showToast('success', 'Venta registrada.');
      setModalOpen(false);
      await load();
    } else {
      showToast('error', 'No se pudo registrar la venta.');
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!user || !deleteTarget) return;
    // Revert stock: add back the sold quantity to product stock
    if (deleteTarget.product) {
      const newStock = (deleteTarget.product.current_stock ?? 0) + deleteTarget.quantity;
      await supabase
        .from('products')
        .update({ current_stock: newStock })
        .eq('id', deleteTarget.product_id);
    }

    const { error } = await supabase.from('sales').delete().eq('id', deleteTarget.id);
    if (!error) {
      showToast('success', 'Venta eliminada. Stock revertido.');
    } else {
      showToast('error', 'No se pudo eliminar.');
    }
    setDeleteTarget(null);
    await load();
  }

  // Totals
  const totalRev = sales.reduce((sum, s) => sum + s.total_revenue, 0);
  const totalProfitAll = sales.reduce((sum, s) => sum + s.total_profit, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-ink-900">Ventas</h1>
          <p className="text-ink-500 text-sm mt-0.5">{sales.length} ventas registradas</p>
        </div>
        <button onClick={openCreate} disabled={products.length === 0} className="btn-primary">
          <Plus size={18} /> <span className="hidden sm:inline">Nueva venta</span>
        </button>
      </div>

      {sales.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="text-sm text-ink-500">Total vendido</div>
            <div className="text-2xl font-display font-bold text-ink-900">{formatCurrency(totalRev, symbol)}</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-ink-500">Ganancia total</div>
            <div className="text-2xl font-display font-bold text-primary-600">{formatCurrency(totalProfitAll, symbol)}</div>
          </div>
        </div>
      )}

      {sales.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={28} />}
          title="Sin ventas registradas"
          description={products.length === 0 ? 'Primero creá un producto para poder registrar ventas.' : 'Registrá tus ventas para conocer tu ganancia real.'}
          action={products.length > 0 ? <button onClick={openCreate} className="btn-primary"><Plus size={18} /> Nueva venta</button> : undefined}
        />
      ) : (
        <div className="space-y-2.5">
          {sales.map((sale) => (
            <div key={sale.id} className="card p-4 flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                <ShoppingBag size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink-900 truncate">{sale.product?.name || 'Producto'}</div>
                <div className="text-xs text-ink-400 mt-0.5">
                  {formatNumber(sale.quantity)} u × {formatCurrency(sale.unit_price, symbol)} · {formatDateTime(sale.sold_at)}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-display font-bold text-ink-900">{formatCurrency(sale.total_revenue, symbol)}</div>
                <div className="text-xs text-primary-600 font-medium">
                  +{formatCurrency(sale.total_profit, symbol)} · {formatMargin(sale.margin)}
                </div>
              </div>
              <button
                onClick={() => setDeleteTarget(sale)}
                className="p-2 rounded-lg text-ink-400 hover:bg-error-50 hover:text-error-600 transition opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nueva venta"
        subtitle="Registrá una venta para conocer tu ganancia"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !selectedProductId || qty <= 0 || price <= 0} className="btn-primary">
              {saving ? 'Guardando...' : 'Registrar venta'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Producto</label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                const p = products.find((x) => x.id === e.target.value);
                if (p) setUnitPrice(String(p.sell_price));
              }}
              className="input"
            >
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cantidad</label>
              <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Precio por unidad</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm">{symbol}</span>
                <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="input pl-8" />
              </div>
            </div>
          </div>

          {selectedProduct && (
            <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
              <Boxes size={16} className="flex-shrink-0" />
              <span>Stock disponible: <strong>{formatNumber(selectedProduct.current_stock ?? 0)}</strong> {selectedProduct.unit}
                {qty > (selectedProduct.current_stock ?? 0) && (
                  <span className="text-error-600 font-medium ml-2">· No alcanza</span>
                )}
              </span>
            </div>
          )}

          {selectedProduct && (
            <div className="space-y-2.5 bg-ink-50 rounded-xl p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-500">Total vendido:</span>
                <span className="font-semibold text-ink-900">{formatCurrency(totalRevenue, symbol)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-500">Costo:</span>
                <span className="font-semibold text-ink-700">{formatCurrency(totalCost, symbol)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-500">Ganancia:</span>
                <span className="font-semibold text-primary-600">{formatCurrency(totalProfit, symbol)}</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2.5 border-t border-ink-200">
                <span className="text-ink-500">Margen:</span>
                <span className="font-semibold text-ink-900">{formatMargin(m)}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar venta"
        message="Al eliminar este registro, el stock del producto vendido se va a sumar de vuelta. ¿Querés continuar?"
        confirmLabel="Eliminar y revertir stock"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
