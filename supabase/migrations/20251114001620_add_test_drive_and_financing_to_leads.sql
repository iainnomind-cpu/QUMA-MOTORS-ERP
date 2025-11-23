/*
  # Agregar campos de prueba de manejo y financiamiento a leads

  1. Cambios en la tabla leads
    - Campos para prueba de manejo:
      - `test_drive_requested` (boolean) - Si solicitó prueba de manejo
      - `test_drive_date` (timestamptz) - Fecha programada de la prueba
      - `test_drive_completed` (boolean) - Si completó la prueba
    
    - Campos para financiamiento:
      - `requires_financing` (boolean) - Si requiere financiamiento
      - `down_payment_amount` (numeric) - Monto de enganche
      - `financing_term_months` (integer) - Plazo en meses
      - `monthly_payment_amount` (numeric) - Pago mensual estimado
    
    - Campos para documentos:
      - `has_id_document` (boolean) - Si subió INE
      - `has_income_proof` (boolean) - Si subió comprobante de ingresos
      - `has_address_proof` (boolean) - Si subió comprobante de domicilio
  
  2. Cambios en lead_attachments
    - Agregar campo `document_type` para categorizar documentos

  3. Índices
    - Índices para mejorar rendimiento de consultas

  4. Notas
    - Los archivos se almacenan en la tabla lead_attachments
    - Los campos de financiamiento son opcionales y solo se usan si requires_financing es true
*/

-- Agregar campos de prueba de manejo
ALTER TABLE leads ADD COLUMN IF NOT EXISTS test_drive_requested boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS test_drive_date timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS test_drive_completed boolean DEFAULT false;

-- Agregar campos de financiamiento
ALTER TABLE leads ADD COLUMN IF NOT EXISTS requires_financing boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS down_payment_amount numeric(10, 2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS financing_term_months integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS monthly_payment_amount numeric(10, 2);

-- Agregar campos de documentos (banderas)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_id_document boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_income_proof boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_address_proof boolean DEFAULT false;

-- Agregar categoría de tipo de documento a lead_attachments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_attachments' AND column_name = 'document_type'
  ) THEN
    ALTER TABLE lead_attachments ADD COLUMN document_type text;
  END IF;
END $$;

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_leads_test_drive_date ON leads(test_drive_date) WHERE test_drive_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_requires_financing ON leads(requires_financing) WHERE requires_financing = true;
CREATE INDEX IF NOT EXISTS idx_lead_attachments_document_type ON lead_attachments(document_type) WHERE document_type IS NOT NULL;
