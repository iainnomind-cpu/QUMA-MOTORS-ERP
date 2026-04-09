-- Fix RLS policies for scheduling tables
-- The original policies only allowed 'authenticated' role, but the app uses 'anon' key
-- Add anon policies to match the pattern used by leads/clients tables

-- service_technicians
CREATE POLICY IF NOT EXISTS "Public read access for service_technicians"
  ON service_technicians FOR SELECT
  TO anon
  USING (true);

CREATE POLICY IF NOT EXISTS "Public all access for service_technicians"
  ON service_technicians FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- test_drive_appointments
CREATE POLICY IF NOT EXISTS "Public read access for test_drive_appointments"
  ON test_drive_appointments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY IF NOT EXISTS "Public all access for test_drive_appointments"
  ON test_drive_appointments FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- service_appointments
CREATE POLICY IF NOT EXISTS "Public read access for service_appointments"
  ON service_appointments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY IF NOT EXISTS "Public all access for service_appointments"
  ON service_appointments FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- service_history
CREATE POLICY IF NOT EXISTS "Public read access for service_history"
  ON service_history FOR SELECT
  TO anon
  USING (true);

CREATE POLICY IF NOT EXISTS "Public all access for service_history"
  ON service_history FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- service_reminders
CREATE POLICY IF NOT EXISTS "Public read access for service_reminders"
  ON service_reminders FOR SELECT
  TO anon
  USING (true);

CREATE POLICY IF NOT EXISTS "Public all access for service_reminders"
  ON service_reminders FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
