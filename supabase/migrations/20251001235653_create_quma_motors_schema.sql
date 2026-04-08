/*
  # QuMa Motors CRM Database Schema

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
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `clients`
      - `id` (uuid, primary key)
      - `name` (text) - Client name
      - `phone` (text) - Contact phone
      - `email` (text) - Contact email
      - `status` (text) - Client status (Vigente / No Vigente)
      - `last_purchase_date` (timestamptz) - Last purchase date
      - `created_at` (timestamptz)
    
    - `campaigns`
      - `id` (uuid, primary key)
      - `name` (text) - Campaign name
      - `type` (text) - Campaign type (WhatsApp / Email)
      - `target_segment` (text) - Target segment
      - `sent_count` (integer) - Number of messages sent
      - `conversion_rate` (numeric) - Conversion rate percentage
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for public read access (demo purposes)
    
  3. Sample Data
    - Insert 5 catalog models
    - Insert 10 sample leads
    - Insert summary campaign data
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

-- Create leads table
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  status text DEFAULT 'Vigente',
  last_purchase_date timestamptz,
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

-- Enable RLS
ALTER TABLE catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Public read access for campaigns"
  ON campaigns FOR SELECT
  TO anon
  USING (true);

-- Insert catalog data
INSERT INTO catalog (segment, model, price_cash, stock, test_drive_available) VALUES
  ('Naked', 'MT-07', 165000, 3, true),
  ('Sport', 'YZF-R3', 135000, 5, true),
  ('Scooter', 'NMAX', 78000, 8, false),
  ('Adventure', 'Tenere 700', 198000, 2, true),
  ('Sport Touring', 'Tracer 9 GT', 285000, 1, false);

-- Insert sample leads data
INSERT INTO leads (name, phone, email, origin, score, status, model_interested, timeframe, financing_type) VALUES
  ('Carlos Méndez', '5551234567', 'carlos@email.com', 'Chatbot WA', 35, 'Rojo', 'MT-07', 'Futuro', null),
  ('Ana López', '5552345678', 'ana@email.com', 'Planta', 40, 'Rojo', 'NMAX', 'Futuro', null),
  ('Roberto Sánchez', '5553456789', 'roberto@email.com', 'Chatbot WA', 38, 'Rojo', 'YZF-R3', 'Futuro', null),
  ('María García', '5554567890', 'maria@email.com', 'Chatbot WA', 65, 'Amarillo', 'MT-07', 'Inmediato', 'Corto Plazo Interno'),
  ('José Ramírez', '5555678901', 'jose@email.com', 'Planta', 62, 'Amarillo', 'Tenere 700', 'Inmediato', null),
  ('Laura Martínez', '5556789012', 'laura@email.com', 'Chatbot WA', 68, 'Amarillo', 'NMAX', 'Inmediato', 'Tarjeta Bancaria S/I'),
  ('Pedro Hernández', '5557890123', 'pedro@email.com', 'Chatbot WA', 88, 'Verde', 'MT-07', 'Inmediato', 'Yamaha Especial'),
  ('Sofía Torres', '5558901234', 'sofia@email.com', 'Planta', 85, 'Verde', 'Tracer 9 GT', 'Inmediato', 'Yamaha Especial'),
  ('Diego Flores', '5559012345', 'diego@email.com', 'Chatbot WA', 90, 'Verde', 'YZF-R3', 'Inmediato', 'Yamaha Especial'),
  ('Isabel Ruiz', '5550123456', 'isabel@email.com', 'Chatbot WA', 92, 'Verde', 'Tenere 700', 'Inmediato', 'Yamaha Especial');

-- Insert campaign data
INSERT INTO campaigns (name, type, target_segment, sent_count, conversion_rate) VALUES
  ('Campaña Mensual Enero 2025', 'WhatsApp', 'Clientes Vigentes', 6000, 12.5);