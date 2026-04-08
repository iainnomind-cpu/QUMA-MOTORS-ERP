-- =====================================================
-- MIGRACIÓN MULTI-SUCURSAL — QuMa Motors ERP
-- =====================================================

-- 1. Tabla principal de sucursales
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  city TEXT,
  phone TEXT,
  manager_name TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar sucursales iniciales si no existen (evitar duplicados)
INSERT INTO branches (name, code, address, city)
VALUES
  ('Sucursal Centro', 'CTR', 'Dirección Centro', 'Ciudad'),
  ('Sucursal Norte', 'NTE', 'Dirección Norte', 'Ciudad'),
  ('Sucursal Sur', 'SUR', 'Dirección Sur', 'Ciudad')
ON CONFLICT (code) DO NOTHING;

-- 2. Stock por sucursal (catálogo global, stock local)
-- CORREGIDO: Referencia a tabla 'catalog' en lugar de 'catalog_items'
CREATE TABLE IF NOT EXISTS branch_catalog_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  catalog_item_id UUID REFERENCES catalog(id) ON DELETE CASCADE NOT NULL,
  stock INTEGER DEFAULT 0,
  test_drive_available BOOLEAN DEFAULT false,
  UNIQUE(branch_id, catalog_item_id)
);

-- 3. Traspasos de refacciones entre sucursales
CREATE TABLE IF NOT EXISTS parts_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL,
  from_branch_id UUID REFERENCES branches(id) NOT NULL,
  to_branch_id UUID REFERENCES branches(id) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_transit','completed','cancelled')),
  requested_by UUID,
  approved_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 4. Agregar branch_id a tablas existentes
DO $$
DECLARE
  first_branch_id UUID;
BEGIN
  SELECT id INTO first_branch_id FROM branches WHERE code = 'CTR' LIMIT 1;

  -- user_profiles
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='branch_id') THEN
    ALTER TABLE user_profiles ADD COLUMN branch_id UUID REFERENCES branches(id);
    UPDATE user_profiles SET branch_id = first_branch_id WHERE branch_id IS NULL;
  END IF;

  -- leads
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='branch_id') THEN
    ALTER TABLE leads ADD COLUMN branch_id UUID REFERENCES branches(id);
    UPDATE leads SET branch_id = first_branch_id WHERE branch_id IS NULL;
  END IF;

  -- clients
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='branch_id') THEN
    ALTER TABLE clients ADD COLUMN branch_id UUID REFERENCES branches(id);
    UPDATE clients SET branch_id = first_branch_id WHERE branch_id IS NULL;
  END IF;

  -- parts_accessories_inventory
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parts_accessories_inventory' AND column_name='branch_id') THEN
    ALTER TABLE parts_accessories_inventory ADD COLUMN branch_id UUID REFERENCES branches(id);
    UPDATE parts_accessories_inventory SET branch_id = first_branch_id WHERE branch_id IS NULL;
  END IF;

  -- parts_sales
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parts_sales' AND column_name='branch_id') THEN
    ALTER TABLE parts_sales ADD COLUMN branch_id UUID REFERENCES branches(id);
    UPDATE parts_sales SET branch_id = first_branch_id WHERE branch_id IS NULL;
  END IF;

  -- parts_inventory_movements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parts_inventory_movements' AND column_name='branch_id') THEN
    ALTER TABLE parts_inventory_movements ADD COLUMN branch_id UUID REFERENCES branches(id);
    UPDATE parts_inventory_movements SET branch_id = first_branch_id WHERE branch_id IS NULL;
  END IF;

  -- test_drive_appointments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='test_drive_appointments' AND column_name='branch_id') THEN
    ALTER TABLE test_drive_appointments ADD COLUMN branch_id UUID REFERENCES branches(id);
    UPDATE test_drive_appointments SET branch_id = first_branch_id WHERE branch_id IS NULL;
  END IF;

  -- service_appointments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_appointments' AND column_name='branch_id') THEN
    ALTER TABLE service_appointments ADD COLUMN branch_id UUID REFERENCES branches(id);
    UPDATE service_appointments SET branch_id = first_branch_id WHERE branch_id IS NULL;
  END IF;

  -- service_history
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_history' AND column_name='branch_id') THEN
    ALTER TABLE service_history ADD COLUMN branch_id UUID REFERENCES branches(id);
    UPDATE service_history SET branch_id = first_branch_id WHERE branch_id IS NULL;
  END IF;

  -- service_technicians
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_technicians' AND column_name='branch_id') THEN
    ALTER TABLE service_technicians ADD COLUMN branch_id UUID REFERENCES branches(id);
    UPDATE service_technicians SET branch_id = first_branch_id WHERE branch_id IS NULL;
  END IF;

  -- financing_rules (NULL = global)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='financing_rules' AND column_name='branch_id') THEN
    ALTER TABLE financing_rules ADD COLUMN branch_id UUID REFERENCES branches(id);
  END IF;

  -- financing_campaigns (NULL = global)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='financing_campaigns' AND column_name='branch_id') THEN
    ALTER TABLE financing_campaigns ADD COLUMN branch_id UUID REFERENCES branches(id);
  END IF;

  -- automated_campaigns (NULL = todas las sucursales)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automated_campaigns' AND column_name='branch_id') THEN
    ALTER TABLE automated_campaigns ADD COLUMN branch_id UUID REFERENCES branches(id);
  END IF;

  -- campaign_logs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaign_logs' AND column_name='branch_id') THEN
    ALTER TABLE campaign_logs ADD COLUMN branch_id UUID REFERENCES branches(id);
  END IF;

  -- activity_logs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='branch_id') THEN
    ALTER TABLE activity_logs ADD COLUMN branch_id UUID REFERENCES branches(id);
  END IF;
END $$;

-- 5. Habilitar RLS en nuevas tablas
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_catalog_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_transfers ENABLE ROW LEVEL SECURITY;

-- Policies permisivas (lectura para autenticados)
-- Usamos DO blocks o DROP IF EXISTS para evitar errores de duplicado si se re-ejecuta

DO $$ BEGIN
  CREATE POLICY "branches_select" ON branches FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "branches_all_admin" ON branches FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "branch_stock_select" ON branch_catalog_stock FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "branch_stock_all" ON branch_catalog_stock FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "parts_transfers_select" ON parts_transfers FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "parts_transfers_all" ON parts_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
