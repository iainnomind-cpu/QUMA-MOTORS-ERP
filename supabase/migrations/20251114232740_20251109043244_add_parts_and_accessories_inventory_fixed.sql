/*
  # Control de Inventario - Refacciones y Accesorios

  ## Nuevas Tablas
  
  ### `parts_accessories_inventory`
  Inventario principal de refacciones y accesorios
  
  ### `parts_sales`
  Registro de ventas de refacciones/accesorios
  
  ### `parts_inventory_movements`
  Historial de movimientos de inventario

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas restrictivas para usuarios autenticados
*/

-- Tabla principal de inventario de refacciones y accesorios
CREATE TABLE IF NOT EXISTS parts_accessories_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('refaccion', 'accesorio')),
  subcategory text,
  description text,
  compatible_models text[] DEFAULT '{}',
  brand text,
  price_retail numeric(10,2) NOT NULL DEFAULT 0,
  cost_price numeric(10,2) DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  min_stock_alert integer DEFAULT 5,
  location text,
  supplier text,
  image_url text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de ventas de refacciones/accesorios
CREATE TABLE IF NOT EXISTS parts_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_date timestamptz DEFAULT now(),
  customer_name text NOT NULL,
  customer_phone text,
  customer_type text DEFAULT 'walk-in' CHECK (customer_type IN ('walk-in', 'cliente', 'lead')),
  related_customer_id uuid,
  items jsonb NOT NULL DEFAULT '[]',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text,
  notes text,
  sold_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Tabla de movimientos de inventario
CREATE TABLE IF NOT EXISTS parts_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL REFERENCES parts_accessories_inventory(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('entrada', 'salida', 'ajuste', 'venta')),
  quantity integer NOT NULL,
  previous_stock integer NOT NULL,
  new_stock integer NOT NULL,
  reason text,
  reference_id uuid,
  performed_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_parts_category ON parts_accessories_inventory(category);
CREATE INDEX IF NOT EXISTS idx_parts_active ON parts_accessories_inventory(active);
CREATE INDEX IF NOT EXISTS idx_parts_stock ON parts_accessories_inventory(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_parts_sku ON parts_accessories_inventory(sku);
CREATE INDEX IF NOT EXISTS idx_sales_date ON parts_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_customer_type ON parts_sales(customer_type);
CREATE INDEX IF NOT EXISTS idx_movements_part ON parts_inventory_movements(part_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON parts_inventory_movements(movement_type);

-- Habilitar RLS
ALTER TABLE parts_accessories_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_inventory_movements ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuarios autenticados pueden ver inventario"
  ON parts_accessories_inventory FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar productos"
  ON parts_accessories_inventory FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar productos"
  ON parts_accessories_inventory FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar productos"
  ON parts_accessories_inventory FOR DELETE
  TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden ver ventas"
  ON parts_sales FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden registrar ventas"
  ON parts_sales FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar ventas"
  ON parts_sales FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden ver movimientos"
  ON parts_inventory_movements FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden registrar movimientos"
  ON parts_inventory_movements FOR INSERT
  TO authenticated WITH CHECK (true);

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_parts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar timestamp
DROP TRIGGER IF EXISTS update_parts_timestamp ON parts_accessories_inventory;
CREATE TRIGGER update_parts_timestamp
  BEFORE UPDATE ON parts_accessories_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_parts_updated_at();

-- Datos de ejemplo
INSERT INTO parts_accessories_inventory (sku, name, category, subcategory, description, compatible_models, brand, price_retail, cost_price, stock_quantity, min_stock_alert, location, supplier) VALUES
('REF-001', 'Filtro de Aceite Original', 'refaccion', 'Filtros', 'Filtro de aceite OEM para modelos Yamaha', ARRAY['MT-07', 'MT-09', 'YZF-R3'], 'Yamaha', 350.00, 200.00, 25, 10, 'A-01', 'Distribuidora Yamaha MX'),
('REF-002', 'Pastillas de Freno Delanteras', 'refaccion', 'Sistema de Frenado', 'Pastillas de freno delanteras de alto rendimiento', ARRAY['MT-07', 'Tracer 9 GT'], 'Yamaha', 1200.00, 700.00, 15, 8, 'A-02', 'Distribuidora Yamaha MX'),
('REF-003', 'Bujía NGK Iridium', 'refaccion', 'Sistema Eléctrico', 'Bujía de iridio de alto rendimiento', ARRAY['MT-07', 'MT-09', 'YZF-R3', 'Tenere 700'], 'NGK', 450.00, 250.00, 40, 15, 'A-03', 'Autopartes del Norte'),
('ACC-001', 'Casco Modular Yamaha', 'accesorio', 'Seguridad', 'Casco modular con certificación DOT/ECE', ARRAY[]::text[], 'Yamaha', 4500.00, 2500.00, 12, 5, 'B-01', 'Accesorios QuMa'),
('ACC-002', 'Maleta Lateral 30L', 'accesorio', 'Equipaje', 'Maleta lateral rígida 30L con sistema de montaje', ARRAY['Tracer 9 GT', 'Tenere 700'], 'Yamaha', 3200.00, 1800.00, 8, 4, 'B-02', 'Accesorios QuMa'),
('ACC-003', 'Guantes de Piel Racing', 'accesorio', 'Seguridad', 'Guantes de piel con protecciones en nudillos', ARRAY[]::text[], 'Alpinestars', 1800.00, 1000.00, 20, 10, 'B-03', 'Gear & More'),
('REF-004', 'Cadena de Transmisión 520', 'refaccion', 'Transmisión', 'Cadena reforzada O-ring 520 x 120 eslabones', ARRAY['MT-07', 'YZF-R3'], 'DID', 2100.00, 1200.00, 10, 5, 'A-04', 'Refacciones Especializadas'),
('ACC-004', 'Pantalla Parabrisas Touring', 'accesorio', 'Protección', 'Pantalla alta para protección en touring', ARRAY['MT-07', 'Tracer 9 GT'], 'Puig', 2800.00, 1600.00, 6, 3, 'B-04', 'Accesorios QuMa'),
('REF-005', 'Kit de Embrague Completo', 'refaccion', 'Transmisión', 'Kit completo de discos de embrague', ARRAY['MT-09', 'Tracer 9 GT'], 'Yamaha', 3500.00, 2000.00, 5, 3, 'A-05', 'Distribuidora Yamaha MX'),
('ACC-005', 'Sistema de Comunicación Bluetooth', 'accesorio', 'Electrónica', 'Sistema de comunicación intercomunicador bluetooth', ARRAY[]::text[], 'Sena', 5500.00, 3200.00, 10, 5, 'B-05', 'Gear & More')
ON CONFLICT (sku) DO NOTHING;