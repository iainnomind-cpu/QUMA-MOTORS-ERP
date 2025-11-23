/*
  # Create system_users table for authentication system

  1. New Tables
    - system_users: User management with roles, permissions, and authentication
      - id (uuid, primary key, matches auth.users.id)
      - email (text, unique, required)
      - full_name (text, nullable)
      - role (text, required, default 'vendedor')
      - phone (text, nullable)
      - status (text, default 'active')
      - permissions (jsonb, default empty object)
      - created_by (uuid, nullable, references system_users)
      - created_at (timestamptz, default now)
      - updated_at (timestamptz, default now)

  2. Security
    - Enable RLS on system_users table
    - Add policies for authenticated users to view all users
    - Add policies for authenticated users to manage users
    - Add policy for users to update their own profile

  3. Initial Data
    - Create default admin user (to be linked with auth.users manually)
*/

-- Create system_users table
CREATE TABLE IF NOT EXISTS system_users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'vendedor',
  phone text,
  status text DEFAULT 'active',
  permissions jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES system_users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users
CREATE POLICY "Authenticated users can view all users"
  ON system_users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update any user"
  ON system_users
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert users"
  ON system_users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete users"
  ON system_users
  FOR DELETE
  TO authenticated
  USING (true);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_users_email ON system_users(email);
CREATE INDEX IF NOT EXISTS idx_system_users_role ON system_users(role);
CREATE INDEX IF NOT EXISTS idx_system_users_status ON system_users(status);

-- Insert sample admin user (will need to be linked to auth.users manually)
INSERT INTO system_users (id, email, full_name, role, status, permissions) VALUES
  (gen_random_uuid(), 'admin@qumamotors.com', 'Administrador Principal', 'admin', 'active', '{"all": true}'::jsonb)
ON CONFLICT (email) DO NOTHING;
