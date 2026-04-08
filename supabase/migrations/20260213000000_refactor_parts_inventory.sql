/*
  # Refactorización de Inventario de Refacciones (Multi-Sucursal)

  ## Descripción
  Este script migra la estructura de inventario de refacciones de un modelo de "tabla única"
  a un modelo de "Catálogo Central + Inventario Distribuido".

  ## Cambios
  1.  Renombra `parts_accessories_inventory` a `parts_catalog` (eliminando columnas de stock/ubicación).
  2.  Crea nueva tabla `parts_inventory` para manejar existencias por sucursal.
  3.  Migra el stock existente a la sucursal principal (la más antigua).
  4.  Inicializa stock en 0 para las demás sucursales.
  5.  Actualiza referencias en `parts_sales` y `parts_inventory_movements`.
*/

BEGIN;

-- 1. Renombrar tabla y ajustar estructura del Catálogo
ALTER TABLE parts_accessories_inventory RENAME TO parts_catalog;

-- Guardar columnas de stock temporalmente para migración
ALtER TABLE parts_catalog ADD COLUMN IF NOT EXISTS temp_stock integer;
ALTER TABLE parts_catalog ADD COLUMN IF NOT EXISTS temp_min_stock integer;
ALTER TABLE parts_catalog ADD COLUMN IF NOT EXISTS temp_location text;

UPDATE parts_catalog SET 
  temp_stock = stock_quantity,
  temp_min_stock = min_stock_alert,
  temp_location = location;

-- Eliminar columnas de inventario de la tabla de catálogo (ahora es solo definición)
ALTER TABLE parts_catalog 
  DROP COLUMN stock_quantity,
  DROP COLUMN min_stock_alert,
  DROP COLUMN location;

-- 2. Crear tabla de Inventario por Sucursal
CREATE TABLE IF NOT EXISTS parts_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  catalog_id uuid NOT NULL REFERENCES parts_catalog(id) ON DELETE CASCADE,
  stock_quantity integer NOT NULL DEFAULT 0,
  min_stock_alert integer DEFAULT 5,
  location text,
  last_inventory_check timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(branch_id, catalog_id)
);

-- 3. Migrar Stock Existente
-- Identificar la sucursal principal (la primera creada)
DO $$
DECLARE
  main_branch_id uuid;
  branch_rec record;
BEGIN
  SELECT id INTO main_branch_id FROM branches ORDER BY created_at ASC LIMIT 1;

  IF main_branch_id IS NOT NULL THEN
    -- Mover stock existente a la sucursal principal
    INSERT INTO parts_inventory (branch_id, catalog_id, stock_quantity, min_stock_alert, location)
    SELECT 
      main_branch_id,
      id,
      COALESCE(temp_stock, 0),
      COALESCE(temp_min_stock, 5),
      temp_location
    FROM parts_catalog;

    -- Inicializar en 0 para las demás sucursales
    FOR branch_rec IN SELECT id FROM branches WHERE id != main_branch_id LOOP
      INSERT INTO parts_inventory (branch_id, catalog_id, stock_quantity, min_stock_alert, location)
      SELECT 
        branch_rec.id,
        id,
        0,
        COALESCE(temp_min_stock, 5),
        NULL
      FROM parts_catalog
      ON CONFLICT (branch_id, catalog_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Limpiar columnas temporales
ALTER TABLE parts_catalog 
  DROP COLUMN temp_stock,
  DROP COLUMN temp_min_stock,
  DROP COLUMN temp_location;

-- 4. Actualizar Referencias y Políticas RLS

-- Habilitar RLS en nueva tabla
ALTER TABLE parts_inventory ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para parts_inventory
CREATE POLICY "Ver inventario de mi sucursal o global si soy admin"
  ON parts_inventory
  FOR SELECT
  TO authenticated
  USING (
    branch_id IN (
      SELECT branch_id FROM sales_agents WHERE email = auth.email()
    ) 
    OR 
    exists (select 1 from user_profiles where email = auth.email() and role in ('admin', 'gerente'))
  );

CREATE POLICY "Gerentes actualizan su inventario"
  ON parts_inventory
  FOR UPDATE
  TO authenticated
  USING (
    branch_id IN (
      SELECT branch_id FROM sales_agents WHERE email = auth.email()
    )
  )
  WITH CHECK (
    branch_id IN (
      SELECT branch_id FROM sales_agents WHERE email = auth.email()
    )
  );

CREATE POLICY "Admin gestión total de inventario"
  ON parts_inventory
  FOR ALL
  TO authenticated
  USING (
     exists (select 1 from user_profiles where email = auth.email() and role = 'admin')
  );

-- Actualizar parts_sales (si referenciaba items, ahora referencia catalog_id indirectamente a través del JSONB, 
-- pero si tiene una relación directa, habría que ver. La tabla parts_sales tenía 'items' jsonb, 
-- no foreign key directa por item, así que no requiere cambio estructural mayor, 
-- PERO sería bueno añadir `branch_id` a la venta si no lo tiene).

ALTER TABLE parts_sales ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);

-- Intentar poblar branch_id de ventas pasadas basado en el vendedor
UPDATE parts_sales ps
SET branch_id = sa.branch_id
FROM sales_agents sa
WHERE ps.sold_by = sa.id AND ps.branch_id IS NULL;

-- Asignar branch_id principal a ventas huérfanas (opcional, por seguridad)
DO $$
DECLARE
  main_branch_id uuid;
BEGIN
  SELECT id INTO main_branch_id FROM branches ORDER BY created_at ASC LIMIT 1;
  UPDATE parts_sales SET branch_id = main_branch_id WHERE branch_id IS NULL;
END $$;

-- Hacer branch_id opcionalmente NOT NULL en el futuro, por ahora dejarlo así.

-- Actualizar parts_inventory_movements
-- Necesitamos saber en qué sucursal ocurrió el movimiento.
ALTER TABLE parts_inventory_movements ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id);

-- Asignar branch_id a movimientos pasados (misma lógica, Main Branch por defecto)
DO $$
DECLARE
  main_branch_id uuid;
BEGIN
  SELECT id INTO main_branch_id FROM branches ORDER BY created_at ASC LIMIT 1;
  UPDATE parts_inventory_movements SET branch_id = main_branch_id WHERE branch_id IS NULL;
END $$;

-- Ahora movements debe apuntar a catalog_id (antes part_id apuntaba a parts_accessories_inventory que ahora es parts_catalog)
-- La FK se mantiene válida porque solo renombramos la tabla.
-- Pero semánticamente, un movimiento afecta al inventario de una sucursal.

COMMIT;
