import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

// Supabase client (service role)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ===== CONFIG HELPERS =====

interface GmailConfig {
  gmail_email: string;
  gmail_app_password: string;
  sender_filter: string;
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
  enabled: boolean;
  last_sync_at: string | null;
  last_sync_result: string | null;
}

async function getGmailConfig(): Promise<GmailConfig | null> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'gmail_leads_config')
    .single();

  if (error || !data) return null;
  return data.setting_value?.value || null;
}

async function updateLastSync(result: string) {
  const { data: existing } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'gmail_leads_config')
    .single();

  if (existing) {
    const updatedValue = {
      ...existing.setting_value,
      value: {
        ...existing.setting_value.value,
        last_sync_at: new Date().toISOString(),
        last_sync_result: result
      }
    };

    await supabase
      .from('system_settings')
      .update({ setting_value: updatedValue, updated_at: new Date().toISOString() })
      .eq('setting_key', 'gmail_leads_config');
  }
}

// ===== EMAIL PARSING =====

interface ParsedYamahaLead {
  modelo: string;
  nombre: string;
  telefono: string;
  email: string;
  estado: string;
  distribuidor: string;
  metodo_pago: string;
  tipo_accion: string; // COMPRAR, COTIZAR, etc.
}

function parseYamahaEmail(htmlBody: string, textBody: string): ParsedYamahaLead | null {
  // Use text body first, fall back to HTML stripped of tags
  let content = textBody || '';

  if (!content && htmlBody) {
    // Strip HTML tags, decode entities
    content = htmlBody
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(p|div|tr|td|th|li|ul|ol|h[1-6])[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  if (!content) return null;

  // Helper to extract field value
  const extractField = (fieldNames: string[]): string => {
    for (const fieldName of fieldNames) {
      // Try multiple patterns
      const patterns = [
        new RegExp(`${fieldName}\\s*:\\s*(.+?)(?:\\n|$)`, 'im'),
        new RegExp(`${fieldName}\\s*(.+?)(?:\\n|$)`, 'im'),
      ];

      for (const regex of patterns) {
        const match = content.match(regex);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    }
    return '';
  };

  const nombre = extractField(['NOMBRE']);
  const telefono = extractField(['TELÉFONO', 'TELEFONO', 'TEL']);
  const email = extractField(['EMAIL', 'E-MAIL', 'CORREO']);
  const modelo = extractField(['MODELO']);
  const estado = extractField(['ESTADO']);
  const distribuidor = extractField(['DISTRIBUIDOR']);
  const metodo_pago = extractField(['MÉTODO DE PAGO', 'METODO DE PAGO', 'FORMA DE PAGO']);

  // Detect action type (COMPRAR, COTIZAR, etc.)
  let tipo_accion = 'INTERÉS';
  const actionMatch = content.match(/\b(COMPRAR|COTIZAR|AGENDAR|PRUEBA DE MANEJO)\b/i);
  if (actionMatch) tipo_accion = actionMatch[1].toUpperCase();

  // Must have at least a name to be valid
  if (!nombre) return null;

  return {
    modelo, nombre, telefono, email,
    estado, distribuidor, metodo_pago, tipo_accion
  };
}

// Map Yamaha payment method to system financing_type
function mapPaymentMethod(method: string): string {
  const lower = method.toLowerCase().trim();
  if (lower.includes('contado')) return 'Contado';
  if (lower.includes('financiamiento')) return 'Yamaha Especial';
  if (lower.includes('tarjeta')) return 'Tarjeta Bancaria S/I';
  if (lower.includes('crédito') || lower.includes('credito')) return 'Yamaha Especial';
  return method || '';
}

// ===== LEAD CREATION =====

async function createLeadFromEmail(parsed: ParsedYamahaLead, gmailMessageId: string): Promise<{
  success: boolean;
  leadId?: string;
  error?: string;
  duplicate?: boolean;
}> {
  try {
    // Check for duplicate by gmail_message_id
    const { data: existing } = await supabase
      .from('email_lead_imports')
      .select('id')
      .eq('gmail_message_id', gmailMessageId)
      .maybeSingle();

    if (existing) {
      return { success: false, duplicate: true, error: 'Correo ya procesado' };
    }

    // Check for duplicate lead by phone or email
    if (parsed.telefono || parsed.email) {
      let dupQuery = supabase.from('leads').select('id, name').limit(1);
      if (parsed.telefono) {
        dupQuery = dupQuery.eq('phone', parsed.telefono);
      } else if (parsed.email) {
        dupQuery = dupQuery.eq('email', parsed.email);
      }
      const { data: dupLead } = await dupQuery.maybeSingle();

      if (dupLead) {
        // Log as duplicate but don't create
        await supabase.from('email_lead_imports').insert([{
          gmail_message_id: gmailMessageId,
          from_email: 'cliente_potencial@yamaha-motor.com.mx',
          lead_name: parsed.nombre,
          lead_phone: parsed.telefono,
          lead_email: parsed.email,
          model_interested: parsed.modelo,
          lead_state: parsed.estado,
          payment_method: parsed.metodo_pago,
          distributor: parsed.distribuidor,
          lead_id: dupLead.id,
          status: 'duplicate',
          error_message: `Lead duplicado: ${dupLead.name} (${dupLead.id})`,
          synced_by: 'auto'
        }]);
        return { success: false, duplicate: true, leadId: dupLead.id, error: `Lead ya existe: ${dupLead.name}` };
      }
    }

    // Calculate initial score (email leads have higher intent)
    let score = 50; // Base for email lead
    if (parsed.telefono) score += 10;
    if (parsed.email) score += 10;
    if (parsed.modelo) score += 15;
    if (parsed.metodo_pago) score += 10;
    if (parsed.tipo_accion === 'COMPRAR') score += 15;
    else if (parsed.tipo_accion === 'COTIZAR') score += 10;
    score = Math.min(score, 100);

    const status = score >= 80 ? 'Verde' : score >= 60 ? 'Amarillo' : 'Rojo';

    // Find nearest branch by state
    let branchId: string | null = null;
    if (parsed.estado) {
      const { data: branch } = await supabase
        .from('branches')
        .select('id')
        .eq('active', true)
        .ilike('state', `%${parsed.estado}%`)
        .limit(1)
        .maybeSingle();

      if (branch) branchId = branch.id;
    }

    // Fallback: first active branch
    if (!branchId) {
      const { data: defaultBranch } = await supabase
        .from('branches')
        .select('id')
        .eq('active', true)
        .limit(1)
        .maybeSingle();
      if (defaultBranch) branchId = defaultBranch.id;
    }

    // Insert lead
    const leadData = {
      name: parsed.nombre,
      phone: parsed.telefono || null,
      email: parsed.email || null,
      origin: 'Correo Yamaha',
      model_interested: parsed.modelo || null,
      timeframe: 'Inmediato',
      financing_type: mapPaymentMethod(parsed.metodo_pago),
      birthday: null,
      test_drive_requested: parsed.tipo_accion === 'AGENDAR' || parsed.tipo_accion === 'PRUEBA DE MANEJO',
      test_drive_date: null,
      test_drive_completed: false,
      requires_financing: parsed.metodo_pago.toLowerCase().includes('financiamiento') || parsed.metodo_pago.toLowerCase().includes('crédito'),
      down_payment_amount: null,
      financing_term_months: null,
      monthly_payment_amount: null,
      has_id_document: false,
      has_income_proof: false,
      has_address_proof: false,
      score,
      status,
      assigned_agent_id: null,
      branch_id: branchId,
      lead_state: parsed.estado || null
    };

    const { data: insertedLead, error: insertError } = await supabase
      .from('leads')
      .insert([leadData])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting lead from email:', insertError);
      return { success: false, error: insertError.message };
    }

    // Round-robin agent assignment
    try {
      let agentQuery = supabase
        .from('user_profiles')
        .select('id, full_name, email, phone')
        .eq('role', 'vendedor')
        .eq('active', true);

      if (branchId) {
        agentQuery = agentQuery.eq('branch_id', branchId);
      }

      const { data: agents } = await agentQuery;

      if (agents && agents.length > 0) {
        let minLeads = Infinity;
        let selectedAgent = agents[0];

        for (const agent of agents) {
          const { count } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_agent_id', agent.id);

          if ((count || 0) < minLeads) {
            minLeads = count || 0;
            selectedAgent = agent;
          }
        }

        await supabase
          .from('leads')
          .update({ assigned_agent_id: selectedAgent.id })
          .eq('id', insertedLead.id);

        await supabase.from('lead_assignments').insert([{
          lead_id: insertedLead.id,
          agent_id: selectedAgent.id,
          assigned_at: new Date().toISOString(),
          status: 'active',
          notes: `Asignación automática desde Correo Yamaha - Score: ${score} (${status})`
        }]);
      }
    } catch (assignErr) {
      console.error('Error in agent assignment for email lead:', assignErr);
    }

    // Create initial interaction
    await supabase.from('lead_interactions').insert([{
      lead_id: insertedLead.id,
      interaction_type: 'note',
      channel: 'Email',
      message: `Lead importado desde correo de Yamaha Motor de México.\n• Acción: ${parsed.tipo_accion}\n• Modelo: ${parsed.modelo}\n• Distribuidor: ${parsed.distribuidor}\n• Método de pago: ${parsed.metodo_pago}\n• Estado: ${parsed.estado}`,
      direction: 'inbound',
      agent_id: null
    }]);

    // Log successful import
    await supabase.from('email_lead_imports').insert([{
      gmail_message_id: gmailMessageId,
      from_email: 'cliente_potencial@yamaha-motor.com.mx',
      lead_name: parsed.nombre,
      lead_phone: parsed.telefono,
      lead_email: parsed.email,
      model_interested: parsed.modelo,
      lead_state: parsed.estado,
      payment_method: parsed.metodo_pago,
      distributor: parsed.distribuidor,
      lead_id: insertedLead.id,
      status: 'success',
      synced_by: 'auto'
    }]);

    return { success: true, leadId: insertedLead.id };
  } catch (err) {
    console.error('Error creating lead from email:', err);
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';

    // Log error
    try {
      await supabase.from('email_lead_imports').insert([{
        gmail_message_id: gmailMessageId,
        from_email: 'cliente_potencial@yamaha-motor.com.mx',
        lead_name: parsed.nombre,
        lead_phone: parsed.telefono,
        model_interested: parsed.modelo,
        status: 'error',
        error_message: errorMsg,
        synced_by: 'auto'
      }]);
    } catch (_) {}

    return { success: false, error: errorMsg };
  }
}

// ===== IMAP SYNC =====

async function syncGmailLeads(config: GmailConfig): Promise<{
  success: boolean;
  processed: number;
  created: number;
  duplicates: number;
  errors: number;
  details: any[];
}> {
  const results = {
    success: true,
    processed: 0,
    created: 0,
    duplicates: 0,
    errors: 0,
    details: [] as any[]
  };

  let client: ImapFlow | null = null;

  try {
    client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: config.gmail_email,
        pass: config.gmail_app_password
      },
      logger: false
    });

    await client.connect();
    console.log(`📧 Connected to Gmail: ${config.gmail_email}`);

    const lock = await client.getMailboxLock('INBOX');

    try {
      // Search for messages from Yamaha sender
      // Using IMAP SEARCH: FROM + UNSEEN
      const senderFilter = config.sender_filter || 'cliente_potencial@yamaha-motor.com.mx';

      const searchCriteria: any = {
        from: senderFilter,
        seen: false
      };

      const messages: number[] = [];
      // First, search for matching messages
      for await (const msg of client.fetch(searchCriteria, { uid: true, envelope: true, source: true })) {
        results.processed++;
        const msgUid = msg.uid.toString();

        try {
          // Parse the email
          const parsed = await simpleParser(msg.source);

          const htmlBody = parsed.html || '';
          const textBody = parsed.textAsHtml ? '' : (parsed.text || '');

          // Parse Yamaha lead data
          const leadData = parseYamahaEmail(
            typeof htmlBody === 'string' ? htmlBody : '',
            textBody
          );

          if (!leadData) {
            results.details.push({
              messageId: msgUid,
              subject: parsed.subject,
              status: 'skipped',
              reason: 'No se pudo extraer datos del correo'
            });

            // Log as skipped
            try {
              await supabase.from('email_lead_imports').insert([{
                gmail_message_id: `uid-${msgUid}-${Date.now()}`,
                from_email: senderFilter,
                subject: parsed.subject || '',
                status: 'skipped',
                error_message: 'No se pudieron extraer datos del correo',
                raw_body: (typeof htmlBody === 'string' ? htmlBody : '').substring(0, 5000),
                synced_by: 'auto'
              }]);
            } catch (_) {}

            // Mark as seen anyway
            messages.push(msg.uid);
            continue;
          }

          // Create the lead
          const result = await createLeadFromEmail(leadData, `uid-${msgUid}-${parsed.messageId || Date.now()}`);

          if (result.success) {
            results.created++;
            results.details.push({
              messageId: msgUid,
              name: leadData.nombre,
              model: leadData.modelo,
              status: 'created',
              leadId: result.leadId
            });
          } else if (result.duplicate) {
            results.duplicates++;
            results.details.push({
              messageId: msgUid,
              name: leadData.nombre,
              status: 'duplicate',
              reason: result.error
            });
          } else {
            results.errors++;
            results.details.push({
              messageId: msgUid,
              name: leadData.nombre,
              status: 'error',
              reason: result.error
            });
          }

          // Mark message as seen
          messages.push(msg.uid);

        } catch (parseErr) {
          results.errors++;
          results.details.push({
            messageId: msgUid,
            status: 'error',
            reason: parseErr instanceof Error ? parseErr.message : 'Error parsing email'
          });
        }
      }

      // Mark all processed messages as seen
      if (messages.length > 0) {
        try {
          for (const uid of messages) {
            await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });
          }
          console.log(`✅ Marked ${messages.length} messages as read`);
        } catch (flagErr) {
          console.error('Error marking messages as read:', flagErr);
        }
      }

    } finally {
      lock.release();
    }

    await client.logout();
    console.log(`📧 Gmail sync complete: ${results.created} created, ${results.duplicates} duplicates, ${results.errors} errors`);

  } catch (err) {
    results.success = false;
    console.error('Gmail sync error:', err);
    results.details.push({
      status: 'connection_error',
      reason: err instanceof Error ? err.message : 'Error de conexión'
    });
  }

  return results;
}

// ===== TEST CONNECTION =====

async function testGmailConnection(config: GmailConfig): Promise<{
  success: boolean;
  message: string;
  unreadCount?: number;
}> {
  let client: ImapFlow | null = null;

  try {
    client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: config.gmail_email,
        pass: config.gmail_app_password
      },
      logger: false
    });

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    let unreadCount = 0;
    try {
      const senderFilter = config.sender_filter || 'cliente_potencial@yamaha-motor.com.mx';

      // Count unread from sender
      for await (const _msg of client.fetch({ from: senderFilter, seen: false }, { uid: true })) {
        unreadCount++;
      }
    } finally {
      lock.release();
    }

    await client.logout();

    return {
      success: true,
      message: `Conexión exitosa a ${config.gmail_email}`,
      unreadCount
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Error desconocido';

    let friendlyMsg = 'Error de conexión';
    if (errorMsg.includes('AUTHENTICATIONFAILED') || errorMsg.includes('Invalid credentials')) {
      friendlyMsg = 'Credenciales inválidas. Verifica el email y la Contraseña de Aplicación.';
    } else if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('ETIMEDOUT')) {
      friendlyMsg = 'No se pudo conectar al servidor de Gmail. Verifica tu conexión a internet.';
    }

    return {
      success: false,
      message: friendlyMsg
    };
  }
}

// ===== MAIN HANDLER =====

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = (req.query.action as string) || '';

  // ===== GET: History =====
  if (req.method === 'GET' && action === 'history') {
    const limit = parseInt(req.query.limit as string) || 50;

    const { data, error } = await supabase
      .from('email_lead_imports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, data });
  }

  // ===== GET: Config =====
  if (req.method === 'GET' && action === 'config') {
    const config = await getGmailConfig();
    if (!config) {
      return res.status(200).json({
        success: true,
        data: {
          gmail_email: '',
          gmail_app_password: '',
          sender_filter: 'cliente_potencial@yamaha-motor.com.mx',
          auto_sync_enabled: false,
          sync_interval_minutes: 30,
          enabled: false,
          last_sync_at: null,
          last_sync_result: null
        }
      });
    }
    // Mask password for security
    return res.status(200).json({
      success: true,
      data: {
        ...config,
        gmail_app_password: config.gmail_app_password ? '••••••••••••••••' : ''
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  // ===== POST: Save Config =====
  if (action === 'save_config') {
    const body = req.body;

    // Read current config
    const { data: existing } = await supabase
      .from('system_settings')
      .select('id, setting_value')
      .eq('setting_key', 'gmail_leads_config')
      .single();

    const currentValue = existing?.setting_value?.value || {};

    const newConfig = {
      gmail_email: body.gmail_email ?? currentValue.gmail_email ?? '',
      gmail_app_password: (body.gmail_app_password && !body.gmail_app_password.includes('••••'))
        ? body.gmail_app_password
        : currentValue.gmail_app_password ?? '',
      sender_filter: body.sender_filter ?? currentValue.sender_filter ?? 'cliente_potencial@yamaha-motor.com.mx',
      auto_sync_enabled: body.auto_sync_enabled ?? currentValue.auto_sync_enabled ?? false,
      sync_interval_minutes: body.sync_interval_minutes ?? currentValue.sync_interval_minutes ?? 30,
      enabled: body.enabled ?? currentValue.enabled ?? false,
      last_sync_at: currentValue.last_sync_at,
      last_sync_result: currentValue.last_sync_result,
    };

    const settingPayload = {
      setting_value: {
        label: 'Configuración Email Leads (Yamaha)',
        type: 'json',
        value: newConfig
      },
      updated_at: new Date().toISOString()
    };

    if (existing) {
      const { error } = await supabase
        .from('system_settings')
        .update(settingPayload)
        .eq('setting_key', 'gmail_leads_config');
      if (error) return res.status(500).json({ success: false, error: error.message });
    } else {
      const { error } = await supabase
        .from('system_settings')
        .insert([{
          setting_key: 'gmail_leads_config',
          ...settingPayload,
          category: 'integrations',
          description: 'Configuración para importar leads desde correos Gmail',
          editable_by_role: ['admin'],
          is_public: false
        }]);
      if (error) return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, message: 'Configuración guardada' });
  }

  // ===== POST: Test Connection =====
  if (action === 'test') {
    let config: GmailConfig;

    // Accept inline config for testing before saving
    if (req.body?.gmail_email && req.body?.gmail_app_password) {
      config = req.body as GmailConfig;
    } else {
      const savedConfig = await getGmailConfig();
      if (!savedConfig || !savedConfig.gmail_email || !savedConfig.gmail_app_password) {
        return res.status(400).json({
          success: false,
          message: 'Configura el email y la contraseña de aplicación primero'
        });
      }
      config = savedConfig;
    }

    const result = await testGmailConnection(config);
    return res.status(200).json(result);
  }

  // ===== POST: Sync =====
  if (action === 'sync') {
    const config = await getGmailConfig();

    if (!config || !config.gmail_email || !config.gmail_app_password) {
      return res.status(400).json({
        success: false,
        error: 'Gmail no configurado. Ve a Configuración > Email Leads'
      });
    }

    if (!config.enabled) {
      // Allow sync even if disabled if called manually
      const isCron = req.query.cron === 'true';
      if (isCron) {
        return res.status(200).json({
          success: true,
          message: 'Sincronización deshabilitada',
          processed: 0
        });
      }
    }

    const result = await syncGmailLeads(config);

    // Update last sync
    const syncSummary = `${result.created} creados, ${result.duplicates} duplicados, ${result.errors} errores (de ${result.processed} correos)`;
    await updateLastSync(syncSummary);

    return res.status(200).json(result);
  }

  return res.status(400).json({ success: false, error: 'Acción no válida. Usa: sync, test, save_config, history, config' });
}
