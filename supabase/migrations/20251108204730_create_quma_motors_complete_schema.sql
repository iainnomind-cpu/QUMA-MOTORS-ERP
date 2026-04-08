/*
  # QuMa Motors CRM Complete Database Schema

  1. New Tables
    - `catalog`
      - `id` (uuid, primary key)
      - `segment` (text) - Segment type (e.g., Naked, Sport)
      - `model` (text) - Model name
      - `price_cash` (numeric) - Cash price in MXN
      - `stock` (integer) - Current stock quantity
      - `test_drive_available` (boolean) - Available for test drive
      - `created_at` (timestamptz)
    
    - `leads`
      - `id` (uuid, primary key)
      - `name` (text) - Lead name
      - `phone` (text) - Contact phone
      - `email` (text) - Contact email
      - `origin` (text) - Lead source (Chatbot WA / Planta)
      - `score` (integer) - Qualification score (0-100)
      - `status` (text) - Status: Rojo, Amarillo, Verde
      - `model_interested` (text) - Model of interest
      - `timeframe` (text) - Purchase timeframe (Inmediato / Futuro)
      - `financing_type` (text) - Selected financing type
      - `birthday` (date) - Birthday for campaigns
      - `assigned_agent_id` (uuid) - Assigned agent
      - `converted_from_lead_id` (uuid) - Reference if converted from client
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `clients`
      - `id` (uuid, primary key)
      - `name` (text) - Client name
      - `phone` (text) - Contact phone
      - `email` (text) - Contact email
      - `status` (text) - Client status (Vigente / No Vigente)
      - `last_purchase_date` (timestamptz) - Last purchase date
      - `birthday` (date) - Birthday for campaigns
      - `converted_from_lead_id` (uuid) - Reference if converted from lead
      - `created_at` (timestamptz)
    
    - `sales_agents`
      - `id` (uuid, primary key)
      - `name` (text) - Agent name
      - `email` (text) - Agent email
      - `phone` (text) - Agent phone
      - `status` (text) - Agent status (active / inactive)
      - `total_leads_assigned` (integer) - Total leads assigned
      - `total_leads_converted` (integer) - Total leads converted to clients
      - `conversion_rate` (numeric) - Conversion rate percentage
      - `created_at` (timestamptz)
    
    - `lead_interactions`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, foreign key to leads)
      - `interaction_type` (text) - Type: call, email, whatsapp, note
      - `channel` (text) - Channel used
      - `message` (text) - Interaction details
      - `direction` (text) - inbound or outbound
      - `agent_id` (uuid) - Agent who made the interaction
      - `created_at` (timestamptz)
    
    - `lead_assignments`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, foreign key to leads)
      - `agent_id` (uuid, foreign key to sales_agents)
      - `assigned_at` (timestamptz)
      - `status` (text) - Status: active, completed, reassigned
      - `notes` (text) - Assignment notes
    
    - `lead_follow_ups`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, foreign key to leads)
      - `agent_id` (uuid, foreign key to sales_agents)
      - `follow_up_date` (timestamptz) - When to follow up
      - `status` (text) - Status: pending, completed, cancelled
      - `notes` (text) - Follow-up notes
      - `completed_at` (timestamptz)
      - `created_at` (timestamptz)
    
    - `campaigns`
      - `id` (uuid, primary key)
      - `name` (text) - Campaign name
      - `type` (text) - Campaign type (WhatsApp / Email)
      - `target_segment` (text) - Target segment
      - `sent_count` (integer) - Number of messages sent
      - `conversion_rate` (numeric) - Conversion rate percentage
      - `created_at` (timestamptz)

    - `whatsapp_templates`
      - `id` (uuid, primary key)
      - `name` (text) - Template name
      - `category` (text) - Category: promotional, transactional, birthday, follow-up
      - `message_template` (text) - Message with placeholders like {{name}}, {{model}}
      - `active` (boolean) - Whether template is active
      - `created_at` (timestamptz)
    
    - `campaign_audiences`
      - `id` (uuid, primary key)
      - `name` (text) - Segment name
      - `target_type` (text) - Type: leads, clients, mixed
      - `filters` (jsonb) - Segmentation rules in JSON format
      - `created_at` (timestamptz)
    
    - `automated_campaigns`
      - `id` (uuid, primary key)
      - `name` (text) - Campaign name
      - `type` (text) - Type: manual, scheduled, triggered
      - `trigger_type` (text) - Trigger: birthday, inactivity, status_change, custom
      - `template_id` (uuid, foreign key to whatsapp_templates)
      - `audience_id` (uuid, foreign key to campaign_audiences)
      - `schedule_date` (timestamptz) - When to send (null for triggered)
      - `status` (text) - Status: draft, active, paused, completed
      - `total_sent` (integer) - Total messages sent
      - `total_delivered` (integer) - Total messages delivered
      - `total_responses` (integer) - Total responses received
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `campaign_logs`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, foreign key to automated_campaigns)
      - `recipient_type` (text) - Type: lead or client
      - `recipient_id` (uuid) - ID of lead or client
      - `phone` (text) - Recipient phone number
      - `message` (text) - Actual message sent
      - `status` (text) - Status: pending, sent, delivered, failed, responded
      - `sent_at` (timestamptz)
      - `delivered_at` (timestamptz)
      - `responded_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for public access (demo purposes)
*/

-- Create catalog table
CREATE TABLE IF NOT EXISTS catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment text NOT NULL,
  model text NOT NULL,
  price_cash numeric NOT NULL,
  stock integer DEFAULT 0,
  test_drive_available boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create leads table with birthday and agent assignment
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  origin text NOT NULL,
  score integer DEFAULT 0,
  status text DEFAULT 'Rojo',
  model_interested text,
  timeframe text,
  financing_type text,
  birthday date,
  assigned_agent_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create clients table with birthday
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  status text DEFAULT 'Vigente',
  last_purchase_date timestamptz,
  birthday date,
  converted_from_lead_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Create sales_agents table
CREATE TABLE IF NOT EXISTS sales_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  status text DEFAULT 'active',
  total_leads_assigned integer DEFAULT 0,
  total_leads_converted integer DEFAULT 0,
  conversion_rate numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create lead_interactions table
CREATE TABLE IF NOT EXISTS lead_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  interaction_type text NOT NULL,
  channel text NOT NULL,
  message text NOT NULL,
  direction text DEFAULT 'outbound',
  agent_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Create lead_assignments table
CREATE TABLE IF NOT EXISTS lead_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES sales_agents(id) ON DELETE CASCADE NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  status text DEFAULT 'active',
  notes text
);

-- Create lead_follow_ups table
CREATE TABLE IF NOT EXISTS lead_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES sales_agents(id) ON DELETE CASCADE NOT NULL,
  follow_up_date timestamptz NOT NULL,
  status text DEFAULT 'pending',
  notes text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  target_segment text NOT NULL,
  sent_count integer DEFAULT 0,
  conversion_rate numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create whatsapp_templates table
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  message_template text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create campaign_audiences table
CREATE TABLE IF NOT EXISTS campaign_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_type text NOT NULL,
  filters jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create automated_campaigns table
CREATE TABLE IF NOT EXISTS automated_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  trigger_type text,
  template_id uuid REFERENCES whatsapp_templates(id),
  audience_id uuid REFERENCES campaign_audiences(id),
  schedule_date timestamptz,
  status text DEFAULT 'draft',
  total_sent integer DEFAULT 0,
  total_delivered integer DEFAULT 0,
  total_responses integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create campaign_logs table
CREATE TABLE IF NOT EXISTS campaign_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES automated_campaigns(id),
  recipient_type text NOT NULL,
  recipient_id uuid NOT NULL,
  phone text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'pending',
  sent_at timestamptz,
  delivered_at timestamptz,
  responded_at timestamptz
);

-- Enable RLS
ALTER TABLE catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (demo purposes)
CREATE POLICY "Public read access for catalog"
  ON catalog FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public all access for catalog"
  ON catalog FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read access for leads"
  ON leads FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public all access for leads"
  ON leads FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read access for clients"
  ON clients FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public all access for clients"
  ON clients FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read access for sales_agents"
  ON sales_agents FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public all access for sales_agents"
  ON sales_agents FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read access for lead_interactions"
  ON lead_interactions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public all access for lead_interactions"
  ON lead_interactions FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read access for lead_assignments"
  ON lead_assignments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public all access for lead_assignments"
  ON lead_assignments FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read access for lead_follow_ups"
  ON lead_follow_ups FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public all access for lead_follow_ups"
  ON lead_follow_ups FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read access for campaigns"
  ON campaigns FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public all access for campaigns"
  ON campaigns FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read access for whatsapp_templates"
  ON whatsapp_templates FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public all access for whatsapp_templates"
  ON whatsapp_templates FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read access for campaign_audiences"
  ON campaign_audiences FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public all access for campaign_audiences"
  ON campaign_audiences FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read access for automated_campaigns"
  ON automated_campaigns FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public all access for automated_campaigns"
  ON automated_campaigns FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public read access for campaign_logs"
  ON campaign_logs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public all access for campaign_logs"
  ON campaign_logs FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Insert catalog data
INSERT INTO catalog (segment, model, price_cash, stock, test_drive_available) VALUES
  ('Naked', 'MT-07', 165000, 3, true),
  ('Sport', 'YZF-R3', 135000, 5, true),
  ('Scooter', 'NMAX', 78000, 8, false),
  ('Adventure', 'Tenere 700', 198000, 2, true),
  ('Sport Touring', 'Tracer 9 GT', 285000, 1, false);

-- Insert sample sales agents
INSERT INTO sales_agents (name, email, phone, status, total_leads_assigned, total_leads_converted, conversion_rate) VALUES
  ('Juan Pérez', 'juan.perez@qumamotors.com', '5551111111', 'active', 45, 12, 26.7),
  ('María González', 'maria.gonzalez@qumamotors.com', '5552222222', 'active', 38, 15, 39.5),
  ('Roberto López', 'roberto.lopez@qumamotors.com', '5553333333', 'active', 52, 18, 34.6),
  ('Ana Martínez', 'ana.martinez@qumamotors.com', '5554444444', 'active', 41, 14, 34.1);

-- Insert sample leads data with birthdays
INSERT INTO leads (name, phone, email, origin, score, status, model_interested, timeframe, financing_type, birthday, assigned_agent_id) VALUES
  ('Carlos Méndez', '5551234567', 'carlos@email.com', 'Chatbot WA', 35, 'Rojo', 'MT-07', 'Futuro', null, '1990-03-15', (SELECT id FROM sales_agents LIMIT 1 OFFSET 0)),
  ('Ana López', '5552345678', 'ana@email.com', 'Planta', 40, 'Rojo', 'NMAX', 'Futuro', null, '1988-07-22', (SELECT id FROM sales_agents LIMIT 1 OFFSET 1)),
  ('Roberto Sánchez', '5553456789', 'roberto@email.com', 'Chatbot WA', 38, 'Rojo', 'YZF-R3', 'Futuro', null, '1993-12-05', null),
  ('María García', '5554567890', 'maria@email.com', 'Chatbot WA', 65, 'Amarillo', 'MT-07', 'Inmediato', 'Corto Plazo Interno', '1995-11-08', (SELECT id FROM sales_agents LIMIT 1 OFFSET 2)),
  ('José Ramírez', '5555678901', 'jose@email.com', 'Planta', 62, 'Amarillo', 'Tenere 700', 'Inmediato', null, '1991-05-18', (SELECT id FROM sales_agents LIMIT 1 OFFSET 1)),
  ('Laura Martínez', '5556789012', 'laura@email.com', 'Chatbot WA', 68, 'Amarillo', 'NMAX', 'Inmediato', 'Tarjeta Bancaria S/I', '1989-08-25', null),
  ('Pedro Hernández', '5557890123', 'pedro@email.com', 'Chatbot WA', 88, 'Verde', 'MT-07', 'Inmediato', 'Yamaha Especial', '1992-02-14', (SELECT id FROM sales_agents LIMIT 1 OFFSET 0)),
  ('Sofía Torres', '5558901234', 'sofia@email.com', 'Planta', 85, 'Verde', 'Tracer 9 GT', 'Inmediato', 'Yamaha Especial', '1987-09-30', (SELECT id FROM sales_agents LIMIT 1 OFFSET 3)),
  ('Diego Flores', '5559012345', 'diego@email.com', 'Chatbot WA', 90, 'Verde', 'YZF-R3', 'Inmediato', 'Yamaha Especial', '1994-06-12', (SELECT id FROM sales_agents LIMIT 1 OFFSET 2)),
  ('Isabel Ruiz', '5550123456', 'isabel@email.com', 'Chatbot WA', 92, 'Verde', 'Tenere 700', 'Inmediato', 'Yamaha Especial', '1986-04-28', (SELECT id FROM sales_agents LIMIT 1 OFFSET 1));

-- Insert sample clients
INSERT INTO clients (name, phone, email, status, last_purchase_date, birthday) VALUES
  ('Fernando Jiménez', '5551111222', 'fernando@email.com', 'Vigente', '2024-06-15', '1985-03-10'),
  ('Patricia Morales', '5552222333', 'patricia@email.com', 'Vigente', '2024-08-22', '1992-07-18'),
  ('Ricardo Vázquez', '5553333444', 'ricardo@email.com', 'Vigente', '2024-09-30', '1988-11-25'),
  ('Carmen Delgado', '5554444555', 'carmen@email.com', 'No Vigente', '2022-04-12', '1990-05-08'),
  ('Miguel Castro', '5555555666', 'miguel@email.com', 'No Vigente', '2021-11-20', '1987-09-14');

-- Insert campaign data
INSERT INTO campaigns (name, type, target_segment, sent_count, conversion_rate) VALUES
  ('Campaña Mensual Enero 2025', 'WhatsApp', 'Clientes Vigentes', 6000, 12.5);

-- Insert sample WhatsApp templates
INSERT INTO whatsapp_templates (name, category, message_template, active) VALUES
  (
    'Bienvenida Nuevo Cliente',
    'transactional',
    'Hola {{name}}! Bienvenido a la familia QUMA Motors. Gracias por confiar en nosotros para tu nueva {{model}}. Estamos para servirte!',
    true
  ),
  (
    'Felicitación Cumpleaños',
    'birthday',
    'Feliz Cumpleaños {{name}}! En QUMA Motors queremos celebrar contigo. Tenemos una sorpresa especial. Visítanos!',
    true
  ),
  (
    'Promoción Mensual',
    'promotional',
    'Hola {{name}}! Este mes tenemos increíbles promociones en toda nuestra línea Yamaha. Financiamiento especial desde 12 meses. No te lo pierdas!',
    true
  ),
  (
    'Seguimiento Lead Caliente',
    'follow-up',
    'Hola {{name}}! Vi que estás interesado en la {{model}}. Te gustaría agendar una prueba de manejo? Tengo disponibilidad esta semana.',
    true
  ),
  (
    'Reactivación Cliente Inactivo',
    'promotional',
    'Hola {{name}}! Hace tiempo que no sabemos de ti. Tenemos nuevos modelos y promociones exclusivas para clientes como tú. Cuándo nos visitas?',
    true
  ),
  (
    'Recordatorio Servicio',
    'transactional',
    'Hola {{name}}! Tu {{model}} está próxima a su servicio de mantenimiento. Agenda tu cita y mantén tu moto en perfecto estado',
    true
  );

-- Insert sample audience segments
INSERT INTO campaign_audiences (name, target_type, filters) VALUES
  (
    'Clientes Vigentes',
    'clients',
    '{"status": "Vigente"}'::jsonb
  ),
  (
    'Clientes Inactivos (Reactivación)',
    'clients',
    '{"status": "No Vigente"}'::jsonb
  ),
  (
    'Leads Calientes (Verde)',
    'leads',
    '{"status": "Verde"}'::jsonb
  ),
  (
    'Leads Tibios (Amarillo)',
    'leads',
    '{"status": "Amarillo"}'::jsonb
  ),
  (
    'Leads Fríos (Rojo)',
    'leads',
    '{"status": "Rojo"}'::jsonb
  ),
  (
    'Leads Interesados en MT-07',
    'leads',
    '{"model_interested": "MT-07"}'::jsonb
  ),
  (
    'Leads Compra Inmediata',
    'leads',
    '{"timeframe": "Inmediato", "score_min": 60}'::jsonb
  ),
  (
    'Cumpleañeros del Mes',
    'mixed',
    '{"birthday_month": "current"}'::jsonb
  );

-- Insert sample automated campaigns
INSERT INTO automated_campaigns (name, type, trigger_type, template_id, audience_id, status, total_sent, total_delivered, total_responses) VALUES
  (
    'Campaña Promocional Febrero 2025',
    'scheduled',
    null,
    (SELECT id FROM whatsapp_templates WHERE name = 'Promoción Mensual' LIMIT 1),
    (SELECT id FROM campaign_audiences WHERE name = 'Clientes Vigentes' LIMIT 1),
    'completed',
    6000,
    5850,
    750
  ),
  (
    'Felicitaciones Cumpleaños Automático',
    'triggered',
    'birthday',
    (SELECT id FROM whatsapp_templates WHERE name = 'Felicitación Cumpleaños' LIMIT 1),
    (SELECT id FROM campaign_audiences WHERE name = 'Cumpleañeros del Mes' LIMIT 1),
    'active',
    45,
    44,
    12
  ),
  (
    'Seguimiento Leads Calientes',
    'scheduled',
    null,
    (SELECT id FROM whatsapp_templates WHERE name = 'Seguimiento Lead Caliente' LIMIT 1),
    (SELECT id FROM campaign_audiences WHERE name = 'Leads Calientes (Verde)' LIMIT 1),
    'active',
    0,
    0,
    0
  ),
  (
    'Reactivación Clientes Inactivos',
    'scheduled',
    null,
    (SELECT id FROM whatsapp_templates WHERE name = 'Reactivación Cliente Inactivo' LIMIT 1),
    (SELECT id FROM campaign_audiences WHERE name = 'Clientes Inactivos (Reactivación)' LIMIT 1),
    'draft',
    0,
    0,
    0
  );
