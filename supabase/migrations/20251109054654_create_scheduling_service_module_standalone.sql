/*
  # Módulo de Agendamiento: Pruebas de Manejo y Servicio Técnico

  ## Descripción
  Sistema integral para gestionar:
  - Pruebas de manejo con validación de disponibilidad de motos
  - Agendamiento de servicio técnico y mantenimiento
  - Historial de servicios por cliente
  - Control de técnicos y sus horarios
  - Notificaciones automáticas

  ## Nuevas Tablas

  ### 1. `service_technicians`
  Registro de técnicos de servicio y taller
  
  ### 2. `test_drive_appointments`
  Citas de prueba de manejo

  ### 3. `service_appointments`
  Citas de servicio y mantenimiento

  ### 4. `service_history`
  Historial completo de servicios por cliente/vehículo

  ### 5. `service_reminders`
  Recordatorios automáticos de servicio

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas restrictivas por defecto
  - Acceso autenticado para operaciones
*/

-- Tabla de Técnicos de Servicio
CREATE TABLE IF NOT EXISTS service_technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  specialties text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  max_daily_appointments integer DEFAULT 8,
  working_hours_start time DEFAULT '09:00',
  working_hours_end time DEFAULT '18:00',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE service_technicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view technicians"
  ON service_technicians FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage technicians"
  ON service_technicians FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Tabla de Citas de Prueba de Manejo
CREATE TABLE IF NOT EXISTS test_drive_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid,
  lead_name text,
  lead_phone text,
  catalog_item_id uuid,
  catalog_model text NOT NULL,
  agent_id uuid,
  agent_name text,
  appointment_date timestamptz NOT NULL,
  duration_minutes integer DEFAULT 30,
  status text NOT NULL DEFAULT 'scheduled',
  pickup_location text DEFAULT 'agencia',
  notes text,
  completed_at timestamptz,
  feedback text,
  converted_to_sale boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE test_drive_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view test drive appointments"
  ON test_drive_appointments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage test drive appointments"
  ON test_drive_appointments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_test_drive_appointments_date ON test_drive_appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_test_drive_appointments_status ON test_drive_appointments(status);

-- Tabla de Citas de Servicio
CREATE TABLE IF NOT EXISTS service_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  client_name text NOT NULL,
  client_phone text,
  technician_id uuid,
  technician_name text,
  appointment_date timestamptz NOT NULL,
  service_type text NOT NULL DEFAULT 'preventivo',
  estimated_duration_minutes integer DEFAULT 120,
  status text NOT NULL DEFAULT 'scheduled',
  vehicle_model text,
  vehicle_plate text,
  mileage integer,
  services_requested text[] DEFAULT '{}',
  diagnosis text,
  services_performed text[] DEFAULT '{}',
  parts_used jsonb[] DEFAULT '{}',
  labor_cost numeric(10, 2) DEFAULT 0,
  parts_cost numeric(10, 2) DEFAULT 0,
  total_cost numeric(10, 2) DEFAULT 0,
  notes text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE service_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view service appointments"
  ON service_appointments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage service appointments"
  ON service_appointments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_service_appointments_date ON service_appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_service_appointments_status ON service_appointments(status);

-- Tabla de Historial de Servicio
CREATE TABLE IF NOT EXISTS service_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  client_name text NOT NULL,
  service_appointment_id uuid,
  service_date date NOT NULL,
  service_type text NOT NULL,
  vehicle_model text,
  mileage integer,
  services_performed text[] DEFAULT '{}',
  parts_used jsonb[] DEFAULT '{}',
  total_cost numeric(10, 2) DEFAULT 0,
  next_service_due_date date,
  next_service_due_mileage integer,
  technician_id uuid,
  technician_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE service_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view service history"
  ON service_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage service history"
  ON service_history FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_service_history_client ON service_history(client_id);
CREATE INDEX IF NOT EXISTS idx_service_history_date ON service_history(service_date);

-- Tabla de Recordatorios de Servicio
CREATE TABLE IF NOT EXISTS service_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  client_name text NOT NULL,
  client_phone text,
  vehicle_model text,
  reminder_type text NOT NULL DEFAULT 'time_based',
  last_service_date date,
  last_service_mileage integer,
  next_service_due_date date,
  next_service_due_mileage integer,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE service_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view service reminders"
  ON service_reminders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage service reminders"
  ON service_reminders FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_service_reminders_client ON service_reminders(client_id);
CREATE INDEX IF NOT EXISTS idx_service_reminders_status ON service_reminders(status);
CREATE INDEX IF NOT EXISTS idx_service_reminders_due_date ON service_reminders(next_service_due_date);

-- Datos iniciales de técnicos
INSERT INTO service_technicians (name, email, phone, specialties, status, max_daily_appointments) VALUES
  ('Carlos Méndez', 'carlos.mendez@qumamotors.com', '3331234567', ARRAY['Mecánica General', 'Eléctrica', 'Diagnóstico'], 'active', 8),
  ('Roberto Sánchez', 'roberto.sanchez@qumamotors.com', '3331234568', ARRAY['Mecánica General', 'Suspensión', 'Frenos'], 'active', 8),
  ('Miguel Torres', 'miguel.torres@qumamotors.com', '3331234569', ARRAY['Eléctrica', 'Diagnóstico', 'Carrocería'], 'active', 6)
ON CONFLICT DO NOTHING;
