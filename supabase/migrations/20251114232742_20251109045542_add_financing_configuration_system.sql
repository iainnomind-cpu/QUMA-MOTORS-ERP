/*
  # Sistema de Configuración de Financiamiento QuMa Motors

  1. Nuevas Tablas
    - `financing_rules` - Reglas fijas de financiamiento
    - `financing_campaigns` - Campañas variables por modelo y periodo
    - `financing_calculations_log` - Registro de cálculos realizados

  2. Security
    - Enable RLS on all tables
    - Public access policies for demo/production use
*/

-- Tabla de reglas de financiamiento FIJAS
CREATE TABLE IF NOT EXISTS financing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financing_type text NOT NULL UNIQUE,
  min_term_months integer NOT NULL DEFAULT 6,
  max_term_months integer NOT NULL DEFAULT 24,
  interest_rate numeric(5,4) NOT NULL DEFAULT 0,
  min_down_payment_percent numeric(5,2) NOT NULL DEFAULT 0,
  fixed_down_payment_percent numeric(5,2),
  requires_minimum_price boolean DEFAULT false,
  minimum_price numeric(10,2),
  active boolean DEFAULT true,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de campañas de financiamiento VARIABLES
CREATE TABLE IF NOT EXISTS financing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name text NOT NULL,
  campaign_type text NOT NULL,
  provider text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  applicable_models text[] NOT NULL DEFAULT '{}',
  min_price numeric(10,2),
  max_price numeric(10,2),
  down_payment_percent numeric(5,2) NOT NULL,
  term_months integer NOT NULL,
  interest_rate numeric(5,4) NOT NULL DEFAULT 0,
  special_conditions jsonb DEFAULT '{}',
  benefits_description text,
  active boolean DEFAULT true,
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de log de cálculos de financiamiento
CREATE TABLE IF NOT EXISTS financing_calculations_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid,
  model text NOT NULL,
  price numeric(10,2) NOT NULL,
  financing_type text NOT NULL,
  campaign_id uuid,
  down_payment numeric(10,2) NOT NULL,
  term_months integer NOT NULL,
  monthly_payment numeric(10,2) NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  interest_amount numeric(10,2) NOT NULL,
  calculation_source text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE financing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE financing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE financing_calculations_log ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public access financing_rules"
  ON financing_rules FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access financing_campaigns"
  ON financing_campaigns FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public access financing_calculations_log"
  ON financing_calculations_log FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Insertar reglas fijas
INSERT INTO financing_rules (financing_type, min_term_months, max_term_months, interest_rate, min_down_payment_percent, description, active) VALUES
('Corto Plazo Interno', 6, 6, 0.1500, 20.00, 'Financiamiento interno de la concesionaria a 6 meses con tasa fija del 15% anual. Enganche mínimo 20%.', true),
('Caja Colón S/I 12', 12, 12, 0.0000, 30.00, 'Caja Cristóbal Colón 12 meses sin intereses. Enganche mínimo 30%.', true),
('Caja Colón S/I 18', 18, 18, 0.0000, 40.00, 'Caja Cristóbal Colón 18 meses sin intereses. Enganche mínimo 40%.', true),
('Tarjeta Bancaria S/I', 12, 12, 0.0000, 0.00, 'Financiamiento con tarjeta bancaria sin intereses a 12 meses.', true)
ON CONFLICT (financing_type) DO NOTHING;

-- Insertar campaña variable
INSERT INTO financing_campaigns (
  campaign_name, campaign_type, provider, start_date, end_date, 
  applicable_models, min_price, down_payment_percent, term_months, 
  interest_rate, benefits_description, active, priority, special_conditions
) VALUES (
  'Yamaha Especial Octubre-Diciembre 2025',
  'yamaha_special',
  'Yamaha Motor Finance',
  '2025-10-01',
  '2025-12-31',
  ARRAY['MT-07', 'YZF-R3', 'Tenere 700', 'Tracer 9 GT'],
  150000.00,
  50.00,
  12,
  0.0000,
  'Promoción exclusiva: 50% de enganche y 12 meses sin intereses en modelos seleccionados mayores a $150,000 MXN. Válido de octubre a diciembre 2025.',
  true,
  100,
  '{"show_promotion_banner": true, "hide_monthly_calculation": true, "contact_agent": true}'::jsonb
) ON CONFLICT DO NOTHING;

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_financing_rules_active ON financing_rules(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_financing_rules_type ON financing_rules(financing_type);
CREATE INDEX IF NOT EXISTS idx_financing_campaigns_dates ON financing_campaigns(start_date, end_date) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_financing_campaigns_models ON financing_campaigns USING GIN(applicable_models);
CREATE INDEX IF NOT EXISTS idx_financing_campaigns_active ON financing_campaigns(active, priority DESC) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_financing_calculations_log_created ON financing_calculations_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financing_calculations_log_source ON financing_calculations_log(calculation_source);