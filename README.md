# MakerFlow

SaaS mobile-first para pequeños fabricantes/emprendedores (alimentos y productos manufacturados) para controlar insumos, recetas, costos, producción, stock, ventas y rentabilidad.

## Stack

- React + TypeScript + Vite
- Tailwind CSS (modo claro/oscuro)
- Supabase (Postgres + Row Level Security) para auth y datos

## Desarrollo local

```bash
npm install
npm run dev
```

Necesitás un archivo `.env` en la raíz (no se versiona) con:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Estos valores se obtienen desde el dashboard de Supabase del proyecto: **Settings → API**.

## Deploy

Pensado para desplegarse en Vercel (gratis), configurando las mismas dos variables de entorno de arriba en el proyecto de Vercel, apuntando a la base de datos Supabase existente (no crear un proyecto Supabase nuevo).

## Base de datos

Las migraciones SQL están en `supabase/migrations/`. Incluyen:
- Esquema base (negocios, insumos, productos, producción, ventas, configuración, log de actividad).
- Control de stock (`current_stock` en insumos/productos + tabla `stock_adjustments` con auditoría).
- Triggers: historial de precios de insumos y recálculo automático de costos de productos cuando cambia el precio de un insumo.
