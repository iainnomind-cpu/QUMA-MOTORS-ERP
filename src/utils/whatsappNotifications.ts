
/**
 * Utility functions for sending WhatsApp notifications using 
 * the /api/marketing endpoint (which wraps the Meta Cloud API).
 */

const WHATSAPP_API_URL = '/api/marketing?action=send_template';

interface WhatsAppTemplateComponent {
    type: 'header' | 'body' | 'footer' | 'button';
    parameters: Array<{
        type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
        text?: string;
        currency?: {
            code: string;
            amount_1000: number;
        };
        date_time?: {
            fallback_value: string;
        };
        image?: {
            link: string;
        };
        document?: {
            link: string;
            filename: string;
        };
        video?: {
            link: string;
        };
    }>;
}

interface SendTemplateParams {
    to: string;
    template: string;
    language?: string;
    components: WhatsAppTemplateComponent[];
}

/**
 * Generic function to send any template via the backend API.
 */
export async function sendWhatsappTemplate(params: SendTemplateParams): Promise<boolean> {
    try {
        const response = await fetch(WHATSAPP_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: params.to,
                template: params.template,
                language: params.language || 'es_MX',
                components: params.components,
            }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            console.error('❌ WhatsApp API Error:', data.error || 'Unknown error');
            return false;
        }

        console.log(`✅ WhatsApp template "${params.template}" sent to ${params.to}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send WhatsApp notification:', error);
        return false;
    }
}

// ==========================================
// SPECIFIC NOTIFICATION HELPERS
// ==========================================

/**
 * Notify an agent when a new lead is assigned to them.
 * Template: notif_nuevo_lead
 * Variables:
 * {{1}} Agent Name
 * {{2}} Lead Name
 * {{3}} Lead Interest (Model)
 * {{4}} Lead Phone
 */
export async function notifyAgentLeadAssignment(agent: { phone: string; name: string }, lead: { name: string; model_interested: string; phone: string }) {
    if (!agent.phone) return false;

    return sendWhatsappTemplate({
        to: agent.phone,
        template: 'notif_nuevo_lead',
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: agent.name || 'Agente' },
                    { type: 'text', text: lead.name || 'Nuevo Cliente' },
                    { type: 'text', text: lead.model_interested || 'Interés General' },
                    { type: 'text', text: lead.phone || 'Sin número' }
                ]
            }
        ]
    });
}

/**
 * Notify an agent (or admin) when a test drive is scheduled.
 * Template: notif_prueba_manejo (Assumed name)
 * Variables (Assumed):
 * {{1}} Agent Name (or "Equipo")
 * {{2}} Lead Name
 * {{3}} Model to Test
 * {{4}} Date/Time
 */
export async function notifyTestDriveScheduled(agentOrAdminPhone: string, agentName: string, leadName: string, model: string, date: string) {
    if (!agentOrAdminPhone) return false;

    return sendWhatsappTemplate({
        to: agentOrAdminPhone,
        template: 'notif_prueba_manejo',
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: agentName || 'Equipo' },
                    { type: 'text', text: leadName },
                    { type: 'text', text: model },
                    { type: 'text', text: new Date(date).toLocaleString('es-MX') }
                ]
            }
        ]
    });
}

/**
 * Notify store manager when a low stock alert is triggered.
 * Template: notif_stock_bajo (Assumed name)
 * Variables (Assumed):
 * {{1}} Part Name
 * {{2}} SKU
 * {{3}} Current Stock
 * {{4}} Branch Name
 */
export async function notifyLowStockAlert(managerPhone: string, partName: string, sku: string, currentStock: number, branchName: string) {
    if (!managerPhone) return false;

    return sendWhatsappTemplate({
        to: managerPhone,
        template: 'notif_stock_bajo',
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: partName },
                    { type: 'text', text: sku },
                    { type: 'text', text: currentStock.toString() },
                    { type: 'text', text: branchName }
                ]
            }
        ]
    });
}
