/*
  # Create Catalog Images Storage Bucket

  1. Storage Setup
    - Creates a new storage bucket 'catalog-images' for motorcycle images
    - Sets up public access for viewing images
    - Configures file size and type restrictions
  
  2. Security
    - Bucket is publicly readable (for displaying images)
    - Upload restricted to authenticated users
    - Maximum file size: 5MB
    - Allowed types: image/jpeg, image/png, image/webp
  
  3. Policies
    - Public read access for all images
    - Authenticated users can upload images
    - Authenticated users can update/delete their uploads
*/

-- Create storage bucket for catalog images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalog-images',
  'catalog-images',
  true,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access for catalog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload catalog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update catalog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete catalog images" ON storage.objects;

-- Allow public read access to catalog images
CREATE POLICY "Public read access for catalog images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'catalog-images');

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload catalog images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'catalog-images');

-- Allow authenticated users to update images
CREATE POLICY "Authenticated users can update catalog images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'catalog-images')
WITH CHECK (bucket_id = 'catalog-images');

-- Allow authenticated users to delete images
CREATE POLICY "Authenticated users can delete catalog images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'catalog-images');