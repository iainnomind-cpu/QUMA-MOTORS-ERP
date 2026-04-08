-- =====================================================
-- MIGRACIÓN: Agregar coordenadas a sucursales para
-- asignación de leads por cercanía geográfica
-- =====================================================

-- 1. Agregar columnas de coordenadas y estado a branches
ALTER TABLE branches ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS state TEXT;

-- 2. Agregar city y state al lead para registro de ubicación
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_city TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_state TEXT;

-- 3. Agregar branch_id a sales_agents si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_agents' AND column_name='branch_id') THEN
    ALTER TABLE sales_agents ADD COLUMN branch_id UUID REFERENCES branches(id);
  END IF;
END $$;
