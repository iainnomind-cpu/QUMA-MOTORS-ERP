
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load .env from project root
dotenv.config();

// ==========================================
// CONFIGURATION & SETUP
// ==========================================
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const WABA_ID = process.env.WABA_ID;
const API_VERSION = process.env.API_VERSION || 'v21.0';
const APP_ID = process.env.META_APP_ID;

if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.error('❌ WhatsApp Credentials missing in .env');
}

// ==========================================
// SHARED HELPERS
// ==========================================

async function sendTemplateMessage(to, templateName, components = [], languageCode = 'es_MX') {
    const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
    const body = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
            name: templateName,
            language: { code: languageCode },
            components: components
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok) {
            console.error('❌ Meta API Error:', JSON.stringify(data, null, 2));
            throw new Error(data.error?.message || 'Failed to send message');
        }
        return data;
    } catch (error) {
        console.error('❌ Error sending WhatsApp message:', error);
        throw error;
    }
}

const logToFile = (msg) => {
    try {
        fs.appendFileSync('last_error.txt', `[${new Date().toISOString()}] ${msg}\n`);
    } catch (e) { /* ignore */ }
};

let cachedAppId = APP_ID;

async function getAppId() {
    if (cachedAppId) return cachedAppId;
    try {
        const response = await fetch(`https://graph.facebook.com/${API_VERSION}/app`, {
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
        });
        const data = await response.json();
        if (data.id) {
            cachedAppId = data.id;
            return data.id;
        }
        throw new Error('Failed to get App ID: ' + JSON.stringify(data));
    } catch (e) {
        console.error('Error fetching App ID:', e);
        throw e;
    }
}

async function uploadMediaToMeta(base64Image) {
    if (!base64Image) return null;

    try {
        // 1. Parse
        const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
        if (!matches || matches.length !== 3) throw new Error('Invalid base64 image data');
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const fileLength = buffer.length;

        const appId = await getAppId();

        // 2. Start Session
        const startUrl = `https://graph.facebook.com/${API_VERSION}/${appId}/uploads?file_length=${fileLength}&file_type=${mimeType}`;
        const startRes = await fetch(startUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
        });
        const startData = await startRes.json();
        if (!startData.id) throw new Error('Failed to start upload session: ' + JSON.stringify(startData));

        const uploadSessionId = startData.id;

        // 3. Upload Content
        const uploadUrl = `https://graph.facebook.com/${API_VERSION}/${uploadSessionId}`;
        const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'file_offset': '0'
            },
            body: buffer
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.h) throw new Error('Failed to upload file content: ' + JSON.stringify(uploadData));

        return uploadData.h;
    } catch (e) {
        console.error('Error uploading media to Meta:', e);
        throw e;
    }
}

// ==========================================
// CORE LOGIC HANDLERS
// ==========================================

// --- 1. SEND CAMPAIGN CORE LOGIC ---
async function executeCampaignSend(campaignId) {
    if (!campaignId) throw new Error('Missing campaign_id');

    logToFile(`Starting campaign send for ID: ${campaignId}`);

    const { data: campaign, error: campaignError } = await supabase.from('automated_campaigns').select('*').eq('id', campaignId).single();
    if (campaignError || !campaign) throw new Error(`Campaign not found: ${campaignError?.message}`);

    const { data: template, error: templateError } = await supabase.from('whatsapp_templates').select('*').eq('id', campaign.template_id).single();
    if (templateError || !template) throw new Error(`Template not found: ${templateError?.message}`);

    const { data: audience, error: audienceError } = await supabase.from('campaign_audiences').select('*').eq('id', campaign.audience_id).single();
    if (audienceError || !audience) throw new Error(`Audience not found: ${audienceError?.message}`);

    let recipients = [];
    const filters = audience.filters || {};

    // LEADS
    if (!audience.target_type || audience.target_type === 'leads' || audience.target_type === 'mixed') {
        let query = supabase.from('leads').select('*');
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.model_interested) query = query.eq('model_interested', filters.model_interested);
        if (filters.origin) query = query.eq('origin', filters.origin);
        if (filters.financing_type) query = query.eq('financing_type', filters.financing_type);
        if (filters.requires_financing !== undefined) query = query.eq('requires_financing', filters.requires_financing);
        if (filters.timeframe) query = query.eq('timeframe', filters.timeframe);
        if (filters.score_min) query = query.gte('score', filters.score_min);

        const { data: leads } = await query;
        if (leads) {
            let filtered = leads;
            if (filters.test_drive === 'requested') filtered = filtered.filter(l => l.test_drive_requested);
            if (filters.test_drive === 'completed') filtered = filtered.filter(l => l.test_drive_completed);
            if (filters.test_drive === 'not_requested') filtered = filtered.filter(l => !l.test_drive_requested);
            recipients.push(...filtered.map(l => ({ ...l, type: 'leads' })));
        }
    }

    // CLIENTS
    if (audience.target_type === 'clients' || audience.target_type === 'mixed') {
        let query = supabase.from('clients').select('*');
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.model_interested) query = query.eq('purchased_model', filters.model_interested);
        if (filters.purchase_type) query = query.eq('purchase_type', filters.purchase_type);
        if (filters.price_min) query = query.gte('purchase_price', filters.price_min);
        if (filters.price_max) query = query.lte('purchase_price', filters.price_max);

        const { data: clients } = await query;
        if (clients) {
            let filtered = clients;
            if (filters.last_purchase_days) {
                const cutoff = new Date(Date.now() - filters.last_purchase_days * 24 * 60 * 60 * 1000).toISOString();
                filtered = filtered.filter(c => c.last_purchase_date && c.last_purchase_date >= cutoff);
            }
            recipients.push(...filtered.map(c => ({ ...c, type: 'clients' })));
        }
    }

    const initialCount = recipients.length;

    // JS FILTERING
    recipients = recipients.filter(person => {
        if (!person.phone) return false;
        let p = String(person.phone).replace(/[^0-9]/g, '');
        if (p.length < 10) return false;
        if (filters.score_min && person.score < filters.score_min) return false;
        if (filters.birthday_month === 'current') {
            if (!person.birthday) return false;
            const currentMonth = new Date().getMonth();
            const birthMonth = new Date(person.birthday).getMonth();
            if (birthMonth !== currentMonth) return false;
        }
        if (filters.birthday_month && filters.birthday_month !== 'current') {
            if (!person.birthday) return false;
            const targetMonth = parseInt(filters.birthday_month);
            const birthMonth = new Date(person.birthday).getMonth();
            if (birthMonth !== targetMonth) return false;
        }
        return true;
    });

    const filteredCount = recipients.length;

    // UPDATE STATUS
    await supabase.from('automated_campaigns').update({ status: 'active' }).eq('id', campaign.id);

    let sentCount = 0;
    const errors = [];

    const logMessageToDB = async (recipient, phone, wamid) => {
        await supabase.from('campaign_logs').insert([{
            campaign_id: campaign.id,
            recipient_type: recipient.type,
            recipient_id: recipient.id,
            phone: phone,
            message: template.message_template,
            status: 'sent',
            sent_at: new Date().toISOString(),
            wamid: wamid
        }]);
        // Also update local_last_notification_sent if needed, but not strictly required here
    };

    for (const recipient of recipients) {
        let phone = String(recipient.phone).replace(/[^0-9]/g, '');
        // Teléfonos mexicanos a 10 dígitos: Volvemos al estándar 52 puro ahora que la app está En Producción.
        if (phone.length === 10) phone = '52' + phone;

        try {
            const hasVariables = template.message_template && template.message_template.includes('{{');
            let components = [];
            if (hasVariables) {
                components = [{
                    type: 'body',
                    parameters: [{ type: 'text', text: recipient.name || 'Cliente' }]
                }];
            }

            try {
                const result = await sendTemplateMessage(phone, template.name, components);
                const wamid = result.messages?.[0]?.id;
                await logMessageToDB(recipient, phone, wamid);
                sentCount++;
            } catch (sendErr) {
                // Retry Logic
                const isParamError = sendErr.message && (
                    sendErr.message.includes('parameters mismatch') ||
                    sendErr.message.includes('(#131009)') ||
                    sendErr.message.includes('(#132012)') ||
                    sendErr.message.includes('(#132000)') ||
                    sendErr.message.includes('Parameter format does not match') ||
                    sendErr.message.includes('expected number of params')
                );
                const isTemplateNotFoundError = sendErr.message && (
                    sendErr.message.includes('(#132001)') ||
                    sendErr.message.includes('does not exist')
                );

                if (isParamError) {
                    let solvedParams = false;
                    let lastRetryErr = sendErr.message;
                    // Test 1, 0, 2, and 3 parameters in sequence
                    for (const paramCount of [1, 0, 2, 3]) {
                        let testComponents;
                        if (paramCount === 0) {
                            testComponents = undefined;
                        } else {
                            const testParams = [];
                            for(let k=0; k<paramCount; k++) {
                               testParams.push({type: 'text', text: k===0 ? (recipient.name || 'Cliente') : 'Asesor'});
                            }
                            testComponents = [{ type: 'body', parameters: testParams }];
                        }
                        try {
                            const retryResult = await sendTemplateMessage(phone, template.name, testComponents);
                            const wamid = retryResult.messages?.[0]?.id;
                            await logMessageToDB(recipient, phone, wamid);
                            sentCount++;
                            solvedParams = true;
                            break;
                        } catch (retryErr) {
                            lastRetryErr = retryErr.message;
                        }
                    }
                    if (!solvedParams) {
                        errors.push({ phone, error: `Fallo automático de variables: ${lastRetryErr}` });
                    }
                } else if (isTemplateNotFoundError) {
                    const saneName1 = template.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                    const saneName2 = template.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_]/g, '_');
                    
                    let tryNames = [saneName1];
                    if (saneName1 !== saneName2) tryNames.push(saneName2);
                    
                    let retrySuccess = false;
                    
                    for (const fallbackName of tryNames) {
                        if (fallbackName === template.name) continue;
                        try {
                            const retryResult = await sendTemplateMessage(phone, fallbackName, components);
                            const wamid = retryResult.messages?.[0]?.id;
                            await logMessageToDB(recipient, phone, wamid);
                            sentCount++;
                            retrySuccess = true;
                            break; // Stop trying
                        } catch (retryErr) {
                            // If name is correct but params are wrong, retry adaptive loop
                            if (retryErr.message.includes('parameters mismatch') || 
                                retryErr.message.includes('(#131009)') || 
                                retryErr.message.includes('(#132012)') || 
                                retryErr.message.includes('(#132000)') ||
                                retryErr.message.includes('Parameter format does not match') ||
                                retryErr.message.includes('expected number of params')) {
                                
                                let solvedNested = false;
                                let nestedErrInfo = retryErr.message;
                                for (const paramCount of [1, 0, 2, 3]) {
                                    let testComponents;
                                    if (paramCount === 0) {
                                        testComponents = undefined;
                                    } else {
                                        const testParams = [];
                                        for(let k=0; k<paramCount; k++) {
                                           testParams.push({type: 'text', text: k===0 ? (recipient.name || 'Cliente') : 'Asesor'});
                                        }
                                        testComponents = [{ type: 'body', parameters: testParams }];
                                    }
                                    
                                    try {
                                        const retryResult2 = await sendTemplateMessage(phone, fallbackName, testComponents);
                                        const wamid = retryResult2.messages?.[0]?.id;
                                        await logMessageToDB(recipient, phone, wamid);
                                        sentCount++;
                                        retrySuccess = true;
                                        solvedNested = true;
                                        break;
                                    } catch (e2) {
                                        nestedErrInfo = e2.message;
                                    }
                                }
                                if (!solvedNested && fallbackName === tryNames[tryNames.length - 1]) {
                                    errors.push({ phone, error: `Fallo (nombre ok, variables incompatibles) con ${fallbackName}: ${nestedErrInfo}` });
                                }
                            } else {
                                // Ignore intermediate errors, capture the last one if both fail
                                if (fallbackName === tryNames[tryNames.length - 1]) {
                                    errors.push({ phone, error: `Fallback failed for ${fallbackName}: ` + retryErr.message });
                                }
                            }
                        }
                    }
                    if (!retrySuccess && tryNames.length === 0) {
                        errors.push({ phone, error: sendErr.message });
                    }
                } else {
                    errors.push({ phone, error: sendErr.message });
                }
            }
        } catch (err) {
            errors.push({ phone, error: err.message });
        }
    }

    await supabase.from('automated_campaigns').update({
        total_sent: (campaign.total_sent || 0) + sentCount,
        updated_at: new Date().toISOString()
    }).eq('id', campaign.id);

    return { sent: sentCount, errors: errors.length, details: errors, initialCount, filteredCount };
}

// --- 2. CREATE TEMPLATE CORE LOGIC ---
async function executeCreateTemplate({ name, category, message_template, buttons, header_type, header_image }) {
    if (!name || !message_template) throw new Error('Missing name or message_template');
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // 1. Insert into Supabase (Pending)
    const { data: inserted, error: dbError } = await supabase
        .from('whatsapp_templates')
        .insert([{
            name: normalizedName,
            category: category || 'promotional',
            message_template: message_template,
            active: false,
            status: 'pending'
        }])
        .select().single();

    if (dbError) throw new Error('Database error: ' + dbError.message);

    // 2. Prepare Meta Payload
    let metaBody = message_template;
    const varMatches = metaBody.match(/{{.*?}}/g);
    const varCount = varMatches ? varMatches.length : 0;
    let paramCounter = 1;
    metaBody = metaBody.replace(/{{.*?}}/g, () => `{{${paramCounter++}}}`);

    const components = [];

    // HEADER
    if (header_type === 'IMAGE' && header_image) {
        const handle = await uploadMediaToMeta(header_image);
        if (handle) {
            components.push({
                type: "HEADER",
                format: "IMAGE",
                example: { "header_handle": [handle] }
            });
        }
    }

    // BODY (Note: Body examples are inside BODY component in API v14+, but for creation payload structure varies slightly. 
    // Standard payload for creating templates: components array.
    const bodyComponent = { type: "BODY", text: metaBody };
    if (varCount > 0) {
        const examples = Array(varCount).fill("Ejemplo");
        bodyComponent.example = { body_text: [examples] };
    }
    components.push(bodyComponent);

    if (buttons && buttons.length > 0) {
        const metaButtons = buttons.map(btn => {
            if (btn.type === 'PHONE_NUMBER') return { type: "PHONE_NUMBER", text: btn.text, phone_number: btn.value };
            if (btn.type === 'URL') return { type: "URL", text: btn.text, url: btn.value };
            return { type: "QUICK_REPLY", text: btn.text };
        });
        components.push({ type: "BUTTONS", buttons: metaButtons });
    }

    const payload = {
        name: normalizedName,
        category: category === "UTILITY" ? "UTILITY" : "MARKETING",
        components: components,
        language: "es_MX"
    };

    // 3. Send to Meta
    const url = `https://graph.facebook.com/${API_VERSION}/${WABA_ID}/message_templates`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.error) {
        // Handle "Template already exists" error (Code 100 or specific message)
        const isDuplicate = data.error.message.includes('already exists') ||
            data.error.message.includes('Ya existe contenido') ||
            data.error.code === 100;

        if (isDuplicate) {
            console.log(`Template ${normalizedName} exists. Attempting update...`);

            // a. Find existing template ID
            const searchUrl = `https://graph.facebook.com/${API_VERSION}/${WABA_ID}/message_templates?name=${normalizedName}&limit=1`;
            const searchRes = await fetch(searchUrl, {
                headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
            });
            const searchData = await searchRes.json();

            if (searchData.data && searchData.data.length > 0) {
                const existingId = searchData.data[0].id;

                // b. Update existing template
                const updateUrl = `https://graph.facebook.com/${API_VERSION}/${existingId}`;
                const updateRes = await fetch(updateUrl, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        components: components
                    })
                });
                const updateData = await updateRes.json();

                if (updateData.success) {
                    // Update DB with Meta ID
                    await supabase.from('whatsapp_templates').update({
                        meta_id: existingId,
                        status: 'pending' // Re-review needed after edit
                    }).eq('id', inserted.id);

                    return { inserted, meta_id: existingId, action: 'updated' };
                } else {
                    throw new Error('Meta Update Failed: ' + (updateData.error?.message || JSON.stringify(updateData)));
                }
            }
        }

        // If not duplicate or update failed
        await supabase.from('whatsapp_templates').delete().eq('id', inserted.id);
        throw new Error('Meta Rejected: ' + (data.error.error_user_msg || data.error.message));
    }

    return { inserted, meta_id: data.id, action: 'created' };
}

// --- 3. SYNC TEMPLATES CORE LOGIC ---
async function executeSyncTemplates() {
    const url = `https://graph.facebook.com/${API_VERSION}/${WABA_ID}/message_templates?limit=200`;
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Meta API Error: ${errorText}`);
    }

    const metaData = await response.json();
    const metaTemplates = metaData.data || [];
    const { data: localTemplates } = await supabase.from('whatsapp_templates').select('*');

    let updatedCount = 0;
    let createdCount = 0;

    for (const metaTemplate of metaTemplates) {
        const localMatch = localTemplates.find(t => t.name === metaTemplate.name);
        const bodyComponent = metaTemplate.components.find(c => c.type === 'BODY');
        const bodyText = bodyComponent ? bodyComponent.text : '';
        const isActive = metaTemplate.status === 'APPROVED';

        if (localMatch) {
            if (localMatch.status !== metaTemplate.status || localMatch.active !== isActive || localMatch.meta_id !== metaTemplate.id) {
                await supabase.from('whatsapp_templates').update({
                    status: metaTemplate.status,
                    meta_id: metaTemplate.id,
                    active: isActive,
                    category: metaTemplate.category
                }).eq('id', localMatch.id);
                updatedCount++;
            }
        } else {
            await supabase.from('whatsapp_templates').insert([{
                name: metaTemplate.name,
                category: metaTemplate.category,
                message_template: bodyText,
                language: metaTemplate.language,
                status: metaTemplate.status,
                meta_id: metaTemplate.id,
                active: isActive
            }]);
            createdCount++;
        }
    }
    return { updated: updatedCount, created: createdCount };
}

// --- 4. SCHEDULED & BIRTHDAY PROCESSSOR ---
async function executeProcessScheduled() {
    const now = new Date().toISOString();
    console.log(`[CRON] Checking scheduled at ${now}`);
    const results = [];

    // A. SCHEDULED CAMPAIGNS
    const { data: dueCampaigns } = await supabase
        .from('automated_campaigns')
        .select('*')
        .eq('type', 'scheduled')
        .in('status', ['active', 'draft'])
        .not('schedule_date', 'is', null)
        .lte('schedule_date', now);

    if (dueCampaigns && dueCampaigns.length > 0) {
        for (const campaign of dueCampaigns) {
            try {
                console.log(`[CRON] Processing ${campaign.name}`);
                await supabase.from('automated_campaigns').update({ status: 'sending', updated_at: now }).eq('id', campaign.id);
                const res = await executeCampaignSend(campaign.id); // Reuse Logic

                await supabase.from('automated_campaigns').update({
                    status: 'completed',
                    updated_at: new Date().toISOString()
                }).eq('id', campaign.id);

                results.push({ campaign: campaign.name, sent: res.sent, errors: res.errors.length });
            } catch (err) {
                console.error(`[CRON] Error ${campaign.id}:`, err);
                await supabase.from('automated_campaigns').update({ status: 'failed' }).eq('id', campaign.id);
                results.push({ campaign: campaign.name, error: err.message });
            }
        }
    }

    // B. BIRTHDAY CAMPAIGNS
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const todayStr = today.toISOString().split('T')[0];

    const { data: birthdayCampaigns } = await supabase
        .from('automated_campaigns')
        .select('*')
        .eq('type', 'triggered')
        .eq('trigger_type', 'birthday')
        .eq('status', 'active');

    if (birthdayCampaigns && birthdayCampaigns.length > 0) {
        for (const campaign of birthdayCampaigns) {
            try {
                // Determine potential recipients
                // Leads
                const { data: leads } = await supabase.from('leads').select('*').not('birthday', 'is', null).not('phone', 'is', null);
                // Clients
                const { data: clients } = await supabase.from('clients').select('*').not('birthday', 'is', null).not('phone', 'is', null);

                let eligible = [];
                if (leads) {
                    eligible.push(...leads.filter(l => {
                        const d = new Date(l.birthday);
                        return d.getDate() === todayDay && (d.getMonth() + 1) === todayMonth;
                    }).map(l => ({ ...l, type: 'leads' })));
                }
                if (clients) {
                    eligible.push(...clients.filter(c => {
                        const d = new Date(c.birthday);
                        return d.getDate() === todayDay && (d.getMonth() + 1) === todayMonth;
                    }).map(c => ({ ...c, type: 'clients' })));
                }

                // Dedup already sent today
                const { data: todayLogs } = await supabase
                    .from('campaign_logs')
                    .select('recipient_id')
                    .eq('campaign_id', campaign.id)
                    .gte('sent_at', todayStr + 'T00:00:00.000Z')
                    .lte('sent_at', todayStr + 'T23:59:59.999Z');

                const sentIds = new Set((todayLogs || []).map(l => l.recipient_id));
                eligible = eligible.filter(p => !sentIds.has(p.id));

                if (eligible.length === 0) continue;

                // Send
                const { data: template } = await supabase.from('whatsapp_templates').select('*').eq('id', campaign.template_id).single();
                if (!template) continue;

                let sentCount = 0;
                for (const person of eligible) {
                    let phone = person.phone.replace(/[^0-9]/g, '');
                    if (phone.length === 10) phone = '52' + phone;
                    try {
                        // Simple send for birthdays (handle variables if needed)
                        const hasVariables = template.message_template && template.message_template.includes('{{');
                        let components = [];
                        if (hasVariables) components = [{ type: 'body', parameters: [{ type: 'text', text: person.name || 'Cliente' }] }];

                        const result = await sendTemplateMessage(phone, template.name, components);
                        const wamid = result.messages?.[0]?.id;

                        await supabase.from('campaign_logs').insert([{
                            campaign_id: campaign.id,
                            recipient_type: person.type,
                            recipient_id: person.id,
                            phone: phone,
                            message: template.message_template,
                            status: 'sent',
                            sent_at: new Date().toISOString(),
                            wamid: wamid
                        }]);
                        sentCount++;
                    } catch (e) { console.error(e); }
                }

                // Update Total Sent
                await supabase.from('automated_campaigns').update({
                    total_sent: (campaign.total_sent || 0) + sentCount,
                    updated_at: new Date().toISOString()
                }).eq('id', campaign.id);

                results.push({ campaign: campaign.name, type: 'birthday', sent: sentCount });

            } catch (err) {
                console.error(`[BIRTHDAY] Error ${campaign.id}:`, err);
            }
        }
    }

    return { processed: true, results };
}

// --- 5. DIAGNOSE CORE LOGIC ---
async function executeDiagnose() {
    const results = {
        env_vars: {
            PHONE_NUMBER_ID: !!PHONE_NUMBER_ID,
            META_ACCESS_TOKEN: !!ACCESS_TOKEN,
            WABA_ID: !!WABA_ID,
            API_VERSION: API_VERSION,
            META_APP_ID: !!APP_ID
        },
        token: null,
        phone: null,
        waba: null,
        templates: null
    };

    if (!ACCESS_TOKEN) {
        return { ...results, error: 'META_ACCESS_TOKEN no está configurado en las variables de entorno' };
    }

    // 1. Validate Token
    try {
        const tokenRes = await fetch(`https://graph.facebook.com/${API_VERSION}/debug_token?input_token=${ACCESS_TOKEN}`, {
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
        });
        const tokenData = await tokenRes.json();
        if (tokenData.error) {
            results.token = { valid: false, error: tokenData.error.message, code: tokenData.error.code };
        } else if (tokenData.data) {
            const d = tokenData.data;
            let expiry_status = 'permanent';
            if (d.expires_at && d.expires_at !== 0) {
                const expiryDate = new Date(d.expires_at * 1000);
                expiry_status = expiryDate > new Date() ? `expires_${expiryDate.toISOString()}` : 'EXPIRED';
            }
            results.token = {
                valid: d.is_valid,
                type: d.type,
                app_id: d.app_id,
                expiry: expiry_status,
                scopes: d.scopes || []
            };
        }
    } catch (e) {
        results.token = { valid: false, error: e.message };
    }

    // 2. Validate Phone Number
    if (PHONE_NUMBER_ID) {
        try {
            const phoneRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier`, {
                headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
            });
            const phoneData = await phoneRes.json();
            if (phoneData.error) {
                results.phone = { valid: false, error: phoneData.error.message, code: phoneData.error.code };
            } else {
                results.phone = {
                    valid: true,
                    number: phoneData.display_phone_number,
                    verified_name: phoneData.verified_name,
                    quality: phoneData.quality_rating,
                    messaging_limit: phoneData.messaging_limit_tier
                };
            }
        } catch (e) {
            results.phone = { valid: false, error: e.message };
        }
    }

    // 3. Validate WABA
    if (WABA_ID) {
        try {
            const wabaRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${WABA_ID}?fields=name,message_template_namespace,account_review_status,on_behalf_of_business_info`, {
                headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
            });
            const wabaData = await wabaRes.json();
            if (wabaData.error) {
                results.waba = { valid: false, error: wabaData.error.message };
            } else {
                results.waba = {
                    valid: true,
                    name: wabaData.name,
                    namespace: wabaData.message_template_namespace,
                    review_status: wabaData.account_review_status
                };
            }
        } catch (e) {
            results.waba = { valid: false, error: e.message };
        }

        // 4. List Templates
        try {
            const templatesRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${WABA_ID}/message_templates?limit=50`, {
                headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
            });
            const templatesData = await templatesRes.json();
            if (templatesData.error) {
                results.templates = { valid: false, error: templatesData.error.message };
            } else {
                results.templates = {
                    valid: true,
                    count: templatesData.data?.length || 0,
                    list: (templatesData.data || []).map(t => ({
                        name: t.name,
                        status: t.status,
                        language: t.language,
                        category: t.category
                    }))
                };
            }
        } catch (e) {
            results.templates = { valid: false, error: e.message };
        }
    }

    return results;
}

// ==========================================
// HTTP HANDLER DISPATCHER
// ==========================================
// Export core functions for Cron/Server usage
export { executeProcessScheduled };

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { action } = req.query;

    try {
        switch (action) {
            case 'send_campaign':
                const sendResult = await executeCampaignSend(req.body.campaign_id);
                return res.status(200).json({ success: true, ...sendResult });

            case 'create_template':
                const createResult = await executeCreateTemplate(req.body);
                return res.status(200).json({ success: true, ...createResult });

            case 'sync_templates':
                const syncResult = await executeSyncTemplates();
                return res.status(200).json({ success: true, ...syncResult });

            case 'process_scheduled':
                const processResult = await executeProcessScheduled();
                return res.status(200).json({ success: true, ...processResult });

            case 'send_template':
                const { to, template, components, language } = req.body;
                if (!to || !template) return res.status(400).json({ error: 'Missing to or template' });
                const sendTemplateResult = await sendTemplateMessage(to, template, components, language);
                return res.status(200).json({ success: true, ...sendTemplateResult });

            case 'diagnose':
                const diagnoseResult = await executeDiagnose();
                return res.status(200).json({ success: true, ...diagnoseResult });

            default:
                return res.status(400).json({ error: 'Invalid action. Supported: send_campaign, create_template, sync_templates, process_scheduled, diagnose' });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
