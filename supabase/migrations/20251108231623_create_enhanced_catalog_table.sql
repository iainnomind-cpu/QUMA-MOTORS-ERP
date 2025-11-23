/*
  # Enhanced Catalog System - QuMa Motors

  1. New Tables
    - `catalog`
      - `id` (uuid, primary key)
      - `segment` (text) - Clasificación del modelo (Deportiva, Naked, Doble Propósito, Scooter)
      - `model` (text, unique) - Nombre del modelo (ej: MT-07, YZF-R3)
      - `price_cash` (numeric) - Precio de contado en MXN
      - `stock` (integer) - Unidades disponibles en inventario
      - `test_drive_available` (boolean) - Disponibilidad para prueba de manejo
      - `year` (integer) - Año del modelo
      - `color_options` (text[]) - Colores disponibles
      - `engine_cc` (integer) - Cilindraje del motor en cc
      - `engine_type` (text) - Tipo de motor (ej: "Bicilíndrico en línea")
      - `max_power` (text) - Potencia máxima (ej: "73.4 HP @ 9,000 rpm")
      - `max_torque` (text) - Torque máximo (ej: "68 Nm @ 6,500 rpm")
      - `transmission` (text) - Tipo de transmisión (ej: "6 velocidades")
      - `fuel_capacity` (numeric) - Capacidad del tanque en litros
      - `weight` (integer) - Peso en kg
      - `seat_height` (integer) - Altura del asiento en mm
      - `abs` (boolean) - Sistema ABS incluido
      - `traction_control` (boolean) - Control de tracción incluido
      - `riding_modes` (text[]) - Modos de manejo disponibles
      - `description` (text) - Descripción comercial del modelo
      - `key_features` (text[]) - Características destacadas
      - `image_url` (text) - URL de la imagen principal
      - `brochure_url` (text) - URL del PDF de ficha técnica
      - `active` (boolean) - Modelo activo en catálogo
      - `created_at` (timestamptz) - Fecha de creación
      - `updated_at` (timestamptz) - Fecha de última actualización

  2. Security
    - Enable RLS on `catalog` table
    - Add policy for public read access (catalog is public information)
    - Add policy for authenticated users to manage catalog (admin only in production)

  3. Indexes
    - Index on `segment` for fast filtering by category
    - Index on `model` for unique lookups
    - Index on `active` for filtering active models

  4. Notes
    - This table centralizes all motorcycle information previously in PDFs or web pages
    - Enables Chatbot to extract specific data (price, features, availability)
    - Test drive availability controls chatbot flow to avoid promising unavailable services
    - Structured data allows for easy filtering and comparison
*/

CREATE TABLE IF NOT EXISTS catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment text NOT NULL CHECK (segment IN ('Deportiva', 'Naked', 'Doble Propósito', 'Scooter', 'Touring', 'Adventure')),
  model text UNIQUE NOT NULL,
  price_cash numeric NOT NULL CHECK (price_cash > 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  test_drive_available boolean NOT NULL DEFAULT false,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  color_options text[] DEFAULT ARRAY[]::text[],
  engine_cc integer CHECK (engine_cc > 0),
  engine_type text,
  max_power text,
  max_torque text,
  transmission text,
  fuel_capacity numeric CHECK (fuel_capacity > 0),
  weight integer CHECK (weight > 0),
  seat_height integer CHECK (seat_height > 0),
  abs boolean DEFAULT false,
  traction_control boolean DEFAULT false,
  riding_modes text[] DEFAULT ARRAY[]::text[],
  description text,
  key_features text[] DEFAULT ARRAY[]::text[],
  image_url text,
  brochure_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalog is publicly readable"
  ON catalog
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert catalog items"
  ON catalog
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update catalog items"
  ON catalog
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete catalog items"
  ON catalog
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_catalog_segment ON catalog(segment);
CREATE INDEX IF NOT EXISTS idx_catalog_model ON catalog(model);
CREATE INDEX IF NOT EXISTS idx_catalog_active ON catalog(active);

INSERT INTO catalog (segment, model, price_cash, stock, test_drive_available, year, color_options, engine_cc, engine_type, max_power, max_torque, transmission, fuel_capacity, weight, seat_height, abs, traction_control, description, key_features) VALUES
('Naked', 'MT-07', 159900, 5, true, 2024, ARRAY['Azul', 'Negro', 'Gris'], 689, 'Bicilíndrico en línea', '73.4 HP @ 9,000 rpm', '68 Nm @ 6,500 rpm', '6 velocidades', 14, 184, 805, true, false, 'La MT-07 combina rendimiento emocionante con versatilidad diaria. Su motor de 689cc ofrece una respuesta instantánea del acelerador.', ARRAY['Motor bicilíndrico CP2', 'Chasis ligero de acero', 'Suspensión deportiva', 'Instrumentación LCD']),
('Deportiva', 'YZF-R3', 134900, 3, true, 2024, ARRAY['Azul Racing', 'Negro'], 321, 'Bicilíndrico en línea', '42 HP @ 10,750 rpm', '29.6 Nm @ 9,000 rpm', '6 velocidades', 14, 169, 780, true, false, 'La YZF-R3 es la puerta de entrada perfecta al mundo deportivo de Yamaha. Diseño inspirado en MotoGP.', ARRAY['Carenado completo estilo R1', 'Motor de alta revolución', 'Sistema ABS', 'Chasis Deltabox']),
('Scooter', 'NMAX', 78900, 8, true, 2024, ARRAY['Gris', 'Blanco', 'Azul'], 155, 'Monocilíndrico', '15.4 HP @ 8,000 rpm', '14.4 Nm @ 6,000 rpm', 'Automática CVT', 7.1, 127, 765, true, false, 'El NMAX Connected redefine la movilidad urbana con tecnología de conectividad y eficiencia excepcional.', ARRAY['Sistema Y-Connect', 'Freno ABS', 'Start/Stop System', 'Amplio espacio de almacenamiento']),
('Adventure', 'Tenere 700', 219900, 2, true, 2024, ARRAY['Blanco Rally', 'Azul'], 689, 'Bicilíndrico en línea CP2', '72 HP @ 9,000 rpm', '68 Nm @ 6,500 rpm', '6 velocidades', 16, 204, 875, true, true, 'La Tenere 700 World Rally es la aventurera definitiva, inspirada en las motos ganadoras del Dakar.', ARRAY['Motor CP2 torque', 'Suspensión de largo recorrido', 'Control de tracción', 'Modos de manejo', 'Protección completa']),
('Touring', 'Tracer 9 GT', 289900, 1, false, 2024, ARRAY['Gris Tech', 'Azul'], 890, 'Tricilíndrico en línea CP3', '119 HP @ 10,000 rpm', '93 Nm @ 7,000 rpm', '6 velocidades', 18, 220, 810, true, true, 'La Tracer 9 GT es la sport-touring definitiva con tecnología de punta y confort para largos viajes.', ARRAY['Motor CP3 de 3 cilindros', 'Suspensión electrónica', 'Control crucero adaptativo', 'Quickshifter', 'Maletas integradas', 'Pantalla TFT 7"']);
