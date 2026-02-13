-- Habilitar RLS en la tabla branches (por si no estaba)
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes para evitar conflictos
DROP POLICY IF EXISTS "branches_select" ON branches;
DROP POLICY IF EXISTS "branches_insert" ON branches;
DROP POLICY IF EXISTS "branches_update" ON branches;
DROP POLICY IF EXISTS "branches_delete" ON branches;
DROP POLICY IF EXISTS "branches_all_admin" ON branches;

-- Crear nuevas políticas permisivas para usuarios autenticados
-- SELECT: Todos los usuarios autenticados pueden ver las sucursales
CREATE POLICY "branches_select" ON branches 
FOR SELECT TO authenticated 
USING (true);

-- INSERT: Usuarios autenticados pueden crear sucursales
CREATE POLICY "branches_insert" ON branches 
FOR INSERT TO authenticated 
WITH CHECK (true);

-- UPDATE: Usuarios autenticados pueden actualizar sucursales
CREATE POLICY "branches_update" ON branches 
FOR UPDATE TO authenticated 
USING (true)
WITH CHECK (true);

-- DELETE: Usuarios autenticados pueden eliminar sucursales
CREATE POLICY "branches_delete" ON branches 
FOR DELETE TO authenticated 
USING (true);
