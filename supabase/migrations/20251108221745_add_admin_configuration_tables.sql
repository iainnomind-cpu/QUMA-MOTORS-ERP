/*
  # Admin Configuration & BPM Module

  1. New Tables
    - system_users: User management with roles and permissions
    - scoring_rules: Configurable lead scoring rules
    - financial_promotions: Financial campaign management
    - system_settings: Global system configuration
    - activity_logs: Audit trail for all system changes

  2. Security
    - Enable RLS on all tables
    - Add policies for public access (demo purposes)
*/

CREATE TABLE IF NOT EXISTS system_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'agent',
  status text DEFAULT 'active',
  permissions jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL,
  rule_type text NOT NULL,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  score_impact integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financial_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  promotion_type text NOT NULL,
  conditions jsonb DEFAULT '{}'::jsonb,
  benefits jsonb DEFAULT '{}'::jsonb,
  active boolean DEFAULT true,
  start_date timestamptz,
  end_date timestamptz,
  applicable_models text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL,
  description text,
  editable_by_role text[],
  updated_by uuid,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  changes jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access system_users" ON system_users FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access scoring_rules" ON scoring_rules FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access financial_promotions" ON financial_promotions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access system_settings" ON system_settings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Public access activity_logs" ON activity_logs FOR ALL TO anon USING (true) WITH CHECK (true);

INSERT INTO system_users (name, email, role, status, permissions) VALUES
  ('Admin Principal', 'admin@qumamotors.com', 'admin', 'active', '{"all": true}'::jsonb),
  ('Gerente Ventas', 'gerente.ventas@qumamotors.com', 'manager', 'active', '{"view_all_leads": true, "assign_leads": true, "view_reports": true, "manage_agents": true}'::jsonb),
  ('Marketing Manager', 'marketing@qumamotors.com', 'marketing', 'active', '{"view_campaigns": true, "create_campaigns": true, "view_analytics": true}'::jsonb);

INSERT INTO system_users (name, email, role, status, permissions)
SELECT name, email, 'agent' as role, 'active' as status, '{"view_assigned_leads": true, "update_assigned_leads": true}'::jsonb
FROM sales_agents WHERE email IS NOT NULL;

INSERT INTO scoring_rules (rule_name, rule_type, criteria, score_impact, active, priority) VALUES
  ('Estado Verde - Alta Intención', 'status_threshold', '{"min_score": 80, "target_status": "Verde"}'::jsonb, 0, true, 10),
  ('Estado Amarillo - Media Intención', 'status_threshold', '{"min_score": 60, "max_score": 79, "target_status": "Amarillo"}'::jsonb, 0, true, 9),
  ('Estado Rojo - Baja Intención', 'status_threshold', '{"max_score": 59, "target_status": "Rojo"}'::jsonb, 0, true, 8),
  ('Timeframe Inmediato', 'timeframe_bonus', '{"timeframe": "Inmediato"}'::jsonb, 20, true, 5),
  ('Financiamiento Yamaha Especial', 'financing_bonus', '{"financing_type": "Yamaha Especial"}'::jsonb, 30, true, 6),
  ('Financiamiento Bancario', 'financing_bonus', '{"financing_type": ["Corto Plazo Interno", "Caja Colón S/I", "Tarjeta Bancaria S/I"]}'::jsonb, 15, true, 6),
  ('Modelo Premium Bonus', 'model_bonus', '{"models": ["Tracer 9 GT", "Tenere 700", "MT-07"], "price_min": 150000}'::jsonb, 10, true, 4),
  ('Contacto Base', 'base_score', '{"provides_contact": true}'::jsonb, 45, true, 1),
  ('Modelo Específico Declarado', 'model_bonus', '{"has_model_interest": true}'::jsonb, 10, true, 2),
  ('Información de Contacto Completa', 'base_score', '{"has_phone": true, "has_name": true}'::jsonb, 15, true, 3);

INSERT INTO financial_promotions (name, description, promotion_type, conditions, benefits, active, start_date, end_date, applicable_models) VALUES
  ('Yamaha Especial 12 MSI', 'Promoción exclusiva: 50% de enganche y 12 meses sin intereses en modelos premium', 'msi', '{"min_price": 150000, "min_downpayment_percent": 50, "financing_type": "Yamaha Especial", "timeframe": "Inmediato"}'::jsonb, '{"months": 12, "interest_rate": 0, "downpayment_percent": 50}'::jsonb, true, '2025-01-01', '2025-12-31', ARRAY['MT-07', 'Tenere 700', 'Tracer 9 GT', 'YZF-R3']),
  ('Caja Colón Sin Intereses', 'Financiamiento sin intereses a través de Caja Colón', 'msi', '{"financing_type": "Caja Colón S/I"}'::jsonb, '{"months": 12, "interest_rate": 0}'::jsonb, true, '2025-01-01', '2025-12-31', ARRAY['MT-07', 'YZF-R3', 'NMAX', 'Tenere 700', 'Tracer 9 GT']),
  ('Tarjeta Bancaria 12 MSI', 'Meses sin intereses con tarjetas bancarias participantes', 'msi', '{"financing_type": "Tarjeta Bancaria S/I"}'::jsonb, '{"months": 12, "interest_rate": 0}'::jsonb, true, '2025-01-01', '2025-06-30', ARRAY['MT-07', 'YZF-R3', 'NMAX', 'Tenere 700', 'Tracer 9 GT']),
  ('Corto Plazo Interno', 'Financiamiento interno a corto plazo con tasa preferencial', 'special_rate', '{"financing_type": "Corto Plazo Interno"}'::jsonb, '{"interest_rate": 15, "max_months": 24}'::jsonb, true, '2025-01-01', '2025-12-31', ARRAY['MT-07', 'YZF-R3', 'NMAX', 'Tenere 700', 'Tracer 9 GT']);

INSERT INTO system_settings (setting_key, setting_value, category, description, editable_by_role) VALUES
  ('lead_scoring_green_threshold', '{"value": 80}'::jsonb, 'scoring', 'Puntuación mínima para clasificar un lead como Verde', ARRAY['admin', 'manager']),
  ('lead_scoring_yellow_threshold', '{"value": 60}'::jsonb, 'scoring', 'Puntuación mínima para clasificar un lead como Amarillo', ARRAY['admin', 'manager']),
  ('lead_auto_assignment_enabled', '{"value": true}'::jsonb, 'general', 'Activar asignación automática de leads a vendedores', ARRAY['admin', 'manager']),
  ('lead_auto_assignment_strategy', '{"value": "round_robin"}'::jsonb, 'general', 'Estrategia de asignación: round_robin, least_assigned, best_performance', ARRAY['admin', 'manager']),
  ('whatsapp_chatbot_enabled', '{"value": true}'::jsonb, 'marketing', 'Activar chatbot de WhatsApp para captura 24/7', ARRAY['admin', 'marketing']),
  ('birthday_campaign_auto_send', '{"value": true}'::jsonb, 'marketing', 'Enviar automáticamente mensajes de cumpleaños', ARRAY['admin', 'marketing']),
  ('financial_calculator_enabled', '{"value": true}'::jsonb, 'finance', 'Mostrar simulador financiero en el sistema', ARRAY['admin']),
  ('test_drive_booking_enabled', '{"value": true}'::jsonb, 'general', 'Permitir reserva de pruebas de manejo desde el chatbot', ARRAY['admin', 'manager']);

INSERT INTO activity_logs (user_id, action_type, entity_type, entity_id, changes, ip_address) VALUES
  ((SELECT id FROM system_users WHERE email = 'admin@qumamotors.com' LIMIT 1), 'update', 'scoring_rule', (SELECT id FROM scoring_rules WHERE rule_name = 'Timeframe Inmediato' LIMIT 1), '{"field": "score_impact", "old_value": 15, "new_value": 20}'::jsonb, '192.168.1.100'),
  ((SELECT id FROM system_users WHERE email = 'gerente.ventas@qumamotors.com' LIMIT 1), 'create', 'lead', (SELECT id FROM leads LIMIT 1), '{"name": "Carlos Méndez", "status": "Rojo", "score": 35}'::jsonb, '192.168.1.101'),
  ((SELECT id FROM system_users WHERE email = 'marketing@qumamotors.com' LIMIT 1), 'create', 'campaign', (SELECT id FROM automated_campaigns LIMIT 1), '{"name": "Felicitaciones Cumpleaños Automático", "type": "triggered"}'::jsonb, '192.168.1.102');
