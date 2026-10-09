export interface Business {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  currency_symbol: string;
  default_margin: number;
  round_prices: boolean;
  has_demo_data: boolean;
  created_at: string;
}

export interface Ingredient {
  id: string;
  user_id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  package_quantity: number;
  current_stock: number;
  updated_at: string;
  created_at: string;
}

export interface IngredientPriceHistory {
  id: string;
  ingredient_id: string;
  user_id: string;
  old_price: number | null;
  new_price: number;
  changed_at: string;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  category: string;
  unit: string;
  sell_price: number;
  current_cost: number;
  image_url: string | null;
  is_active: boolean;
  current_stock: number;
  created_at: string;
  updated_at: string;
}

export interface ProductComponent {
  id: string;
  product_id: string;
  ingredient_id: string;
  user_id: string;
  quantity: number;
  created_at: string;
  ingredient?: Ingredient;
}

export interface AdditionalCost {
  id: string;
  product_id: string;
  user_id: string;
  name: string;
  cost_type: string;
  amount: number;
  is_per_unit: boolean;
  created_at: string;
}

export interface Production {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  unit_cost_snapshot: number;
  total_cost: number;
  estimated_revenue: number;
  estimated_profit: number;
  produced_at: string;
  created_at: string;
  product?: Product;
}

export interface Sale {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  unit_cost_snapshot: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  margin: number;
  sold_at: string;
  created_at: string;
  product?: Product;
}

export interface Settings {
  id: string;
  user_id: string;
  onboarding_step: number;
  onboarding_completed: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  description: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

export interface StockAdjustment {
  id: string;
  user_id: string;
  entity_type: 'ingredient' | 'product';
  entity_id: string;
  old_stock: number;
  new_stock: number;
  reason: string;
  adjusted_at: string;
}

export type AppView =
  | 'dashboard'
  | 'ingredients'
  | 'products'
  | 'production'
  | 'sales'
  | 'profitability'
  | 'settings';
