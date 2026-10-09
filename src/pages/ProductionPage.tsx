import { useEffect, useState, useCallback } from 'react';
import { Plus, Factory, Trash2, Package, Boxes } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
} from '@/lib/format';
import { productionCost, estimatedRevenue, estimatedProfit } from '@/lib/calc';
import { logActivity } from '@/lib/data';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { showToast } from '@/components/Toaster';
import type { Product, Production, ProductComponent } from '@/lib/types';

export function ProductionPage() {
  const { user, business } = useAuth();
  const symbol = business?.currency_symbol || '$';

  const [productions, setProductions] = useState<Production[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Production | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [components, setComponents] = useState<ProductComponent[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const [prodRes, productRes] = await Promise.all([
      supabase
        .from('productions')
        .select('*, product!inner(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('user_id', user.id).eq('is_active', true).order('name'),
    ]);
    setProductions(prodRes.data as Production[] || []);
    setProducts(productRes.data as Product[] || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function loadComponents(productId: string) {
    const { data } = await supabase
      .from('product_components')
      .select('*, ingredient!inner(*)')
      .eq('product_id', productId);
    setComponents(data as ProductComponent[] || []);
  }

  function openCreate() {
    setSelectedProductId(products[0]?.id || '');
    setQuantity('1');
    setComponents([]);
    if (products[0]) loadComponents(products[0].id);
    setModalOpen(true);
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const qty = parseFloat(quantity) || 0;
  const unitCost = selectedProduct?.current_cost || 0;
  const totalCost = productionCost(unitCost, qty);
  const revenue = estimatedRevenue(selectedProduct?.sell_price || 0, qty);
  const profit = estimatedProfit(selectedProduct?.sell_price || 0, unitCost, qty);

  async function handleSave() {
    if (!user || !selectedProductId || qty <= 0) return;
    setSaving(true);
    const { error } = await supabase.from('productions').insert({
      user_id: user.id,
      product_id: selectedProductId,
      quantity: qty,
      unit_cost_snapshot: unitCost,
      total_cost: totalCost,
      estimated_revenue: revenue,
      estimated_profit: profit,
    });
    if (!error) {
      // Deduct ingredient stock and add product stock
      for (const c of components) {
        if (!c.ingredient) continue;
        const needed = c.quantity * qty;
        const newIngStock = (c.ingredient.current_stock ?? 0) - needed;
        await supabase
          .from('ingredients')
          .update({ current_stock: newIngStock })
          .eq('id', c.ingredient_id);
      }
      const newProdStock = (selectedProduct?.current_stock ?? 0) + qty;
      await supabase
        .from('products')
        .update({ current_stock: newProdStock })
        .eq('id', selectedProductId);

      const prod = products.find((p) => p.id === selectedProductId);
      await logActivity(
        user.id,
        'production_created',
        `Fabricaste ${formatNumber(qty)} unidades de ${prod?.name || 'producto'}.`,
        'production'
      );
      showToast('success', 'Producción registrada.');
      setModalOpen(false);
      await load();
    } else {
      showToast('error', 'No se pudo registrar la producción.');
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!user || !deleteTarget) return;
    // Revert stock: add back ingredients, subtract product stock
    const { data: comps } = await supabase
      .from('product_components')
      .select('*, ingredient!inner(*)')
      .eq('product_id', deleteTarget.product_id);
    if (comps) {
      for (const c of comps as ProductComponent[]) {
        if (!c.ingredient) continue;
        const usedQty = c.quantity * deleteTarget.quantity;
        const restoredStock = (c.ingredient.current_stock ?? 0) + usedQty;
        await supabase
          .from('ingredients')
          .update({ current_stock: restoredStock })
          .eq('id', c.ingredient_id);
      }
    }
    // Subtract the produced quantity from product stock
    if (deleteTarget.product) {
      const newProdStock = (deleteTarget.product.current_stock ?? 0) - deleteTarget.quantity;
      await supabase
        .from('products')
        .update({ current_stock: newProdStock })
        .eq('id', deleteTarget.product_id);
    }

    const { error } = await supabase.from('productions').delete().eq('id', deleteTarget.id);
    if (!error) {
      showToast('success', 'Producción eliminada. Stock revertido.');
    } else {
      showToast('error', 'No se pudo eliminar.');
    }
    setDeleteTarget(null);
    await load();
  }

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
          <h1 className="text-2xl font-display font-bold text-ink-900">Producción</h1>
          <p className="text-ink-500 text-sm mt-0.5">{productions.length} producciones registradas</p>
        </div>
        <button onClick={openCreate} disabled={products.length === 0} className="btn-primary">
          <Plus size={18} /> <span className="hidden sm:inline">Nueva producción</span>
        </button>
      </div>

      {productions.length === 0 ? (
        <EmptyState
          icon={<Factory size={28} />}
          title="Sin producciones registradas"
          description={products.length === 0 ? 'Primero creá un producto para poder registrar producciones.' : 'Registrá una producción para saber cuánto te cuesta fabricar.'}
          action={products.length > 0 ? <button onClick={openCreate} className="btn-primary"><Plus size={18} /> Nueva producción</button> : undefined}
        />
      ) : (
        <div className="space-y-2.5">
          {productions.map((prod) => (
            <div key={prod.id} className="card p-4 flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center flex-shrink-0">
                <Factory size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink-900 truncate">{prod.product?.name || 'Producto'}</div>
                <div className="text-xs text-ink-400 mt-0.5">
                  {formatNumber(prod.quantity)} unidades · {formatDateTime(prod.produced_at)}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-display font-bold text-ink-900">{formatCurrency(prod.total_cost, symbol)}</div>
                <div className="text-xs text-ink-400">Costo total</div>
              </div>
              <button
                onClick={() => setDeleteTarget(prod)}
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
        title="Nueva producción"
        subtitle="Registrá cuántas unidades fabricaste"
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !selectedProductId || qty <= 0} className="btn-primary">
              {saving ? 'Guardando...' : 'Registrar'}
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
                loadComponents(e.target.value);
              }}
              className="input"
            >
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Cantidad a fabricar</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ej: 100"
              className="input text-lg font-medium"
              autoFocus
            />
          </div>

          {/* Insumos needed */}
          {components.length > 0 && (
            <div>
              <label className="label">Insumos necesarios</label>
              <div className="space-y-2">
                {components.map((c) => {
                  if (!c.ingredient) return null;
                  const needed = c.quantity * qty;
                  const stock = c.ingredient.current_stock ?? 0;
                  const insufficient = stock < needed;
                  return (
                    <div key={c.id} className="flex items-center justify-between bg-ink-50 rounded-xl px-4 py-2.5 text-sm">
                      <div className="flex flex-col">
                        <span className="text-ink-700">{c.ingredient.name}</span>
                        <span className={`text-xs ${insufficient ? 'text-error-600 font-medium' : 'text-ink-400'}`}>
                          Stock: {formatNumber(stock)} {c.ingredient.unit}
                          {insufficient && ' · No alcanza'}
                        </span>
                      </div>
                      <span className={`font-medium ${insufficient ? 'text-error-600' : 'text-ink-900'}`}>
                        {formatNumber(needed)} {c.ingredient.unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stock info */}
          {selectedProduct && (
            <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
              <Boxes size={16} className="flex-shrink-0" />
              <span>Stock actual de {selectedProduct.name}: <strong>{formatNumber(selectedProduct.current_stock ?? 0)}</strong> {selectedProduct.unit}</span>
            </div>
          )}

          {/* Summary */}
          {selectedProduct && (
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-3.5 text-center">
                <div className="text-xs text-ink-400">Costo producción</div>
                <div className="text-base font-display font-bold text-ink-900">{formatCurrency(totalCost, symbol)}</div>
              </div>
              <div className="card p-3.5 text-center">
                <div className="text-xs text-ink-400">Venta estimada</div>
                <div className="text-base font-display font-bold text-ink-900">{formatCurrency(revenue, symbol)}</div>
              </div>
              <div className="card p-3.5 text-center">
                <div className="text-xs text-ink-400">Ganancia estimada</div>
                <div className="text-base font-display font-bold text-primary-600">{formatCurrency(profit, symbol)}</div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar producción"
        message="Al eliminar este registro, el stock de los insumos usados se va a sumar de vuelta y el stock del producto terminado se va a restar. ¿Querés continuar?"
        confirmLabel="Eliminar y revertir stock"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
