-- CORRECCIÓN FINAL DE TODAS LAS POLÍTICAS DE INVENTARIO
-- Problema: La base de datos no permite búsquedas por email en políticas RLS.
-- Solución: Reemplazar TODAS las políticas para usar auth.uid() (ID de usuario).

-- 1. Eliminar TODAS las políticas existentes en parts_inventory para empezar limpio
DROP POLICY IF EXISTS "Ver inventario de mi sucursal o global si soy admin" ON parts_inventory;
DROP POLICY IF EXISTS "Gerentes actualizan su inventario" ON parts_inventory;
DROP POLICY IF EXISTS "Admin gestión total de inventario" ON parts_inventory;
DROP POLICY IF EXISTS "Gerentes insertan en su inventario" ON parts_inventory;
DROP POLICY IF EXISTS "Gerentes y Vendedores insertan en su inventario" ON parts_inventory;
DROP POLICY IF EXISTS "Debug Permitir Todo" ON parts_inventory;
DROP POLICY IF EXISTS "Permitir insertar inventario" ON parts_inventory;

-- 2. Política SELECT (Ver Inventario)
-- Permitido a: Admins (todo), Gerentes (su sucursal), Vendedores (su sucursal)
CREATE POLICY "Ver inventario"
  ON parts_inventory FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role = 'admin' 
        OR 
        (up.branch_id = parts_inventory.branch_id) -- Gerentes y Vendedores ven su sucursal
      )
    )
  );

-- 3. Política INSERT (Crear Inventario / Importar)
-- Permitido a: Admins (todo), Gerentes (su sucursal)
-- Vendedores NO pueden crear (deben pedir a gerente)
CREATE POLICY "Crear inventario"
  ON parts_inventory FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        LOWER(up.role) = 'admin'
        OR 
        (LOWER(up.role) = 'gerente' AND up.branch_id = parts_inventory.branch_id)
      )
    )
  );

-- 4. Política UPDATE (Actualizar Stock)
-- Permitido a: Admins (todo), Gerentes (su sucursal), Vendedores (su sucursal - al vender)
CREATE POLICY "Actualizar inventario"
  ON parts_inventory FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role = 'admin'
        OR 
        (up.branch_id = parts_inventory.branch_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role = 'admin'
        OR 
        (up.branch_id = parts_inventory.branch_id)
      )
    )
  );

-- 5. Política DELETE (Eliminar Inventario)
-- Solo Admins
CREATE POLICY "Eliminar inventario"
  ON parts_inventory FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    )
  );
