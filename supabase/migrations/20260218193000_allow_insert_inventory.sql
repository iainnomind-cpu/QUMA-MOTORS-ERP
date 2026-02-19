-- Add INSERT policy for Managers ONLY (and Admins) on parts_inventory
-- Sales Agents cannot insert (must sell existing inventory)

CREATE POLICY "Gerentes insertan en su inventario"
  ON parts_inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM user_profiles up
      WHERE up.email = auth.email() 
      AND (
        -- Managers can insert for their assigned branch
        (up.role = 'gerente' AND up.branch_id = branch_id)
        OR 
        -- Admins can insert anywhere
        up.role = 'admin'
      )
    )
  );
