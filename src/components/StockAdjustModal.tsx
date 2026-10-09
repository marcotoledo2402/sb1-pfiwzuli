import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Modal } from './Modal';
import { showToast } from './Toaster';
import type { StockAdjustment } from '@/lib/types';

const REASONS = ['Ajuste manual', 'Error de carga', 'Diferencia de inventario', 'Pérdida o merma', 'Otro'];

interface StockAdjustModalProps {
  open: boolean;
  onClose: () => void;
  entityType: 'ingredient' | 'product';
  entityId: string;
  entityName: string;
  currentStock: number;
  unit?: string;
  onAdjusted: () => void;
}

export function StockAdjustModal({
  open,
  onClose,
  entityType,
  entityId,
  entityName,
  currentStock,
  unit,
  onAdjusted,
}: StockAdjustModalProps) {
  const [newStock, setNewStock] = useState(String(currentStock));
  const [reason, setReason] = useState(REASONS[0]);
  const [saving, setSaving] = useState(false);

  const table = entityType === 'ingredient' ? 'ingredients' : 'products';
  const newStockNum = parseFloat(newStock) || 0;

  async function handleSave() {
    setSaving(true);
    const { error: updateError } = await supabase
      .from(table)
      .update({ current_stock: newStockNum })
      .eq('id', entityId);

    if (updateError) {
      showToast('error', 'No se pudo ajustar el stock.');
      setSaving(false);
      return;
    }

    const { error: histError } = await supabase.from('stock_adjustments').insert({
      entity_type: entityType,
      entity_id: entityId,
      old_stock: currentStock,
      new_stock: newStockNum,
      reason,
    });

    if (histError) {
      showToast('error', 'Stock ajustado pero no se guardó el historial.');
    } else {
      showToast('success', 'Stock ajustado correctamente.');
    }

    setSaving(false);
    onClose();
    onAdjusted();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajustar stock"
      subtitle={entityName}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !reason} className="btn-primary">
            {saving ? 'Guardando...' : 'Guardar ajuste'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-ink-50 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-ink-500">Stock actual:</span>
          <span className="font-semibold text-ink-900">
            {currentStock} {unit || ''}
          </span>
        </div>
        <div>
          <label className="label">Stock nuevo</label>
          <input
            type="number"
            value={newStock}
            onChange={(e) => setNewStock(e.target.value)}
            className="input text-lg font-medium"
            autoFocus
          />
          <p className="text-xs text-ink-400 mt-1">
            Diferencia: {newStockNum >= currentStock ? '+' : ''}{(newStockNum - currentStock).toFixed(2)} {unit || ''}
          </p>
        </div>
        <div>
          <label className="label">Motivo del ajuste</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="input">
            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}

export async function fetchStockHistory(
  entityType: 'ingredient' | 'product',
  entityId: string
): Promise<StockAdjustment[]> {
  const { data, error } = await supabase
    .from('stock_adjustments')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('adjusted_at', { ascending: false });
  if (error) return [];
  return data as StockAdjustment[];
}
