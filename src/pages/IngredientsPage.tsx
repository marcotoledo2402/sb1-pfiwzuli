import { useEffect, useState, useCallback } from 'react';
import { Plus, Leaf, Pencil, Trash2, History, AlertTriangle, Search, Boxes } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatRelativeTime, formatDateShort, formatPercent, formatNumber } from '@/lib/format';
import { componentCost } from '@/lib/calc';
import { logActivity } from '@/lib/data';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { showToast } from '@/components/Toaster';
import type { Ingredient, IngredientPriceHistory, Product, ProductComponent, StockAdjustment } from '@/lib/types';
import { StockAdjustModal, fetchStockHistory } from '@/components/StockAdjustModal';

const UNITS = ['kg', 'g', 'litro', 'ml', 'unidad', 'metro', 'cm', 'docena'];
const CATEGORIES = ['General', 'Alimentos', 'Packaging', 'Velas', 'Cosmética', 'Textil', 'Madera', 'Otros'];

export function IngredientsPage() {
  const { user, business } = useAuth();
  const symbol = business?.currency_symbol || '$';

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Ingredient | null>(null);
  const [history, setHistory] = useState<IngredientPriceHistory[]>([]);
  const [impactData, setImpactData] = useState<{ product: Product; oldCost: number; newCost: number }[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<Ingredient | null>(null);
  const [stockHistoryOpen, setStockHistoryOpen] = useState<Ingredient | null>(null);
  const [stockHistory, setStockHistory] = useState<StockAdjustment[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [unit, setUnit] = useState('kg');
  const [price, setPrice] = useState('');
  const [packageQty, setPackageQty] = useState('1');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ingredients')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setIngredients(data as Ingredient[] || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setName('');
    setCategory('General');
    setUnit('kg');
    setPrice('');
    setPackageQty('1');
    setModalOpen(true);
  }

  function openEdit(ing: Ingredient) {
    setEditing(ing);
    setName(ing.name);
    setCategory(ing.category);
    setUnit(ing.unit);
    setPrice(String(ing.price));
    setPackageQty(String(ing.package_quantity));
    setModalOpen(true);
  }

  async function handleSave() {
    if (!user || !name.trim() || !price) return;
    setSaving(true);
    const priceNum = parseFloat(price);
    const pkgNum = parseFloat(packageQty) || 1;

    if (editing) {
      // Check if price changed to show impact
      const oldPrice = editing.price;
      const { error } = await supabase
        .from('ingredients')
        .update({
          name: name.trim(),
          category,
          unit,
          price: priceNum,
          package_quantity: pkgNum,
        })
        .eq('id', editing.id);

      if (!error) {
        // If price changed, compute impact on products
        if (oldPrice !== priceNum) {
          await computeImpact(editing.id, oldPrice, priceNum, pkgNum);
          await logActivity(user.id, 'ingredient_updated', `Actualizaste el precio de ${name.trim()}.`, 'ingredient', editing.id);
        } else {
          await logActivity(user.id, 'ingredient_updated', `Actualizaste ${name.trim()}.`, 'ingredient', editing.id);
        }
        showToast('success', 'Insumo actualizado.');
      }
    } else {
      const { data, error } = await supabase
        .from('ingredients')
        .insert({
          user_id: user.id,
          name: name.trim(),
          category,
          unit,
          price: priceNum,
          package_quantity: pkgNum,
        })
        .select()
        .single();
      if (!error) {
        await logActivity(user.id, 'ingredient_created', `Creaste el insumo ${name.trim()}.`, 'ingredient', data.id);
        showToast('success', 'Insumo creado.');
      }
    }
    setSaving(false);
    setModalOpen(false);
    await load();
  }

  async function computeImpact(ingredientId: string, oldPrice: number, newPrice: number, pkgQty: number) {
    if (!user) return;
    // Get all products that use this ingredient
    const { data: components } = await supabase
      .from('product_components')
      .select('*, ingredient!inner(*)')
      .eq('ingredient_id', ingredientId);

    if (!components || components.length === 0) {
      setImpactData(null);
      return;
    }

    const productIds = [...new Set(components.map((c: ProductComponent) => c.product_id))];
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (!products) return;

    // For each product, compute old and new cost
    const impact: { product: Product; oldCost: number; newCost: number }[] = [];
    for (const prod of products as Product[]) {
      // Get all components for this product
      const { data: allComponents } = await supabase
        .from('product_components')
        .select('*, ingredient!inner(*)')
        .eq('product_id', prod.id);

      if (!allComponents) continue;

      const oldCost = allComponents.reduce((sum, c) => {
        const ing = c.ingredient as Ingredient;
        const usePrice = ing.id === ingredientId ? oldPrice : ing.price;
        const usePkg = ing.id === ingredientId ? pkgQty : ing.package_quantity;
        return sum + (c.quantity * usePrice / (usePkg || 1));
      }, 0);

      const newCost = allComponents.reduce((sum, c) => {
        const ing = c.ingredient as Ingredient;
        return sum + componentCost(c.quantity, ing);
      }, 0);

      impact.push({ product: prod, oldCost, newCost });
    }

    setImpactData(impact);
  }

  async function openHistory(ing: Ingredient) {
    setHistoryOpen(ing);
    const { data } = await supabase
      .from('ingredient_price_history')
      .select('*')
      .eq('ingredient_id', ing.id)
      .order('changed_at', { ascending: false });
    setHistory(data as IngredientPriceHistory[] || []);
  }

  async function openStockHistory(ing: Ingredient) {
    setStockHistoryOpen(ing);
    const history = await fetchStockHistory('ingredient', ing.id);
    setStockHistory(history);
  }

  async function handleDelete() {
    if (!user || !deleteTarget) return;
    const { error } = await supabase.from('ingredients').delete().eq('id', deleteTarget.id);
    if (!error) {
      await logActivity(user.id, 'ingredient_deleted', `Eliminaste el insumo ${deleteTarget.name}.`);
      showToast('success', 'Insumo eliminado.');
    }
    setDeleteTarget(null);
    await load();
  }

  const filtered = ingredients.filter(
    (ing) =>
      ing.name.toLowerCase().includes(search.toLowerCase()) ||
      ing.category.toLowerCase().includes(search.toLowerCase())
  );

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
          <h1 className="text-2xl font-display font-bold text-ink-900">Mis insumos</h1>
          <p className="text-ink-500 text-sm mt-0.5">{ingredients.length} insumos cargados</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} /> <span className="hidden sm:inline">Nuevo insumo</span>
        </button>
      </div>

      {/* Search */}
      {ingredients.length > 0 && (
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Buscar insumo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-11"
          />
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Leaf size={28} />}
          title={ingredients.length === 0 ? 'Todavía no cargaste insumos' : 'Sin resultados'}
          description={ingredients.length === 0 ? 'Los insumos son las materias primas que usás para fabricar tus productos.' : 'Probá con otra búsqueda.'}
          action={ingredients.length === 0 ? <button onClick={openCreate} className="btn-primary"><Plus size={18} /> Agregar insumo</button> : undefined}
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((ing) => (
            <div key={ing.id} className="card p-4 flex flex-col gap-3 sm:flex-row sm:items-center hover:shadow-card-hover transition group">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                  <Leaf size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-900 truncate">{ing.name}</div>
                  <div className="text-xs text-ink-400 mt-0.5">
                    {ing.category} · {ing.unit} · Act. {formatRelativeTime(ing.updated_at)}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:flex-shrink-0">
                <div className="text-left sm:text-right">
                  <div className="font-display font-bold text-ink-900">{formatCurrency(ing.price, symbol)}</div>
                  {ing.package_quantity > 1 && (
                    <div className="text-xs text-ink-400">x{ing.package_quantity} {ing.unit}</div>
                  )}
                  <div className={`text-xs font-medium mt-0.5 ${(ing.current_stock ?? 0) <= 0 ? 'text-error-600' : 'text-ink-500'}`}>
                    Stock: {formatNumber(ing.current_stock ?? 0)} {ing.unit}
                  </div>
                </div>
                <div className="flex items-center flex-shrink-0">
                  <button onClick={() => openStockHistory(ing)} className="icon-btn text-ink-400 hover:bg-ink-100 hover:text-ink-600" title="Historial de stock">
                    <Boxes size={18} />
                  </button>
                  <button onClick={() => setAdjustTarget(ing)} className="icon-btn text-ink-400 hover:bg-blue-50 hover:text-blue-600" title="Ajustar stock">
                    <Pencil size={18} />
                  </button>
                  <button onClick={() => setDeleteTarget(ing)} className="icon-btn text-ink-400 hover:bg-error-50 hover:text-error-600" title="Eliminar">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar insumo' : 'Nuevo insumo'}
        subtitle={editing ? 'Actualizá los datos del insumo' : 'Agregá una materia prima o material'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !name.trim() || !price} className="btn-primary">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Chocolate semiamargo" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoría</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Unidad</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="input">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Precio de compra</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm">{symbol}</span>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="input pl-8" />
              </div>
            </div>
            <div>
              <label className="label">Cantidad por paquete</label>
              <input type="number" value={packageQty} onChange={(e) => setPackageQty(e.target.value)} placeholder="1" className="input" />
              <p className="text-xs text-ink-400 mt-1">Ej: comprás 1 kg, usás gramos</p>
            </div>
          </div>
          <div className="bg-ink-50 rounded-xl px-4 py-3 text-sm text-ink-600">
            <div className="flex items-center justify-between">
              <span>Precio por {unit}:</span>
              <span className="font-semibold text-ink-900">
                {formatCurrency(
                  (parseFloat(price) || 0) / (parseFloat(packageQty) || 1),
                  symbol
                )}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Cost impact modal */}
      <Modal
        open={impactData !== null}
        onClose={() => setImpactData(null)}
        title="Cambio de precio"
        subtitle="Este cambio afecta tus productos"
        footer={<button onClick={() => setImpactData(null)} className="btn-primary">Entendido</button>}
      >
        {!impactData || impactData.length === 0 ? (
          <p className="text-sm text-ink-500">Ningún producto usa este insumo.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-sm text-warning-700 bg-warning-50 border border-warning-200 rounded-xl px-4 py-3">
              <AlertTriangle size={18} className="flex-shrink-0" />
              <span>Este cambio afecta {impactData.length} {impactData.length === 1 ? 'producto' : 'productos'}.</span>
            </div>
            {impactData.map(({ product, oldCost, newCost }) => {
              const diff = newCost - oldCost;
              const pct = oldCost > 0 ? (diff / oldCost) * 100 : 0;
              return (
                <div key={product.id} className="card p-4">
                  <div className="font-medium text-ink-900 mb-2">{product.name}</div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-ink-400">Antes</div>
                      <div className="font-semibold text-ink-700">{formatCurrency(oldCost, symbol)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-ink-400">Ahora</div>
                      <div className="font-semibold text-ink-900">{formatCurrency(newCost, symbol)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-ink-400">Variación</div>
                      <div className={`font-semibold ${diff > 0 ? 'text-error-600' : diff < 0 ? 'text-primary-600' : 'text-ink-600'}`}>
                        {formatPercent(pct)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Price history modal */}
      <Modal
        open={historyOpen !== null}
        onClose={() => setHistoryOpen(null)}
        title="Historial de precio"
        subtitle={historyOpen?.name}
        footer={<button onClick={() => setHistoryOpen(null)} className="btn-primary">Cerrar</button>}
      >
        {history.length === 0 ? (
          <p className="text-sm text-ink-500">Sin cambios de precio registrados.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between py-2.5 border-b border-ink-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary-500" />
                  <div>
                    <div className="text-sm font-medium text-ink-900">
                      {h.old_price !== null ? formatCurrency(h.old_price, symbol) : '—'} → {formatCurrency(h.new_price, symbol)}
                    </div>
                    <div className="text-xs text-ink-400">{formatDateShort(h.changed_at)}</div>
                  </div>
                </div>
                {h.old_price !== null && h.old_price > 0 && (
                  <span className={`text-sm font-semibold ${h.new_price > h.old_price ? 'text-error-600' : 'text-primary-600'}`}>
                    {formatPercent(((h.new_price - h.old_price) / h.old_price) * 100)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <StockAdjustModal
        open={adjustTarget !== null}
        onClose={() => setAdjustTarget(null)}
        entityType="ingredient"
        entityId={adjustTarget?.id || ''}
        entityName={adjustTarget?.name || ''}
        currentStock={adjustTarget?.current_stock ?? 0}
        unit={adjustTarget?.unit}
        onAdjusted={load}
      />

      {/* Stock history modal */}
      <Modal
        open={stockHistoryOpen !== null}
        onClose={() => setStockHistoryOpen(null)}
        title="Historial de stock"
        subtitle={stockHistoryOpen?.name}
        footer={<button onClick={() => setStockHistoryOpen(null)} className="btn-primary">Cerrar</button>}
      >
        {stockHistory.length === 0 ? (
          <p className="text-sm text-ink-500">Sin ajustes de stock registrados.</p>
        ) : (
          <div className="space-y-2">
            {stockHistory.map((h) => (
              <div key={h.id} className="flex items-center justify-between py-2.5 border-b border-ink-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <div>
                    <div className="text-sm font-medium text-ink-900">
                      {formatNumber(h.old_stock)} → {formatNumber(h.new_stock)}
                    </div>
                    <div className="text-xs text-ink-400">{h.reason} · {formatDateShort(h.adjusted_at)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar insumo"
        message={`¿Seguro que querés eliminar "${deleteTarget?.name}"? Si lo usás en productos, se quitará de la fórmula.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
