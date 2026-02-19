-- SOLUCIÓN DEFINITIVA: Función de seguridad para evitar bloqueos de lectura RLS
-- Esta función se ejecuta con permisos de administrador (SECURITY DEFINER)
-- para verificar el rol del usuario sin restricciones.

-- 1. Crear la función verificadora
CREATE OR REPLACE FUNCTION check_inventory_insert_permission(target_branch_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- IMPORTANTE: Esto salta las restricciones RLS de user_profiles
SET search_path = public -- Seguridad para evitar inyecciones
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_profiles up
    WHERE up.id = auth.uid() 
    AND (
      -- Verificar Rol (case insensitive para seguridad)
      LOWER(up.role) = 'admin'
      OR
      (LOWER(up.role) = 'gerente' AND up.branch_id = target_branch_id)
    )
  );
END;
$$;

-- 2. Eliminar políticas anteriores defectuosas
DROP POLICY IF EXISTS "Gerentes insertan en su inventario" ON parts_inventory;
DROP POLICY IF EXISTS "Gerentes y Vendedores insertan en su inventario" ON parts_inventory;
DROP POLICY IF EXISTS "Admin gestión total de inventario" ON parts_inventory; -- La original también, por si acaso

-- 3. Crear política simplificada que usa la función
CREATE POLICY "Permitir insertar inventario"
  ON parts_inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (
    check_inventory_insert_permission(branch_id)
  );

-- 4. Para Diagnóstico (Opcional - Ejecutar para ver tu rol real)
-- SELECT id, email, role, branch_id FROM user_profiles WHERE id = auth.uid();
