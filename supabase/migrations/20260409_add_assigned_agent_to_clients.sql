-- Add assigned_agent_id to clients table so vendedores can only see their own clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_agent_id uuid REFERENCES sales_agents(id);

-- Backfill: for existing clients that were converted from leads, copy the agent from the original lead
UPDATE clients c
SET assigned_agent_id = l.assigned_agent_id
FROM leads l
WHERE c.converted_from_lead_id = l.id
  AND c.assigned_agent_id IS NULL
  AND l.assigned_agent_id IS NOT NULL;
