/*
# Add stock control to MakerFlow

## Overview
Adds inventory tracking: ingredients and products both get a `current_stock` column.
A new `stock_adjustments` table records manual stock corrections with a reason.
Production deducts ingredient stock and adds finished-product stock.
Sales deduct finished-product stock (blocked if insufficient).

## Changes
1. `ingredients.current_stock` (numeric, default 0) — raw material on hand
2. `products.current_stock` (numeric, default 0) — finished goods on hand
3. New table `stock_adjustments` — audit trail for manual corrections
   - entity_type: 'ingredient' | 'product'
   - entity_id: FK to ingredients or products (deferred, not enforced)
   - old_stock, new_stock, reason, adjusted_at

## Security
- RLS enabled on stock_adjustments, 4 owner-scoped CRUD policies.
*/

ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS current_stock numeric NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS current_stock numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  old_stock numeric NOT NULL DEFAULT 0,
  new_stock numeric NOT NULL DEFAULT 0,
  reason text NOT NULL,
  adjusted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_stock_adjustments" ON stock_adjustments;
CREATE POLICY "select_own_stock_adjustments" ON stock_adjustments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_stock_adjustments" ON stock_adjustments;
CREATE POLICY "insert_own_stock_adjustments" ON stock_adjustments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_stock_adjustments" ON stock_adjustments;
CREATE POLICY "update_own_stock_adjustments" ON stock_adjustments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_stock_adjustments" ON stock_adjustments;
CREATE POLICY "delete_own_stock_adjustments" ON stock_adjustments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sa_user_id ON stock_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_sa_entity ON stock_adjustments(entity_type, entity_id);
