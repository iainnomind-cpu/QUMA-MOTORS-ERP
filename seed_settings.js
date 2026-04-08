
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const settings = [
    // General
    { category: 'general', key: 'company_name', value: { value: 'QuMa Motors', type: 'string', label: 'Nombre de la Empresa' }, description: 'Nombre comercial de la empresa', is_public: true },
    { category: 'general', key: 'currency', value: { value: 'MXN', type: 'string', label: 'Moneda Base' }, description: 'Moneda principal para operaciones', is_public: true },
    { category: 'general', key: 'timezone', value: { value: 'America/Mexico_City', type: 'string', label: 'Zona Horaria' }, description: 'Zona horaria del sistema', is_public: true },

    // Finance
    { category: 'finance', key: 'tax_rate', value: { value: 16, type: 'number', label: 'Tasa de IVA (%)' }, description: 'Porcentaje de Impuesto al Valor Agregado', is_public: true },
    { category: 'finance', key: 'min_down_payment', value: { value: 10, type: 'number', label: 'Enganche Mínimo (%)' }, description: 'Porcentaje mínimo de enganche requerido', is_public: false },
    { category: 'finance', key: 'financing_terms', value: { value: [12, 24, 36, 48], type: 'list', label: 'Plazos de Financiamiento' }, description: 'Meses disponibles para créditos', is_public: false },
    { category: 'finance', key: 'annual_interest_rate', value: { value: 40, type: 'number', label: 'Tasa Anual (%)' }, description: 'Tasa de interés anual base', is_public: false },

    // CRM
    { category: 'crm', key: 'dead_lead_days', value: { value: 3, type: 'number', label: 'Días Lead Estancado' }, description: 'Días sin actividad para marcar lead como estancado', is_public: false },
    { category: 'crm', key: 'auto_assign_leads', value: { value: true, type: 'boolean', label: 'Auto-asignación de Leads' }, description: 'Asignar leads automáticamente a vendedores', is_public: false },
    { category: 'crm', key: 'base_close_prob', value: { value: 20, type: 'number', label: 'Probabilidad Base (%)' }, description: 'Probabilidad inicial de cierre para nuevos leads', is_public: false },

    // Inventory
    { category: 'inventory', key: 'allow_negative_stock', value: { value: false, type: 'boolean', label: 'Permitir Stock Negativo' }, description: 'Permitir ventas sin stock físico', is_public: false },
    { category: 'inventory', key: 'low_stock_threshold', value: { value: 2, type: 'number', label: 'Alerta Stock Bajo' }, description: 'Cantidad mínima para alerta de reorden', is_public: false },
    { category: 'inventory', key: 'reservation_days', value: { value: 5, type: 'number', label: 'Días de Reserva' }, description: 'Días máximos para mantener una unidad apartada', is_public: false },

    // Notifications
    { category: 'notifications', key: 'whatsapp_enabled', value: { value: true, type: 'boolean', label: 'WhatsApp Activo' }, description: 'Habilitar envío de mensajes por WhatsApp', is_public: false },
    { category: 'notifications', key: 'daily_msg_limit', value: { value: 1000, type: 'number', label: 'Límite Diario Mensajes' }, description: 'Límite de seguridad para evitar spam', is_public: false },
    { category: 'notifications', key: 'test_phone', value: { value: '', type: 'string', label: 'Teléfono de Prueba' }, description: 'Número para recibir notificaciones de prueba', is_public: false }
];

async function seedSettings() {
    console.log('Seeding system_settings...');

    for (const setting of settings) {
        const { error } = await supabase.from('system_settings').upsert({
            category: setting.category,
            setting_key: setting.key,
            setting_value: setting.value,
            description: setting.description,
            is_public: setting.is_public,
            updated_at: new Date()
        }, { onConflict: 'setting_key' });

        if (error) {
            console.error(`Error upserting ${setting.key}:`, error);
        } else {
            console.log(`✅ Seeded ${setting.key}`);
        }
    }
}

seedSettings();
