/*
  # Agregar campos de prueba de manejo y financiamiento a leads

  1. Cambios en la tabla leads
    - Campos para prueba de manejo
    - Campos para financiamiento
    - Campos para documentos
  
  2. Cambios en lead_attachments
    - Agregar campo `document_type`

  3. Índices para mejorar rendimiento
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

-- Agregar campos de documentos
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

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_leads_test_drive_date ON leads(test_drive_date) WHERE test_drive_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_requires_financing ON leads(requires_financing) WHERE requires_financing = true;
CREATE INDEX IF NOT EXISTS idx_lead_attachments_document_type ON lead_attachments(document_type) WHERE document_type IS NOT NULL;