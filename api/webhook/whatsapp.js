
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    // 1. VERIFICACIÓN (GET) - Cuando Meta configura el webhook
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        // Use env var or fallback for verify token
        const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || process.env.VERIFY_TOKEN || 'quma_whatsapp_verify_2024_secret';

        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('✅ Webhook verificado correctamente');
            return res.status(200).send(challenge);
        } else {
            console.log('❌ Token incorrecto');
            return res.status(403).send('Forbidden');
        }
    }

    // 2. EVENTOS (POST) - Cuando llegan mensajes
    if (req.method === 'POST') {
        const body = req.body;

        // Responder OK inmediatamente para evitar reintentos de Meta
        res.status(200).send('EVENT_RECEIVED');

        try {
            if (body.object === 'whatsapp_business_account') {
                for (const entry of body.entry) {
                    for (const change of entry.changes) {
                        const value = change.value;

                        // --- A. Status Updates (sent, delivered, read) ---
                        if (value.statuses) {
                            for (const status of value.statuses) {
                                const wamid = status.id;
                                const newStatus = status.status;
                                const timestamp = status.timestamp;
                                const recipientId = status.recipient_id;

                                console.log(`📩 Status Update: ${newStatus} for ${wamid}`);

                                // Update Campaign Log
                                const { data: log } = await supabase.from('campaign_logs').select('*').eq('wamid', wamid).single();

                                if (log) {
                                    await supabase.from('campaign_logs').update({
                                        status: newStatus,
                                        updated_at: new Date().toISOString(),
                                        ...(newStatus === 'sent' ? { sent_at: new Date(timestamp * 1000).toISOString() } : {}),
                                        ...(newStatus === 'delivered' ? { delivered_at: new Date(timestamp * 1000).toISOString() } : {}),
                                        ...(newStatus === 'read' ? { read_at: new Date(timestamp * 1000).toISOString() } : {})
                                    }).eq('id', log.id);

                                    // Update Campaign Stats (increment delivered/read counts)
                                    if (log.campaign_id && newStatus === 'delivered' && log.status !== 'delivered' && log.status !== 'read') {
                                        const { data: campaign } = await supabase.from('automated_campaigns').select('total_delivered').eq('id', log.campaign_id).single();
                                        if (campaign) {
                                            await supabase.from('automated_campaigns').update({ total_delivered: (campaign.total_delivered || 0) + 1 }).eq('id', log.campaign_id);
                                        }
                                    }
                                    // Optionally track 'read' stats too in future
                                } else {
                                    console.log(`⚠️ Log not found for wamid: ${wamid}`);
                                }
                            }
                        }

                        // --- B. Incoming Messages (Responses) ---
                        if (value.messages) {
                            for (const message of value.messages) {
                                const from = message.from; // Phone number
                                const msgBody = message.text?.body || '[Media/Other]';
                                // const wamid = message.id;

                                console.log(`📩 New Message from ${from}: ${msgBody}`);

                                // Attribute response to recent campaign
                                const { data: recentLog } = await supabase
                                    .from('campaign_logs')
                                    .select('campaign_id')
                                    .eq('phone', from)
                                    .order('created_at', { ascending: false })
                                    .limit(1)
                                    .single();

                                if (recentLog && recentLog.campaign_id) {
                                    const { data: campaign } = await supabase.from('automated_campaigns').select('total_responses').eq('id', recentLog.campaign_id).single();
                                    if (campaign) {
                                        await supabase.from('automated_campaigns').update({ total_responses: (campaign.total_responses || 0) + 1 }).eq('id', recentLog.campaign_id);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Error processing webhook:', err);
        }
        return;
    }

    res.status(405).send('Method Not Allowed');
}
