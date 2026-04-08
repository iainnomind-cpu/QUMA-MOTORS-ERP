
-- Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.system_settings;
CREATE POLICY "Enable read access for authenticated users" ON public.system_settings
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update access for admins" ON public.system_settings;
CREATE POLICY "Enable update access for admins" ON public.system_settings
    FOR UPDATE USING (
        auth.jwt() ->> 'role' = 'admin' OR 
        exists (
            select 1 from public.system_users 
            where id = auth.uid() and role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Enable insert access for admins" ON public.system_settings;
CREATE POLICY "Enable insert access for admins" ON public.system_settings
    FOR INSERT WITH CHECK (
        auth.jwt() ->> 'role' = 'admin' OR 
        exists (
            select 1 from public.system_users 
            where id = auth.uid() and role = 'admin'
        )
    );

-- Seed Data (Upsert)
INSERT INTO public.system_settings (category, setting_key, setting_value, description, is_public)
VALUES
    -- General
    ('general', 'company_name', '{"value": "QuMa Motors", "type": "string", "label": "Nombre de la Empresa"}', 'Nombre comercial de la empresa', true),
    ('general', 'currency', '{"value": "MXN", "type": "string", "label": "Moneda Base"}', 'Moneda principal para operaciones', true),
    ('general', 'timezone', '{"value": "America/Mexico_City", "type": "string", "label": "Zona Horaria"}', 'Zona horaria del sistema', true),

    -- Finance
    ('finance', 'tax_rate', '{"value": 16, "type": "number", "label": "Tasa de IVA (%)"}', 'Porcentaje de Impuesto al Valor Agregado', true),
    ('finance', 'min_down_payment', '{"value": 10, "type": "number", "label": "Enganche Mínimo (%)"}', 'Porcentaje mínimo de enganche requerido', false),
    ('finance', 'financing_terms', '{"value": [12, 24, 36, 48], "type": "list", "label": "Plazos de Financiamiento"}', 'Meses disponibles para créditos', false),
    ('finance', 'annual_interest_rate', '{"value": 40, "type": "number", "label": "Tasa Anual (%)"}', 'Tasa de interés anual base', false),

    -- CRM
    ('crm', 'dead_lead_days', '{"value": 3, "type": "number", "label": "Días Lead Estancado"}', 'Días sin actividad para marcar lead como estancado', false),
    ('crm', 'auto_assign_leads', '{"value": true, "type": "boolean", "label": "Auto-asignación de Leads"}', 'Asignar leads automáticamente a vendedores', false),
    ('crm', 'base_close_prob', '{"value": 20, "type": "number", "label": "Probabilidad Base (%)"}', 'Probabilidad inicial de cierre para nuevos leads', false),

    -- Inventory
    ('inventory', 'allow_negative_stock', '{"value": false, "type": "boolean", "label": "Permitir Stock Negativo"}', 'Permitir ventas sin stock físico', false),
    ('inventory', 'low_stock_threshold', '{"value": 2, "type": "number", "label": "Alerta Stock Bajo"}', 'Cantidad mínima para alerta de reorden', false),
    ('inventory', 'reservation_days', '{"value": 5, "type": "number", "label": "Días de Reserva"}', 'Días máximos para mantener una unidad apartada', false),

    -- Notifications
    ('notifications', 'whatsapp_enabled', '{"value": true, "type": "boolean", "label": "WhatsApp Activo"}', 'Habilitar envío de mensajes por WhatsApp', false),
    ('notifications', 'daily_msg_limit', '{"value": 1000, "type": "number", "label": "Límite Diario Mensajes"}', 'Límite de seguridad para evitar spam', false),
    ('notifications', 'test_phone', '{"value": "", "type": "string", "label": "Teléfono de Prueba"}', 'Número para recibir notificaciones de prueba', false)

ON CONFLICT (setting_key) DO UPDATE
SET 
    setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    updated_at = NOW();
