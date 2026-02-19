-- SOLUCIÓN REAL: El problema nunca fue RLS, sino que la tabla parts_inventory
-- fue creada sin otorgar permisos de acceso al rol "authenticated".
-- Sin este GRANT, ninguna política RLS puede funcionar.

GRANT SELECT, INSERT, UPDATE, DELETE ON parts_inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON parts_inventory TO anon;
