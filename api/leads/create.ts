import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

// Crear cliente de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Tipos
interface CreateLeadRequest {
  name: string;
  phone?: string;
  email?: string;
  origin: string;
  model_interested?: string;
  timeframe?: string;
  financing_type?: string;
  birthday?: string;
  test_drive_requested?: boolean;
  test_drive_date?: string;
  requires_financing?: boolean;
  down_payment_amount?: number;
  financing_term_months?: number;
  monthly_payment_amount?: number;
  manychat_user_id?: string;
  manychat_conversation_id?: string;
  metadata?: Record<string, any>;
}

interface CreateLeadResponse {
  success: boolean;
  data?: {
    lead_id: string;
    name: string;
    score: number;
    status: string;
    assigned_agent_id?: string | null;
    assigned_agent_name?: string | null;
  };
  error?: string;
  message?: string;
  whatsapp_debug?: any;
}

// Validación
function validateLeadData(data: CreateLeadRequest): { valid: boolean; error?: string } {
  if (!data.name || data.name.trim().length === 0) {
    return { valid: false, error: 'El nombre es requerido' };
  }

  if (!data.origin || data.origin.trim().length === 0) {
    return { valid: false, error: 'El origen es requerido' };
  }

  if (data.email && data.email.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return { valid: false, error: 'El formato del email es inválido' };
    }
  }

  if (data.phone && data.phone.trim().length > 0) {
    const cleanPhone = data.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return { valid: false, error: 'El teléfono debe tener al menos 10 dígitos' };
    }
  }

  return { valid: true };
}

// Cálculo de score
function calculateInitialScore(data: CreateLeadRequest): number {
  let score = 45;

  // Contacto (+20 puntos máximo)
  if (data.email && data.email.trim().length > 0) score += 10;
  if (data.phone && data.phone.trim().length > 0) score += 10;

  // Interés específico (+15 puntos)
  if (data.model_interested && data.model_interested.trim().length > 0) score += 15;

  // Timeframe (+20 puntos máximo)
  if (data.timeframe) {
    switch (data.timeframe.toLowerCase()) {
      case 'inmediato': score += 20; break;
      case 'pronto': score += 10; break;
      case 'futuro': score += 5; break;
    }
  }

  // Financiamiento (hasta +20 puntos basado en tipo)
  if (data.financing_type) {
    const financingType = data.financing_type.toLowerCase();

    if (financingType.includes('contado')) {
      score += 20; // CONTADO = Máxima prioridad
    } else if (financingType.includes('yamaha especial')) {
      score += 15; // Yamaha Especial = Alto valor
    } else if (financingType.includes('tarjeta bancaria')) {
      score += 12; // Tarjeta = Buen prospecto
    } else if (financingType.includes('corto plazo') || financingType.includes('caja colón')) {
      score += 10; // Otros financiamientos internos
    } else {
      score += 8; // Otros casos
    }
  } else if (data.requires_financing) {
    // Si requiere financiamiento pero no especificó tipo
    score += 10;
  }

  // Prueba de manejo (+5 puntos)
  if (data.test_drive_requested) score += 5;

  return Math.min(score, 100);
}

// Determinar status
function calculateInitialStatus(score: number): string {
  if (score >= 80) return 'Verde';
  if (score >= 60) return 'Amarillo';
  return 'Rojo';
}

// Crear lead
async function createLead(data: CreateLeadRequest): Promise<CreateLeadResponse> {
  try {
    const validation = validateLeadData(data);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        message: validation.error
      };
    }

    const initialScore = calculateInitialScore(data);
    const initialStatus = calculateInitialStatus(initialScore);

    // Ajustar fecha de cumpleaños: agregar zona horaria de México para evitar conversiones
    let birthdayFormatted = null;
    if (data.birthday) {
      // Extraer solo la fecha (YYYY-MM-DD)
      const dateOnly = data.birthday.split('T')[0];
      // Agregar medianoche en zona horaria de México (GMT-6)
      // Esto hará que cuando el frontend haga new Date(), se mantenga el día correcto
      birthdayFormatted = dateOnly + 'T06:00:00.000Z'; // 00:00 México = 06:00 UTC
    }

    // Ajustar fecha de prueba de manejo: interpretar como hora de México (GMT-6)
    let testDriveDateFormatted = null;
    if (data.test_drive_date) {
      // Asumimos que la hora proporcionada es hora local de México
      // Agregamos 6 horas para convertir a UTC (México es GMT-6)
      const localDate = data.test_drive_date.includes('Z') || data.test_drive_date.includes('+')
        ? new Date(data.test_drive_date)
        : new Date(data.test_drive_date + '-06:00'); // Agregar zona horaria de México

      testDriveDateFormatted = localDate.toISOString();
    }

    const leadData = {
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      origin: data.origin,
      model_interested: data.model_interested?.trim() || null,
      timeframe: data.timeframe || null,
      financing_type: data.financing_type || null,
      birthday: birthdayFormatted,
      test_drive_requested: data.test_drive_requested || false,
      test_drive_date: testDriveDateFormatted,
      test_drive_completed: false,
      requires_financing: data.requires_financing || false,
      down_payment_amount: data.down_payment_amount || null,
      financing_term_months: data.financing_term_months || null,
      monthly_payment_amount: data.monthly_payment_amount || null,
      has_id_document: false,
      has_income_proof: false,
      has_address_proof: false,
      score: initialScore,
      status: initialStatus,
      assigned_agent_id: null
    };

    const { data: insertedLead, error: insertError } = await supabase
      .from('leads')
      .insert([leadData])
      .select()
      .single();

    if (insertError) {
      console.error('Error al insertar lead:', insertError);
      return {
        success: false,
        error: 'Error al crear el lead en la base de datos',
        message: insertError.message
      };
    }

    // ===== ASIGNACIÓN AUTOMÁTICA ROUND ROBIN =====
    let assignedAgent = null;

    try {
      // Obtener agentes activos ordenados por total_leads_assigned (ascendente)
      const { data: activeAgents, error: agentsError } = await supabase
        .from('sales_agents')
        .select('id, name, email, phone, total_leads_assigned')
        .eq('status', 'active')
        .order('total_leads_assigned', { ascending: true })
        .limit(1);

      if (!agentsError && activeAgents && activeAgents.length > 0) {
        assignedAgent = activeAgents[0];

        // Asignar el lead al agente
        const { error: updateError } = await supabase
          .from('leads')
          .update({ assigned_agent_id: assignedAgent.id })
          .eq('id', insertedLead.id);

        if (updateError) {
          console.error('Error al asignar lead al agente:', updateError);
        } else {

          // Increment agent count
          await supabase
            .from('sales_agents')
            .update({
              total_leads_assigned: (assignedAgent.total_leads_assigned || 0) + 1
            })
            .eq('id', assignedAgent.id);

          // Create assignment record
          await supabase
            .from('lead_assignments')
            .insert([{
              lead_id: insertedLead.id,
              agent_id: assignedAgent.id,
              assigned_at: new Date().toISOString(),
              status: 'active',
              notes: `Asignación automática vía Round Robin - Score inicial: ${initialScore} (${initialStatus})`
            }]);

          console.log(`Lead ${insertedLead.id} asignado a agente ${assignedAgent.name} (${assignedAgent.id})`);

          // --- SEND WHATSAPP NOTIFICATION TO AGENT ---
          if (process.env.PHONE_NUMBER_ID && process.env.META_ACCESS_TOKEN && assignedAgent.phone) {
            try {
              const phoneId = process.env.PHONE_NUMBER_ID;
              const token = process.env.META_ACCESS_TOKEN;
              const version = process.env.API_VERSION || 'v21.0';

              // Format phone: remove non-digits. If 10 digits, add '52'.
              let agentPhone = assignedAgent.phone.replace(/\D/g, '');
              if (agentPhone.length === 10) agentPhone = '52' + agentPhone;

              const notificationBody = {
                messaging_product: 'whatsapp',
                to: agentPhone,
                type: 'template',
                template: {
                  name: 'notif_nuevo_lead',
                  language: { code: 'es_MX' },
                  components: [
                    {
                      type: 'body',
                      parameters: [
                        { type: 'text', text: assignedAgent.name || 'Agente' },     // {{1}}
                        { type: 'text', text: insertedLead.name || 'Cliente' },     // {{2}}
                        { type: 'text', text: insertedLead.model_interested || 'Interés General' }, // {{3}}
                        { type: 'text', text: insertedLead.phone || 'N/A' }         // {{4}}
                      ]
                    }
                  ]
                }
              };

              await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(notificationBody)
              });
              console.log(`✅ WhatsApp sent to agent ${assignedAgent.name}`);
            } catch (waError) {
              console.error('❌ Failed to send WhatsApp to agent:', waError);
            }
          }
          // --- END WHATSAPP NOTIFICATION ---
        }
      } else {
        console.log('No hay agentes activos disponibles para asignar');
      }
    } catch (assignError) {
      console.error('Error en el proceso de asignación:', assignError);
      // Continuar aunque falle la asignación
    }
    // ===== FIN ASIGNACIÓN ROUND ROBIN =====

    // Crear interacción inicial
    await supabase
      .from('lead_interactions')
      .insert([{
        lead_id: insertedLead.id,
        interaction_type: 'note',
        channel: data.origin === 'Chatbot WA' ? 'WhatsApp' : 'System',
        message: `Lead registrado desde ${data.origin}${data.manychat_user_id ? ` - ManyChat ID: ${data.manychat_user_id}` : ''}${assignedAgent ? ` - Asignado a: ${assignedAgent.name}` : ''}`,
        direction: 'inbound',
        agent_id: assignedAgent?.id || null
      }]);

    // Si solicitó prueba de manejo
    if (data.test_drive_requested && testDriveDateFormatted && data.model_interested) {
      const { data: catalogItem } = await supabase
        .from('catalog')
        .select('id')
        .eq('model', data.model_interested)
        .eq('active', true)
        .maybeSingle();

      await supabase
        .from('test_drive_appointments')
        .insert([{
          lead_id: insertedLead.id,
          lead_name: data.name,
          lead_phone: data.phone || null,
          catalog_item_id: catalogItem?.id || null,
          catalog_model: data.model_interested,
          appointment_date: testDriveDateFormatted,
          duration_minutes: 30,
          status: 'scheduled',
          pickup_location: 'agencia',
          notes: `Prueba de manejo programada desde ${data.origin}`,
          agent_id: assignedAgent?.id || null,
          agent_name: assignedAgent?.name || null
        }]);

      // --- SEND TEST DRIVE WHATSAPP NOTIFICATION ---
      if (process.env.PHONE_NUMBER_ID && process.env.META_ACCESS_TOKEN && assignedAgent && assignedAgent.phone) {
        try {
          const phoneId = process.env.PHONE_NUMBER_ID;
          const token = process.env.META_ACCESS_TOKEN;
          const version = process.env.API_VERSION || 'v21.0';

          let agentPhone = assignedAgent.phone.replace(/\D/g, '');
          if (agentPhone.length === 10) agentPhone = '52' + agentPhone;

          const tdBody = {
            messaging_product: 'whatsapp',
            to: agentPhone,
            type: 'template',
            template: {
              name: 'notif_prueba_manejo',
              language: { code: 'es_MX' },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: assignedAgent.name || 'Agente' },
                    { type: 'text', text: data.name },
                    { type: 'text', text: data.model_interested || 'Modelo' },
                    { type: 'text', text: new Date(testDriveDateFormatted).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) }
                  ]
                }
              ]
            }
          };

          await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(tdBody)
          });
          console.log(`✅ Test Drive WhatsApp sent to agent ${assignedAgent.name}`);
        } catch (waError) {
          console.error('❌ Failed to send Test Drive WhatsApp:', waError);
        }
      }
      // --- END TEST DRIVE NOTIFICATION ---
    }

    return {
      success: true,
      data: {
        lead_id: insertedLead.id,
        name: insertedLead.name,
        score: insertedLead.score,
        status: insertedLead.status,
        assigned_agent_id: assignedAgent?.id || null,
        assigned_agent_name: assignedAgent?.name || null
      },
      message: assignedAgent
        ? `Lead "${insertedLead.name}" creado exitosamente con score ${insertedLead.score} (${initialStatus}) y asignado a ${assignedAgent.name}`
        : `Lead "${insertedLead.name}" creado exitosamente con score ${insertedLead.score} (${initialStatus}) - Sin agentes disponibles para asignar`,
      whatsapp_debug: {
        attempted: !!assignedAgent,
        agent_phone: assignedAgent?.phone || 'N/A',
        has_credentials: !!(process.env.PHONE_NUMBER_ID && process.env.META_ACCESS_TOKEN),
        status: 'proccessed_in_background'
      }
    };

  } catch (error) {
    console.error('Error inesperado al crear lead:', error);
    return {
      success: false,
      error: 'Error inesperado al procesar la solicitud',
      message: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Handler principal
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método no permitido',
      message: 'Solo se permite el método POST'
    });
  }

  try {
    // Validar API Key
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.API_KEY;

    if (validApiKey && apiKey !== validApiKey) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado',
        message: 'API Key inválida'
      });
    }

    const leadData: CreateLeadRequest = req.body;

    if (!leadData || typeof leadData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        message: 'El body debe contener los datos del lead en formato JSON'
      });
    }

    const result = await createLead(leadData);

    if (result.success) {
      return res.status(201).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error en /api/leads/create:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}