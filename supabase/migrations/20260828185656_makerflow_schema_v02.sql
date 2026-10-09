/*
# MakerFlow V0.2 — Core Schema

## Overview
Creates the full database schema for MakerFlow, a manufacturing cost & pricing tool for small makers.
Each user sees only their own data. Auth is required (email/password).

## Tables
1. `businesses` — one per user, stores business name, currency, default margin, rounding preference
2. `ingredients` — raw materials/supplies (insumos) with current price, unit, category
3. `ingredient_price_history` — historical price changes for each ingredient
4. `products` — finished goods the user fabricates, with sell price and optional image
5. `product_components` — recipe lines: how much of each ingredient goes into a product
6. `additional_costs` — optional costs (labor, electricity, packaging, etc.) attached to a product
7. `productions` — batches fabricated: product + quantity + date + cost snapshot
8. `sales` — sales records: product + quantity + unit price + date
9. `settings` — user-level preferences (mirrors businesses settings, kept for flexibility)

## Key design decisions
- All tables are owner-scoped via `user_id` with `DEFAULT auth.uid()`.
- Child tables (product_components, additional_costs, productions, sales) scope through
  their parent's user_id using EXISTS checks in RLS policies.
- `ingredient_price_history` is append-only; the trigger `record_ingredient_price_change`
  inserts a history row whenever an ingredient's price changes on UPDATE.
- `productions` and `sales` store a `unit_cost_snapshot` so historical records remain
  accurate even when ingredient prices change later.
- `products.current_cost` is a cached value updated by the trigger `recalc_product_cost`
  whenever a related ingredient price or component quantity changes.
- Demo data flag `businesses.has_demo_data` prevents re-seeding.

## Security
- RLS enabled on every table.
- 4 CRUD policies per table (SELECT, INSERT, UPDATE, DELETE), scoped to `authenticated`.
- Owner checks use `auth.uid()` directly or via parent EXISTS.
*/

-- ============ businesses ============
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Mi negocio',
  currency text NOT NULL DEFAULT 'ARS',
  currency_symbol text NOT NULL DEFAULT '$',
  default_margin numeric NOT NULL DEFAULT 50,
  round_prices boolean NOT NULL DEFAULT false,
  has_demo_data boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_businesses" ON businesses;
CREATE POLICY "select_own_businesses" ON businesses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_businesses" ON businesses;
CREATE POLICY "insert_own_businesses" ON businesses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_businesses" ON businesses;
CREATE POLICY "update_own_businesses" ON businesses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_businesses" ON businesses;
CREATE POLICY "delete_own_businesses" ON businesses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ ingredients ============
CREATE TABLE IF NOT EXISTS ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  unit text NOT NULL DEFAULT 'unidad',
  price numeric NOT NULL DEFAULT 0,
  package_quantity numeric NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ingredients" ON ingredients;
CREATE POLICY "select_own_ingredients" ON ingredients FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ingredients" ON ingredients;
CREATE POLICY "insert_own_ingredients" ON ingredients FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_ingredients" ON ingredients;
CREATE POLICY "update_own_ingredients" ON ingredients FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ingredients" ON ingredients;
CREATE POLICY "delete_own_ingredients" ON ingredients FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ingredients_user_id ON ingredients(user_id);

-- ============ ingredient_price_history ============
CREATE TABLE IF NOT EXISTS ingredient_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  old_price numeric,
  new_price numeric NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ingredient_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ingredient_price_history" ON ingredient_price_history;
CREATE POLICY "select_own_ingredient_price_history" ON ingredient_price_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ingredient_price_history" ON ingredient_price_history;
CREATE POLICY "insert_own_ingredient_price_history" ON ingredient_price_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_ingredient_price_history" ON ingredient_price_history;
CREATE POLICY "update_own_ingredient_price_history" ON ingredient_price_history FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ingredient_price_history" ON ingredient_price_history;
CREATE POLICY "delete_own_ingredient_price_history" ON ingredient_price_history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_iph_ingredient_id ON ingredient_price_history(ingredient_id);

-- ============ products ============
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  unit text NOT NULL DEFAULT 'unidad',
  sell_price numeric NOT NULL DEFAULT 0,
  current_cost numeric NOT NULL DEFAULT 0,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_products" ON products;
CREATE POLICY "select_own_products" ON products FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_products" ON products;
CREATE POLICY "insert_own_products" ON products FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_products" ON products;
CREATE POLICY "update_own_products" ON products FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_products" ON products;
CREATE POLICY "delete_own_products" ON products FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);

-- ============ product_components ============
CREATE TABLE IF NOT EXISTS product_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_product_components" ON product_components;
CREATE POLICY "select_own_product_components" ON product_components FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_product_components" ON product_components;
CREATE POLICY "insert_own_product_components" ON product_components FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_product_components" ON product_components;
CREATE POLICY "update_own_product_components" ON product_components FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_product_components" ON product_components;
CREATE POLICY "delete_own_product_components" ON product_components FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pc_product_id ON product_components(product_id);
CREATE INDEX IF NOT EXISTS idx_pc_ingredient_id ON product_components(ingredient_id);

-- ============ additional_costs ============
CREATE TABLE IF NOT EXISTS additional_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  cost_type text NOT NULL DEFAULT 'otro',
  amount numeric NOT NULL DEFAULT 0,
  is_per_unit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE additional_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_additional_costs" ON additional_costs;
CREATE POLICY "select_own_additional_costs" ON additional_costs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_additional_costs" ON additional_costs;
CREATE POLICY "insert_own_additional_costs" ON additional_costs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_additional_costs" ON additional_costs;
CREATE POLICY "update_own_additional_costs" ON additional_costs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_additional_costs" ON additional_costs;
CREATE POLICY "delete_own_additional_costs" ON additional_costs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ac_product_id ON additional_costs(product_id);

-- ============ productions ============
CREATE TABLE IF NOT EXISTS productions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  unit_cost_snapshot numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  estimated_revenue numeric NOT NULL DEFAULT 0,
  estimated_profit numeric NOT NULL DEFAULT 0,
  produced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE productions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_productions" ON productions;
CREATE POLICY "select_own_productions" ON productions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_productions" ON productions;
CREATE POLICY "insert_own_productions" ON productions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_productions" ON productions;
CREATE POLICY "update_own_productions" ON productions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_productions" ON productions;
CREATE POLICY "delete_own_productions" ON productions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_productions_user_id ON productions(user_id);
CREATE INDEX IF NOT EXISTS idx_productions_product_id ON productions(product_id);

-- ============ sales ============
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  unit_cost_snapshot numeric NOT NULL DEFAULT 0,
  total_revenue numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  total_profit numeric NOT NULL DEFAULT 0,
  margin numeric NOT NULL DEFAULT 0,
  sold_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sales" ON sales;
CREATE POLICY "select_own_sales" ON sales FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_sales" ON sales;
CREATE POLICY "insert_own_sales" ON sales FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_sales" ON sales;
CREATE POLICY "update_own_sales" ON sales FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_sales" ON sales;
CREATE POLICY "delete_own_sales" ON sales FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id);

-- ============ settings ============
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  onboarding_step integer NOT NULL DEFAULT 0,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_settings" ON settings;
CREATE POLICY "select_own_settings" ON settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_settings" ON settings;
CREATE POLICY "insert_own_settings" ON settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_settings" ON settings;
CREATE POLICY "update_own_settings" ON settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_settings" ON settings;
CREATE POLICY "delete_own_settings" ON settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ activity_log ============
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  description text NOT NULL,
  entity_type text,
  entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_activity_log" ON activity_log;
CREATE POLICY "select_own_activity_log" ON activity_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_activity_log" ON activity_log;
CREATE POLICY "insert_own_activity_log" ON activity_log FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_activity_log" ON activity_log;
CREATE POLICY "update_own_activity_log" ON activity_log FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_activity_log" ON activity_log;
CREATE POLICY "delete_own_activity_log" ON activity_log FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_log(user_id);

-- ============ Triggers ============

-- Record price changes on ingredients
CREATE OR REPLACE FUNCTION record_ingredient_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.price IS DISTINCT FROM OLD.price THEN
    INSERT INTO ingredient_price_history (ingredient_id, user_id, old_price, new_price)
    VALUES (NEW.id, NEW.user_id, OLD.price, NEW.price);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ingredient_price_change ON ingredients;
CREATE TRIGGER trg_ingredient_price_change
  BEFORE UPDATE ON ingredients
  FOR EACH ROW
  EXECUTE FUNCTION record_ingredient_price_change();

-- Recalculate product current_cost when components change
CREATE OR REPLACE FUNCTION recalc_product_cost()
RETURNS TRIGGER AS $$
DECLARE
  pid uuid;
BEGIN
  pid := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE products SET current_cost = (
    SELECT COALESCE(SUM(pc.quantity * i.price / NULLIF(i.package_quantity, 0)), 0)
    FROM product_components pc
    JOIN ingredients i ON i.id = pc.ingredient_id
    WHERE pc.product_id = pid
  ) + COALESCE((
    SELECT SUM(ac.amount) FROM additional_costs ac
    WHERE ac.product_id = pid AND ac.is_per_unit = true
  ), 0)
  WHERE id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_pc_recalc ON product_components;
CREATE TRIGGER trg_pc_recalc
  AFTER INSERT OR UPDATE OR DELETE ON product_components
  FOR EACH ROW
  EXECUTE FUNCTION recalc_product_cost();

DROP TRIGGER IF EXISTS trg_ac_recalc ON additional_costs;
CREATE TRIGGER trg_ac_recalc
  AFTER INSERT OR UPDATE OR DELETE ON additional_costs
  FOR EACH ROW
  EXECUTE FUNCTION recalc_product_cost();

-- Auto-recalc products when ingredient price changes (trigger on ingredients AFTER UPDATE)
CREATE OR REPLACE FUNCTION recalc_products_on_ingredient_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.price IS DISTINCT FROM OLD.price THEN
    UPDATE products SET current_cost = (
      SELECT COALESCE(SUM(pc.quantity * i.price / NULLIF(i.package_quantity, 0)), 0)
      FROM product_components pc
      JOIN ingredients i ON i.id = pc.ingredient_id
      WHERE pc.product_id = products.id
    ) + COALESCE((
      SELECT SUM(ac.amount) FROM additional_costs ac
      WHERE ac.product_id = products.id AND ac.is_per_unit = true
    ), 0)
    WHERE products.user_id = NEW.user_id
      AND EXISTS (
        SELECT 1 FROM product_components pc2
        WHERE pc2.product_id = products.id AND pc2.ingredient_id = NEW.id
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ingredient_recalc_products ON ingredients;
CREATE TRIGGER trg_ingredient_recalc_products
  AFTER UPDATE ON ingredients
  FOR EACH ROW
  EXECUTE FUNCTION recalc_products_on_ingredient_change();
