-- ============================================================================
-- Tabla: parts_requests
-- Almacena las solicitudes de refacciones recibidas desde el bot de WhatsApp
-- ============================================================================

CREATE TABLE IF NOT EXISTS parts_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  part_name TEXT NOT NULL,
  motorcycle_model TEXT,
  city TEXT,
  state TEXT,
  branch_id UUID REFERENCES branches(id),
  assigned_manager_id UUID,
  assigned_manager_name TEXT,
  status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_proceso', 'completada', 'cancelada')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE parts_requests ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso público (la API usa anon key)
CREATE POLICY "Public insert parts_requests" ON parts_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read parts_requests" ON parts_requests FOR SELECT USING (true);
CREATE POLICY "Public update parts_requests" ON parts_requests FOR UPDATE USING (true);

-- Índices para búsquedas frecuentes
CREATE INDEX idx_parts_requests_branch ON parts_requests(branch_id);
CREATE INDEX idx_parts_requests_status ON parts_requests(status);
CREATE INDEX idx_parts_requests_created ON parts_requests(created_at DESC);
