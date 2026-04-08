-- 1. Limpiar políticas anteriores
DROP POLICY IF EXISTS "Gerentes insertan en su inventario" ON parts_inventory;
DROP POLICY IF EXISTS "Gerentes y Vendedores insertan en su inventario" ON parts_inventory;

-- 2. Crear política permitiendo SOLO a Gerentes y Admins (usando ID para mayor seguridad)
CREATE POLICY "Gerentes insertan en su inventario"
  ON parts_inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM user_profiles up
      WHERE up.id = auth.uid() 
      AND (
        -- Caso 1: Es Admin
        up.role = 'admin'
        OR
        -- Caso 2: Es Gerente coincidiendo sucursal
        (up.role = 'gerente' AND up.branch_id = parts_inventory.branch_id)
      )
    )
  );
