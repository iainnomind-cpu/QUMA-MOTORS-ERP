-- =====================================================
-- MIGRACIÓN: Sincronizar vendedores existentes de
-- user_profiles a sales_agents para el round robin
-- =====================================================

INSERT INTO sales_agents (id, name, email, phone, branch_id, status, total_leads_assigned, total_leads_converted, conversion_rate)
SELECT
  up.id,
  up.full_name,
  up.email,
  up.phone,
  up.branch_id,
  'active',
  0,
  0,
  0
FROM user_profiles up
WHERE up.role = 'vendedor'
  AND up.active = true
  AND NOT EXISTS (
    SELECT 1 FROM sales_agents sa WHERE sa.id = up.id
  );

-- También actualizar branch_id en sales_agents existentes que no lo tengan
UPDATE sales_agents sa
SET branch_id = up.branch_id
FROM user_profiles up
WHERE sa.id = up.id
  AND up.role = 'vendedor'
  AND sa.branch_id IS NULL
  AND up.branch_id IS NOT NULL;
