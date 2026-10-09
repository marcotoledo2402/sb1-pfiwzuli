import type { Ingredient, ProductComponent, AdditionalCost } from './types';

/**
 * Cost of a single component = quantity × (ingredient price / package_quantity)
 * If the user buys 1kg of flour for $1200 and uses 40g, the cost is
 * 40 × (1200 / 1000) = $48
 */
export function componentCost(
  quantity: number,
  ingredient: Ingredient
): number {
  const pkgQty = ingredient.package_quantity || 1;
  return (quantity || 0) * ((ingredient.price || 0) / pkgQty);
}

/**
 * Total ingredient cost for a product from its components
 */
export function productIngredientCost(
  components: ProductComponent[]
): number {
  return components.reduce((sum, c) => {
    if (!c.ingredient) return sum;
    return sum + componentCost(c.quantity, c.ingredient);
  }, 0);
}

/**
 * Total additional cost (per-unit ones only)
 */
export function productAdditionalCost(costs: AdditionalCost[]): number {
  return costs
    .filter((c) => c.is_per_unit)
    .reduce((sum, c) => sum + (c.amount || 0), 0);
}

/**
 * Full unit cost = ingredient cost + per-unit additional costs
 */
export function productUnitCost(
  components: ProductComponent[],
  additionalCosts: AdditionalCost[] = []
): number {
  return productIngredientCost(components) + productAdditionalCost(additionalCosts);
}

/**
 * Profit per unit = sell price - unit cost
 */
export function unitProfit(sellPrice: number, unitCost: number): number {
  return (sellPrice || 0) - (unitCost || 0);
}

/**
 * Margin = profit / sellPrice × 100
 */
export function margin(sellPrice: number, unitCost: number): number {
  if (!sellPrice || sellPrice <= 0) return 0;
  return ((sellPrice - unitCost) / sellPrice) * 100;
}

/**
 * Suggested sell price from a desired margin
 * price = cost / (1 - margin/100)
 */
export function suggestedPrice(unitCost: number, desiredMargin: number): number {
  if (desiredMargin >= 100) return 0;
  return unitCost / (1 - desiredMargin / 100);
}

/**
 * Production total cost = unit cost × quantity
 */
export function productionCost(unitCost: number, quantity: number): number {
  return (unitCost || 0) * (quantity || 0);
}

/**
 * Estimated revenue = sell price × quantity
 */
export function estimatedRevenue(sellPrice: number, quantity: number): number {
  return (sellPrice || 0) * (quantity || 0);
}

/**
 * Estimated profit = revenue - production cost
 */
export function estimatedProfit(
  sellPrice: number,
  unitCost: number,
  quantity: number
): number {
  return estimatedRevenue(sellPrice, quantity) - productionCost(unitCost, quantity);
}

/**
 * Cost contribution percentage of a component within a product
 */
export function componentContribution(
  component: ProductComponent,
  totalCost: number
): number {
  if (!totalCost || totalCost <= 0 || !component.ingredient) return 0;
  const cost = componentCost(component.quantity, component.ingredient);
  return (cost / totalCost) * 100;
}

/**
 * Profitability status label
 */
export function profitStatus(sellPrice: number, unitCost: number): {
  label: string;
  color: 'green' | 'red' | 'yellow';
} {
  if (unitCost <= 0) return { label: 'Sin costo', color: 'yellow' };
  const m = margin(sellPrice, unitCost);
  if (sellPrice <= unitCost) return { label: 'Perdida', color: 'red' };
  if (m < 20) return { label: 'Margen bajo', color: 'yellow' };
  return { label: 'Rentable', color: 'green' };
}
