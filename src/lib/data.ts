import { supabase } from './supabase';
import { showToast } from '@/components/Toaster';
import type { ActivityLog } from './types';

/** Log a user activity entry */
export async function logActivity(
  userId: string,
  action: string,
  description: string,
  entityType?: string,
  entityId?: string
) {
  await supabase.from('activity_log').insert({
    user_id: userId,
    action,
    description,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
  });
}

/** Fetch recent activity for the dashboard */
export async function fetchActivity(userId: string, limit = 8): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data as ActivityLog[];
}

/** Seed demo data for a user. Returns true on success, false on failure. */
export async function seedDemoData(userId: string): Promise<boolean> {
  const ingredients = [
    { name: 'Harina 000', category: 'Alimentos', unit: 'kg', price: 1200, package_quantity: 1 },
    { name: 'Chocolate semiamargo', category: 'Alimentos', unit: 'kg', price: 5200, package_quantity: 1 },
    { name: 'Dulce de leche', category: 'Alimentos', unit: 'kg', price: 3800, package_quantity: 1 },
    { name: 'Azúcar', category: 'Alimentos', unit: 'kg', price: 900, package_quantity: 1 },
    { name: 'Manteca', category: 'Alimentos', unit: 'kg', price: 4500, package_quantity: 1 },
    { name: 'Envase alfajor', category: 'Packaging', unit: 'unidad', price: 80, package_quantity: 1 },
    { name: 'Cera de soja', category: 'Velas', unit: 'kg', price: 2800, package_quantity: 1 },
    { name: 'Esencia aromática', category: 'Velas', unit: 'ml', price: 350, package_quantity: 100 },
    { name: 'Pabilo', category: 'Velas', unit: 'unidad', price: 15, package_quantity: 1 },
    { name: 'Frasco vidrio 200g', category: 'Packaging', unit: 'unidad', price: 320, package_quantity: 1 },
    { name: 'Avena arrollada', category: 'Alimentos', unit: 'kg', price: 1600, package_quantity: 1 },
    { name: 'Miel', category: 'Alimentos', unit: 'kg', price: 4200, package_quantity: 1 },
    { name: 'Frutos secos mix', category: 'Alimentos', unit: 'kg', price: 6800, package_quantity: 1 },
  ];

  const createdIngredients: Record<string, string> = {};
  let ingErrors = 0;

  for (const ing of ingredients) {
    const { data, error } = await supabase
      .from('ingredients')
      .insert({ user_id: userId, ...ing })
      .select()
      .single();
    if (error) {
      ingErrors++;
    } else if (data) {
      createdIngredients[ing.name] = data.id;
    }
  }

  const products = [
    { name: 'Alfajor de Chocolate', category: 'Alimentos', unit: 'unidad', sell_price: 2550 },
    { name: 'Vela de Soja 200g', category: 'Velas', unit: 'unidad', sell_price: 3800 },
    { name: 'Granola Artesanal 300g', category: 'Alimentos', unit: 'unidad', sell_price: 4200 },
  ];

  const createdProducts: Record<string, string> = {};
  let prodErrors = 0;

  for (const prod of products) {
    const { data, error } = await supabase
      .from('products')
      .insert({ user_id: userId, ...prod })
      .select()
      .single();
    if (error) {
      prodErrors++;
    } else if (data) {
      createdProducts[prod.name] = data.id;
    }
  }

  const components = [
    { product: 'Alfajor de Chocolate', ingredient: 'Harina 000', quantity: 40 },
    { product: 'Alfajor de Chocolate', ingredient: 'Chocolate semiamargo', quantity: 25 },
    { product: 'Alfajor de Chocolate', ingredient: 'Dulce de leche', quantity: 30 },
    { product: 'Alfajor de Chocolate', ingredient: 'Envase alfajor', quantity: 1 },
    { product: 'Vela de Soja 200g', ingredient: 'Cera de soja', quantity: 180 },
    { product: 'Vela de Soja 200g', ingredient: 'Esencia aromática', quantity: 10 },
    { product: 'Vela de Soja 200g', ingredient: 'Pabilo', quantity: 1 },
    { product: 'Vela de Soja 200g', ingredient: 'Frasco vidrio 200g', quantity: 1 },
    { product: 'Granola Artesanal 300g', ingredient: 'Avena arrollada', quantity: 200 },
    { product: 'Granola Artesanal 300g', ingredient: 'Miel', quantity: 50 },
    { product: 'Granola Artesanal 300g', ingredient: 'Frutos secos mix', quantity: 50 },
    { product: 'Granola Artesanal 300g', ingredient: 'Frasco vidrio 200g', quantity: 1 },
  ];

  let compErrors = 0;
  for (const comp of components) {
    const pid = createdProducts[comp.product];
    const iid = createdIngredients[comp.ingredient];
    if (pid && iid) {
      const { error } = await supabase.from('product_components').insert({
        user_id: userId,
        product_id: pid,
        ingredient_id: iid,
        quantity: comp.quantity,
      });
      if (error) compErrors++;
    }
  }

  if (ingErrors > 0 || prodErrors > 0) {
    showToast('error', 'No se pudieron cargar todos los datos de ejemplo. Revisá tu conexión e intentá de nuevo.');
    return false;
  }

  const { error: bizError } = await supabase
    .from('businesses')
    .update({ has_demo_data: true })
    .eq('user_id', userId);

  await supabase
    .from('settings')
    .update({ onboarding_completed: true, onboarding_step: 6 })
    .eq('user_id', userId);

  await logActivity(userId, 'demo_seeded', 'Cargamos datos de ejemplo para que explores MakerFlow.');

  if (bizError) {
    showToast('info', 'Los datos se cargaron, pero no pudimos marcarlos como completos. Podés seguir usando MakerFlow normalmente.');
    return true;
  }

  showToast('success', 'Datos de demostración cargados. ¡Explorá MakerFlow!');
  return true;
}
