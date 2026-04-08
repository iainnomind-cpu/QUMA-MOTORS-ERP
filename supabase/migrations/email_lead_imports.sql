-- =====================================================
-- Tabla: email_lead_imports
-- Registro de todos los correos de Yamaha procesados
-- para evitar duplicados y auditoría
-- =====================================================

CREATE TABLE IF NOT EXISTS email_lead_imports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_message_id text UNIQUE NOT NULL,
  from_email text,
  subject text,
  lead_name text,
  lead_phone text,
  lead_email text,
  model_interested text,
  lead_state text,
  payment_method text,
  distributor text,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  status text DEFAULT 'success' CHECK (status IN ('success', 'error', 'duplicate', 'skipped')),
  error_message text,
  raw_body text,
  synced_by text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_email_lead_imports_gmail_id ON email_lead_imports(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_email_lead_imports_created ON email_lead_imports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_lead_imports_status ON email_lead_imports(status);

-- RLS: permitir acceso completo a usuarios autenticados
ALTER TABLE email_lead_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_lead_imports_all" ON email_lead_imports
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Insertar configuración de Gmail en system_settings
-- (si no existe)
-- =====================================================
INSERT INTO system_settings (setting_key, setting_value, category, description, editable_by_role, is_public)
VALUES (
  'gmail_leads_config',
  '{
    "label": "Configuración Email Leads (Yamaha)",
    "type": "json",
    "value": {
      "gmail_email": "",
      "gmail_app_password": "",
      "sender_filter": "cliente_potencial@yamaha-motor.com.mx",
      "auto_sync_enabled": false,
      "sync_interval_minutes": 30,
      "enabled": false,
      "last_sync_at": null,
      "last_sync_result": null
    }
  }'::jsonb,
  'integrations',
  'Configuración para importar leads automáticamente desde correos de Gmail (Yamaha Motor de México)',
  ARRAY['admin'],
  false
)
ON CONFLICT (setting_key) DO NOTHING;
