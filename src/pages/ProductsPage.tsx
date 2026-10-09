import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Package,
  Pencil,
  Trash2,
  Search,
  ArrowRight,
  ArrowLeft,
  X,
  Check,
  TrendingUp,
  AlertTriangle,
  Boxes,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  formatCurrency,
  formatMargin,
  formatDateShort,
  formatPercent,
  formatNumber,
} from '@/lib/format';
import {
  componentCost,
  productUnitCost,
  unitProfit,
  margin,
  suggestedPrice,
  componentContribution,
  profitStatus,
} from '@/lib/calc';
import { logActivity } from '@/lib/data';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { showToast } from '@/components/Toaster';
import type {
  Ingredient,
  Product,
  ProductComponent,
  AdditionalCost,
  IngredientPriceHistory,
  StockAdjustment,
} from '@/lib/types';
import { StockAdjustModal, fetchStockHistory } from '@/components/StockAdjustModal';

const CATEGORIES = ['General', 'Alimentos', 'Velas', 'Cosmética', 'Textil', 'Madera', 'Artesanía', 'Otros'];
const UNITS = ['unidad', 'kg', 'g', 'litro', 'ml', 'docena', 'metro'];
const COST_TYPES = [
  { value: 'mano_obra', label: 'Mano de obra' },
  { value: 'electricidad', label: 'Electricidad' },
  { value: 'gas', label: 'Gas' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'otro', label: 'Otro' },
];

interface ComponentDraft {
  ingredient_id: string;
  quantity: string;
}

interface CostDraft {
  name: string;
  cost_type: string;
  amount: string;
  is_per_unit: boolean;
}

export function ProductsPage() {
  const { user, business } = useAuth();
  const symbol = business?.currency_symbol || '$';
  const defaultMargin = business?.default_margin || 50;
  const roundPrices = business?.round_prices || false;

  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create/edit wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [step, setStep] = useState(1);

  // Step 1: product info
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [unit, setUnit] = useState('unidad');

  // Step 2: recipe
  const [components, setComponents] = useState<ComponentDraft[]>([]);
  const [costs, setCosts] = useState<CostDraft[]>([]);

  // Step 3: price
  const [sellPrice, setSellPrice] = useState('');
  const [marginInput, setMarginInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Detail view
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Stock adjust
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [prodRes, ingRes] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('ingredients').select('*').eq('user_id', user.id).order('name', { ascending: true }),
    ]);
    setProducts(prodRes.data as Product[] || []);
    setIngredients(ingRes.data as Ingredient[] || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingProduct(null);
    setName('');
    setCategory('General');
    setUnit('unidad');
    setComponents([]);
    setCosts([]);
    setSellPrice('');
    setMarginInput(String(defaultMargin));
    setStep(1);
    setWizardOpen(true);
  }

  async function openEdit(prod: Product) {
    setEditingProduct(prod);
    setName(prod.name);
    setCategory(prod.category);
    setUnit(prod.unit);
    setSellPrice(String(prod.sell_price));

    // Load existing components
    const { data: comps } = await supabase
      .from('product_components')
      .select('*, ingredient!inner(*)')
      .eq('product_id', prod.id);
    setComponents((comps as ProductComponent[] || []).map((c) => ({
      ingredient_id: c.ingredient_id,
      quantity: String(c.quantity),
    })));

    // Load additional costs
    const { data: ac } = await supabase
      .from('additional_costs')
      .select('*')
      .eq('product_id', prod.id);
    setCosts((ac as AdditionalCost[] || []).map((c) => ({
      name: c.name,
      cost_type: c.cost_type,
      amount: String(c.amount),
      is_per_unit: c.is_per_unit,
    })));

    setMarginInput(String(defaultMargin));
    setStep(1);
    setWizardOpen(true);
  }

  // Computed cost from current draft
  const draftCost = (() => {
    const ingCost = components.reduce((sum, c) => {
      const ing = ingredients.find((i) => i.id === c.ingredient_id);
      if (!ing) return sum;
      return sum + componentCost(parseFloat(c.quantity) || 0, ing);
    }, 0);
    const addCost = costs
      .filter((c) => c.is_per_unit)
      .reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
    return ingCost + addCost;
  })();

  function addComponent() {
    if (ingredients.length === 0) {
      showToast('info', 'Primero creá un insumo.');
      return;
    }
    setComponents([...components, { ingredient_id: ingredients[0].id, quantity: '' }]);
  }

  function updateComponent(idx: number, field: keyof ComponentDraft, value: string) {
    const updated = [...components];
    updated[idx] = { ...updated[idx], [field]: value };
    setComponents(updated);
  }

  function removeComponent(idx: number) {
    setComponents(components.filter((_, i) => i !== idx));
  }

  function addCost() {
    setCosts([...costs, { name: '', cost_type: 'otro', amount: '', is_per_unit: true }]);
  }

  function updateCost(idx: number, field: keyof CostDraft, value: string | boolean) {
    const updated = [...costs];
    updated[idx] = { ...updated[idx], [field]: value } as CostDraft;
    setCosts(updated);
  }

  function removeCost(idx: number) {
    setCosts(costs.filter((_, i) => i !== idx));
  }

  function applyMargin() {
    const m = parseFloat(marginInput) || 0;
    const suggested = suggestedPrice(draftCost, m);
    const final = roundPrices ? Math.round(suggested / 50) * 50 : Math.round(suggested);
    setSellPrice(String(final));
  }

  function canSave() {
    return name.trim() && step === 3;
  }

  async function handleSave() {
    if (!user || !name.trim()) return;
    setSaving(true);

    const priceNum = parseFloat(sellPrice) || 0;

    try {
      let productId = editingProduct?.id;

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update({
            name: name.trim(),
            category,
            unit,
            sell_price: priceNum,
            current_cost: draftCost,
          })
          .eq('id', editingProduct.id);
        if (error) throw error;

        // Delete old components and costs
        await supabase.from('product_components').delete().eq('product_id', editingProduct.id);
        await supabase.from('additional_costs').delete().eq('product_id', editingProduct.id);

        await logActivity(user.id, 'product_updated', `Actualizaste ${name.trim()}.`, 'product', editingProduct.id);
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert({
            user_id: user.id,
            name: name.trim(),
            category,
            unit,
            sell_price: priceNum,
            current_cost: draftCost,
          })
          .select()
          .single();
        if (error) throw error;
        productId = data.id;
        await logActivity(user.id, 'product_created', `Creaste el producto ${name.trim()}.`, 'product', data.id);
      }

      if (productId) {
        // Insert components
        for (const c of components) {
          const qty = parseFloat(c.quantity);
          if (c.ingredient_id && qty > 0) {
            await supabase.from('product_components').insert({
              user_id: user.id,
              product_id: productId,
              ingredient_id: c.ingredient_id,
              quantity: qty,
            });
          }
        }
        // Insert additional costs
        for (const c of costs) {
          const amt = parseFloat(c.amount);
          if (c.name.trim() && amt > 0) {
            await supabase.from('additional_costs').insert({
              user_id: user.id,
              product_id: productId,
              name: c.name.trim(),
              cost_type: c.cost_type,
              amount: amt,
              is_per_unit: c.is_per_unit,
            });
          }
        }
      }

      showToast('success', editingProduct ? 'Producto actualizado.' : 'Producto creado.');
      setWizardOpen(false);
      await load();
    } catch {
      showToast('error', 'No se pudo guardar el producto.');
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!user || !deleteTarget) return;
    const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id);
    if (!error) {
      await logActivity(user.id, 'product_deleted', `Eliminaste el producto ${deleteTarget.name}.`);
      showToast('success', 'Producto eliminado.');
    }
    setDeleteTarget(null);
    await load();
  }

  const filtered = products.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase())
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
          <h1 className="text-2xl font-display font-bold text-ink-900">Mis productos</h1>
          <p className="text-ink-500 text-sm mt-0.5">{products.length} productos</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} /> <span className="hidden sm:inline">Nuevo producto</span>
        </button>
      </div>

      {products.length > 0 && (
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-11"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package size={28} />}
          title={products.length === 0 ? 'Todavía no creaste productos' : 'Sin resultados'}
          description={products.length === 0 ? 'Creá tu primer producto, definí su fórmula y descubrí cuánto te cuesta fabricarlo.' : 'Probá con otra búsqueda.'}
          action={products.length === 0 ? <button onClick={openCreate} className="btn-primary"><Plus size={18} /> Crear producto</button> : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((prod) => {
            const profit = unitProfit(prod.sell_price, prod.current_cost);
            const m = margin(prod.sell_price, prod.current_cost);
            const status = profitStatus(prod.sell_price, prod.current_cost);
            const statusColor = {
              green: 'bg-primary-50 text-primary-700',
              red: 'bg-error-50 text-error-700',
              yellow: 'bg-warning-50 text-warning-700',
            }[status.color];
            return (
              <div
                key={prod.id}
                className="card p-4 hover:shadow-card-hover transition cursor-pointer group"
                onClick={() => setDetailProduct(prod)}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                      <Package size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-ink-900 truncate">{prod.name}</div>
                      <div className="text-xs text-ink-400">{prod.category} · {prod.unit}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0 ${statusColor}`}>
                    {status.label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-ink-400">Costo</div>
                    <div className="font-semibold text-ink-700">{formatCurrency(prod.current_cost, symbol)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-400">Precio</div>
                    <div className="font-semibold text-ink-900">{formatCurrency(prod.sell_price, symbol)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-400">Margen</div>
                    <div className={`font-semibold ${m >= 20 ? 'text-primary-600' : m > 0 ? 'text-warning-600' : 'text-error-600'}`}>
                      {formatMargin(m)}
                    </div>
                  </div>
                </div>
                <div className={`text-xs font-medium mt-2 ${(prod.current_stock ?? 0) <= 0 ? 'text-error-600' : 'text-ink-500'}`}>
                  <Boxes size={12} className="inline mr-1" />
                  Stock: {formatNumber(prod.current_stock ?? 0)} {prod.unit}
                </div>
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-ink-100 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => { e.stopPropagation(); setAdjustTarget(prod); }}
                    className="btn-ghost text-xs"
                  >
                    <Boxes size={14} /> Stock
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(prod); }}
                    className="btn-ghost text-xs"
                  >
                    <Pencil size={14} /> Editar
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(prod); }}
                    className="btn-ghost text-xs text-error-600 hover:bg-error-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit wizard */}
      <Modal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title={editingProduct ? 'Editar producto' : 'Nuevo producto'}
        subtitle={`Paso ${step} de 3`}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => step > 1 ? setStep(step - 1) : setWizardOpen(false)}
              className="btn-secondary"
            >
              <ArrowLeft size={16} /> {step > 1 ? 'Atrás' : 'Cancelar'}
            </button>
            {step < 3 ? (
              <button onClick={() => setStep(step + 1)} disabled={step === 1 && !name.trim()} className="btn-primary">
                Siguiente <ArrowRight size={16} />
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : <><Check size={16} /> Guardar</>}
              </button>
            )}
          </div>
        }
      >
        {/* Step 1: Product info */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="label">¿Qué fabricás?</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Alfajor de Chocolate" className="input" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Categoría</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Unidad de venta</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className="input">
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Recipe */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="label mb-0">¿Qué necesitás para fabricarlo?</label>
                <button onClick={addComponent} className="text-sm text-primary-600 font-medium hover:underline">+ Agregar insumo</button>
              </div>
              {components.length === 0 ? (
                <div className="text-center py-6 text-sm text-ink-400 bg-ink-50 rounded-xl">
                  Agregá los insumos que usás para fabricar este producto
                </div>
              ) : (
                <div className="space-y-2">
                  {components.map((c, idx) => {
                    const ing = ingredients.find((i) => i.id === c.ingredient_id);
                    const cost = ing ? componentCost(parseFloat(c.quantity) || 0, ing) : 0;
                    return (
                      <div key={idx} className="flex items-center gap-2 bg-ink-50 rounded-xl p-2.5">
                        <select
                          value={c.ingredient_id}
                          onChange={(e) => updateComponent(idx, 'ingredient_id', e.target.value)}
                          className="input flex-1 py-2"
                        >
                          {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                        <input
                          type="number"
                          value={c.quantity}
                          onChange={(e) => updateComponent(idx, 'quantity', e.target.value)}
                          placeholder="Cantidad"
                          className="input w-24 py-2"
                        />
                        <span className="text-xs text-ink-400 w-8">{ing?.unit}</span>
                        <span className="text-sm font-medium text-ink-700 w-20 text-right">{formatCurrency(cost, symbol)}</span>
                        <button onClick={() => removeComponent(idx)} className="p-1.5 text-ink-400 hover:text-error-600">
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Additional costs */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="label mb-0">Costos adicionales (opcional)</label>
                <button onClick={addCost} className="text-sm text-primary-600 font-medium hover:underline">+ Agregar</button>
              </div>
              {costs.length === 0 ? (
                <p className="text-xs text-ink-400">Mano de obra, electricidad, packaging, etc.</p>
              ) : (
                <div className="space-y-2">
                  {costs.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-ink-50 rounded-xl p-2.5">
                      <select
                        value={c.cost_type}
                        onChange={(e) => updateCost(idx, 'cost_type', e.target.value)}
                        className="input flex-1 py-2"
                      >
                        {COST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <div className="relative w-24">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 text-xs">{symbol}</span>
                        <input
                          type="number"
                          value={c.amount}
                          onChange={(e) => updateCost(idx, 'amount', e.target.value)}
                          placeholder="0"
                          className="input pl-6 py-2"
                        />
                      </div>
                      <button onClick={() => removeCost(idx)} className="p-1.5 text-ink-400 hover:text-error-600">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live cost */}
            <div className="bg-primary-50 rounded-xl px-4 py-3.5 flex items-center justify-between">
              <span className="text-sm text-primary-700 font-medium">Costo de fabricación</span>
              <span className="text-xl font-display font-bold text-primary-700">{formatCurrency(draftCost, symbol)}</span>
            </div>
          </div>
        )}

        {/* Step 3: Price */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="label">¿A cuánto lo vendés?</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">{symbol}</span>
                <input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="0" className="input pl-8 text-lg font-medium" autoFocus />
              </div>
            </div>

            <div className="bg-ink-50 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-500">Costo:</span>
                <span className="font-semibold text-ink-700">{formatCurrency(draftCost, symbol)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-500">Ganancia por unidad:</span>
                <span className="font-semibold text-primary-600">
                  {formatCurrency((parseFloat(sellPrice) || 0) - draftCost, symbol)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2.5 border-t border-ink-200">
                <span className="text-ink-500">Margen:</span>
                <span className="font-semibold text-ink-900">
                  {formatMargin(margin(parseFloat(sellPrice) || 0, draftCost))}
                </span>
              </div>
            </div>

            {/* Margin helper */}
            <div className="border border-ink-200 rounded-xl p-4">
              <label className="label">¿Querés un margen específico?</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input type="number" value={marginInput} onChange={(e) => setMarginInput(e.target.value)} className="input pr-8" />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400">%</span>
                </div>
                <button onClick={applyMargin} className="btn-secondary whitespace-nowrap">Calcular precio</button>
              </div>
              <p className="text-xs text-ink-400 mt-2">
                Precio sugerido: {formatCurrency(suggestedPrice(draftCost, parseFloat(marginInput) || 0), symbol)}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Product detail */}
      <ProductDetail
        product={detailProduct}
        symbol={symbol}
        userId={user?.id || ''}
        onClose={() => setDetailProduct(null)}
        onEdit={(p) => { setDetailProduct(null); openEdit(p); }}
      />

      <StockAdjustModal
        open={adjustTarget !== null}
        onClose={() => setAdjustTarget(null)}
        entityType="product"
        entityId={adjustTarget?.id || ''}
        entityName={adjustTarget?.name || ''}
        currentStock={adjustTarget?.current_stock ?? 0}
        unit={adjustTarget?.unit}
        onAdjusted={load}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar producto"
        message={`¿Seguro que querés eliminar "${deleteTarget?.name}"? Se borrarán también su fórmula y costos.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ============ Product Detail ============
function ProductDetail({
  product,
  symbol,
  userId,
  onClose,
  onEdit,
}: {
  product: Product | null;
  symbol: string;
  userId: string;
  onClose: () => void;
  onEdit: (p: Product) => void;
}) {
  const [components, setComponents] = useState<ProductComponent[]>([]);
  const [costs, setCosts] = useState<AdditionalCost[]>([]);
  const [costHistory, setCostHistory] = useState<{ date: string; cost: number }[]>([]);
  const [priceChanges, setPriceChanges] = useState<IngredientPriceHistory[]>([]);

  useEffect(() => {
    if (!product) return;
    (async () => {
      const [compRes, costRes] = await Promise.all([
        supabase.from('product_components').select('*, ingredient!inner(*)').eq('product_id', product.id),
        supabase.from('additional_costs').select('*').eq('product_id', product.id),
      ]);
      setComponents(compRes.data as ProductComponent[] || []);
      setCosts(costRes.data as AdditionalCost[] || []);

      // Build cost history from ingredient price changes
      const ingredientIds = (compRes.data as ProductComponent[] || []).map((c) => c.ingredient_id);
      if (ingredientIds.length > 0) {
        const { data: changes } = await supabase
          .from('ingredient_price_history')
          .select('*')
          .in('ingredient_id', ingredientIds)
          .order('changed_at', { ascending: true });
        setPriceChanges(changes as IngredientPriceHistory[] || []);
      }
    })();
  }, [product, userId]);

  // Build approximate cost history from price changes
  useEffect(() => {
    if (!product || priceChanges.length === 0) {
      if (product) setCostHistory([{ date: new Date().toISOString(), cost: product.current_cost }]);
      return;
    }
    // Simple: show current cost and the dates of price changes
    const history: { date: string; cost: number }[] = [];
    history.push({ date: product.created_at, cost: product.current_cost });
    priceChanges.forEach((c) => {
      history.push({ date: c.changed_at, cost: product.current_cost });
    });
    // Deduplicate and sort
    const unique = history.filter((h, i, arr) => arr.findIndex((x) => x.date === h.date) === i);
    unique.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setCostHistory(unique.slice(-5));
  }, [product, priceChanges]);

  if (!product) return null;

  const cost = product.current_cost;
  const profit = unitProfit(product.sell_price, cost);
  const m = margin(product.sell_price, cost);
  const status = profitStatus(product.sell_price, cost);

  // Cost composition alerts
  const alerts: string[] = [];
  // Check if cost changed significantly
  const totalIngCost = components.reduce((sum, c) => {
    if (!c.ingredient) return sum;
    return sum + componentCost(c.quantity, c.ingredient);
  }, 0);

  if (cost > 0 && components.length > 0) {
    // Top contributor
    const topComponent = components
      .map((c) => ({ c, pct: componentContribution(c, totalIngCost) }))
      .sort((a, b) => b.pct - a.pct)[0];
    if (topComponent && topComponent.pct > 30 && topComponent.c.ingredient) {
      alerts.push(`${topComponent.c.ingredient.name} representa el ${topComponent.pct.toFixed(0)}% del costo del producto.`);
    }
  }

  return (
    <Modal
      open={product !== null}
      onClose={onClose}
      title={product.name}
      subtitle={`${product.category} · ${product.unit}`}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cerrar</button>
          <button onClick={() => onEdit(product)} className="btn-primary"><Pencil size={16} /> Editar</button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Key metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="card p-3.5">
            <div className="text-xs text-ink-400">Costo actual</div>
            <div className="text-lg font-display font-bold text-ink-900">{formatCurrency(cost, symbol)}</div>
          </div>
          <div className="card p-3.5">
            <div className="text-xs text-ink-400">Precio</div>
            <div className="text-lg font-display font-bold text-ink-900">{formatCurrency(product.sell_price, symbol)}</div>
          </div>
          <div className="card p-3.5">
            <div className="text-xs text-ink-400">Ganancia</div>
            <div className="text-lg font-display font-bold text-primary-600">{formatCurrency(profit, symbol)}</div>
          </div>
          <div className="card p-3.5">
            <div className="text-xs text-ink-400">Margen</div>
            <div className={`text-lg font-display font-bold ${m >= 20 ? 'text-primary-600' : m > 0 ? 'text-warning-600' : 'text-error-600'}`}>
              {formatMargin(m)}
            </div>
          </div>
          <div className="card p-3.5">
            <div className="text-xs text-ink-400">Stock</div>
            <div className={`text-lg font-display font-bold ${(product.current_stock ?? 0) <= 0 ? 'text-error-600' : 'text-ink-900'}`}>
              {formatNumber(product.current_stock ?? 0)}
            </div>
          </div>
        </div>

        <div className="text-sm text-ink-600 bg-primary-50 rounded-xl px-4 py-3">
          Ganás <strong className="text-primary-700">{formatCurrency(profit, symbol)}</strong> por unidad vendida.
        </div>

        {/* Composition */}
        <div>
          <h3 className="text-sm font-display font-bold text-ink-900 mb-2.5">Composición</h3>
          {components.length === 0 ? (
            <p className="text-sm text-ink-400">Sin insumos cargados.</p>
          ) : (
            <div className="space-y-2">
              {components.map((c) => {
                if (!c.ingredient) return null;
                const compCost = componentCost(c.quantity, c.ingredient);
                const pct = componentContribution(c, totalIngCost);
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-ink-700">{c.ingredient.name}</span>
                        <span className="text-ink-400 text-xs">{c.quantity} {c.ingredient.unit}</span>
                      </div>
                      <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-ink-700 w-20 text-right">{formatCurrency(compCost, symbol)}</span>
                  </div>
                );
              })}
              {costs.length > 0 && (
                <>
                  {costs.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm py-1">
                      <span className="text-ink-700">{c.name}</span>
                      <span className="font-medium text-ink-700">{formatCurrency(c.amount, symbol)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Cost history */}
        {costHistory.length > 1 && (
          <div>
            <h3 className="text-sm font-display font-bold text-ink-900 mb-2.5">Historial de costo</h3>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {costHistory.map((h, idx) => (
                <div key={idx} className="flex-shrink-0 card p-2.5 text-center min-w-[90px]">
                  <div className="text-xs text-ink-400">{formatDateShort(h.date)}</div>
                  <div className="text-sm font-semibold text-ink-900">{formatCurrency(h.cost, symbol)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div>
            <h3 className="text-sm font-display font-bold text-ink-900 mb-2.5 flex items-center gap-2">
              <AlertTriangle size={16} className="text-warning-500" /> Alertas
            </h3>
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-ink-700 bg-warning-50 border border-warning-200 rounded-xl px-4 py-2.5">
                  <AlertTriangle size={16} className="text-warning-500 flex-shrink-0" />
                  {a}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
