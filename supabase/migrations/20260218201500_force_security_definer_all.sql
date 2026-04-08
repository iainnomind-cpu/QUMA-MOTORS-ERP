-- SOLUCIÓN FINAL UNIVERSAL
-- Reemplaza TODAS las políticas con una función SECURITY DEFINER
-- que garantiza acceso saltándose cualquier restricción de lectura en user_profiles.

-- 1. Función Maestra de Permisos (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION check_inventory_access(
  target_branch_id uuid,
  allow_manager boolean,
  allow_seller boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  user_role text;
  user_branch uuid;
BEGIN
  -- Obtener datos del usuario directamente (saltando RLS)
  SELECT role, branch_id INTO user_role, user_branch
  FROM user_profiles
  WHERE id = auth.uid();

  -- Normalizar rol
  user_role := LOWER(user_role);

  -- 1. Admin siempre pasa
  IF user_role = 'admin' THEN
    RETURN true;
  END IF;

  -- 2. Verificar rama (si no es admin, debe coincidir la rama)
  -- Nota: Si target_branch_id es NULL (ej. vista global), solo Admin pasa (ya verificado arriba).
  -- Si el usuario no tiene rama asignada, falla.
  IF user_branch IS NULL OR target_branch_id IS NULL OR user_branch != target_branch_id THEN
    RETURN false;
  END IF;

  -- 3. Verificar roles permitidos
  IF allow_manager AND user_role = 'gerente' THEN
    RETURN true;
  END IF;

  IF allow_seller AND user_role = 'vendedor' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 2. Limpiar TODO
DROP POLICY IF EXISTS "Ver inventario de mi sucursal o global si soy admin" ON parts_inventory;
DROP POLICY IF EXISTS "Gerentes actualizan su inventario" ON parts_inventory;
DROP POLICY IF EXISTS "Admin gestión total de inventario" ON parts_inventory;
DROP POLICY IF EXISTS "Gerentes insertan en su inventario" ON parts_inventory;
DROP POLICY IF EXISTS "Gerentes y Vendedores insertan en su inventario" ON parts_inventory;
DROP POLICY IF EXISTS "Debug Permitir Todo" ON parts_inventory;
DROP POLICY IF EXISTS "Permitir insertar inventario" ON parts_inventory;
DROP POLICY IF EXISTS "Ver inventario" ON parts_inventory;
DROP POLICY IF EXISTS "Crear inventario" ON parts_inventory;
DROP POLICY IF EXISTS "Actualizar inventario" ON parts_inventory;
DROP POLICY IF EXISTS "Eliminar inventario" ON parts_inventory;

-- 3. Nuevas Políticas usando la Función Maestra

-- SELECT: Admin, Gerente, Vendedor
CREATE POLICY "Ver inventario" ON parts_inventory FOR SELECT TO authenticated
USING ( check_inventory_access(branch_id, true, true) );

-- INSERT: Admin, Gerente (Vendedor NO)
CREATE POLICY "Crear inventario" ON parts_inventory FOR INSERT TO authenticated
WITH CHECK ( check_inventory_access(branch_id, true, false) );

-- UPDATE: Admin, Gerente, Vendedor (Ventas actualizan stock)
CREATE POLICY "Actualizar inventario" ON parts_inventory FOR UPDATE TO authenticated
USING ( check_inventory_access(branch_id, true, true) )
WITH CHECK ( check_inventory_access(branch_id, true, true) );

-- DELETE: Solo Admin (ni gerente ni vendedor)
CREATE POLICY "Eliminar inventario" ON parts_inventory FOR DELETE TO authenticated
USING ( check_inventory_access(branch_id, false, false) );
