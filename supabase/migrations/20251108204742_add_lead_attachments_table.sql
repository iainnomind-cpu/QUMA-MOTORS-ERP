/*
  # Agregar tabla de archivos adjuntos para leads

  1. Nueva Tabla
    - `lead_attachments`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, foreign key a leads)
      - `file_name` (text)
      - `file_type` (text) - tipo MIME del archivo
      - `file_size` (bigint) - tamaño en bytes
      - `file_url` (text) - URL del archivo en formato base64 data URL
      - `uploaded_by` (uuid, nullable) - agente que subió el archivo
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on `lead_attachments` table
    - Add policies for public access (demo purposes)
*/

CREATE TABLE IF NOT EXISTS lead_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  file_url text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lead_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for lead_attachments"
  ON lead_attachments
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public all access for lead_attachments"
  ON lead_attachments
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lead_attachments_lead_id ON lead_attachments(lead_id);
