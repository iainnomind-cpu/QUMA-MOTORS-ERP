import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

// Crear cliente de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);


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
  city?: string;       // Localidad del lead (desde chatbot)
  state?: string;      // Estado del lead (desde chatbot)
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
    branch_id?: string | null;
    branch_name?: string | null;
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

// ===== GEOCODIFICACIÓN Y SUCURSAL MÁS CERCANA =====

interface GeoCoords {
  lat: number;
  lng: number;
}

interface BranchWithCoords {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  state: string | null;
  city: string | null;
}

// Geocodificar localidad + estado usando Google Geocoding API
async function geocodeLocation(city: string, state: string): Promise<GeoCoords | null> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_MAPS_API_KEY no configurada');
      return null;
    }

    const address = encodeURIComponent(`${city}, ${state}, México`);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${apiKey}&region=mx&language=es`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      console.log(`📍 Geocodificado "${city}, ${state}" → lat: ${location.lat}, lng: ${location.lng}`);
      return { lat: location.lat, lng: location.lng };
    } else {
      console.warn(`⚠️ No se pudo geocodificar "${city}, ${state}" - Status: ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error('Error en geocodificación:', error);
    return null;
  }
}

// Calcular distancia entre dos puntos usando fórmula Haversine (en km)
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Encontrar la sucursal más cercana
async function findNearestBranch(coords: GeoCoords): Promise<{ id: string; name: string } | null> {
  try {
    const { data: branches, error } = await supabase
      .from('branches')
      .select('id, name, latitude, longitude, state, city')
      .eq('active', true);

    if (error || !branches || branches.length === 0) {
      console.error('Error obteniendo sucursales:', error);
      return null;
    }

    // Filtrar sucursales que tengan coordenadas
    const branchesWithCoords = branches.filter(
      (b: BranchWithCoords) => b.latitude !== null && b.longitude !== null
    );

    if (branchesWithCoords.length === 0) {
      console.warn('Ninguna sucursal tiene coordenadas configuradas');
      // Fallback: retornar la primera sucursal activa
      return { id: branches[0].id, name: branches[0].name };
    }

    // Calcular distancia a cada sucursal
    let nearest = branchesWithCoords[0];
    let minDistance = haversineDistance(coords.lat, coords.lng, nearest.latitude!, nearest.longitude!);

    for (let i = 1; i < branchesWithCoords.length; i++) {
      const branch = branchesWithCoords[i];
      const distance = haversineDistance(coords.lat, coords.lng, branch.latitude!, branch.longitude!);
      console.log(`  📏 Distancia a ${branch.name}: ${distance.toFixed(1)} km`);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = branch;
      }
    }

    console.log(`✅ Sucursal más cercana: ${nearest.name} (${minDistance.toFixed(1)} km)`);
    return { id: nearest.id, name: nearest.name };
  } catch (error) {
    console.error('Error buscando sucursal más cercana:', error);
    return null;
  }
}

// Fallback: buscar sucursal por estado (si la geocodificación falla)
async function findBranchByState(state: string): Promise<{ id: string; name: string } | null> {
  try {
    const { data: branches, error } = await supabase
      .from('branches')
      .select('id, name, state')
      .eq('active', true)
      .ilike('state', `%${state}%`)
      .limit(1);

    if (!error && branches && branches.length > 0) {
      console.log(`🔍 Sucursal encontrada por estado "${state}": ${branches[0].name}`);
      return { id: branches[0].id, name: branches[0].name };
    }
    return null;
  } catch {
    return null;
  }
}

// ===== FIN GEOCODIFICACIÓN =====

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

    // ===== DETERMINAR SUCURSAL MÁS CERCANA =====
    let assignedBranch: { id: string; name: string } | null = null;

    if (data.city && data.state) {
      // Intentar geocodificación
      const coords = await geocodeLocation(data.city, data.state);
      if (coords) {
        assignedBranch = await findNearestBranch(coords);
      }

      // Fallback: buscar por estado si no se encontró por coordenadas
      if (!assignedBranch && data.state) {
        assignedBranch = await findBranchByState(data.state);
      }
    }

    // Fallback final: primera sucursal activa
    if (!assignedBranch) {
      const { data: defaultBranch } = await supabase
        .from('branches')
        .select('id, name')
        .eq('active', true)
        .limit(1)
        .single();

      if (defaultBranch) {
        assignedBranch = { id: defaultBranch.id, name: defaultBranch.name };
        console.log(`⚠️ Sin ubicación del lead, asignando sucursal por defecto: ${defaultBranch.name}`);
      }
    }
    // ===== FIN DETERMINACIÓN DE SUCURSAL =====

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
      assigned_agent_id: null,
      branch_id: assignedBranch?.id || null,
      lead_city: data.city?.trim() || null,
      lead_state: data.state?.trim() || null
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

    // ===== ASIGNACIÓN AUTOMÁTICA ROUND ROBIN (FILTRADO POR SUCURSAL) =====
    let assignedAgent = null;
    let metaResponse = null;
    let metaHttpCode = 0;
    let metaError = null;

    try {
      // Paso 1: Buscar agentes activos de la sucursal asignada
      let agentQuery = supabase
        .from('sales_agents')
        .select('id, name, email, phone, total_leads_assigned')
        .eq('status', 'active')
        .order('total_leads_assigned', { ascending: true });

      // Filtrar por sucursal si se determinó una
      if (assignedBranch) {
        agentQuery = agentQuery.eq('branch_id', assignedBranch.id);
      }

      const { data: branchAgents, error: agentsError } = await agentQuery.limit(1);

      // Paso 2: Si no hay agentes en la sucursal, fallback a round-robin global
      let activeAgents = branchAgents;
      let usedFallback = false;

      if ((!branchAgents || branchAgents.length === 0) && assignedBranch) {
        console.log(`⚠️ No hay agentes activos en sucursal ${assignedBranch.name}, usando round-robin global`);
        const { data: globalAgents, error: globalError } = await supabase
          .from('sales_agents')
          .select('id, name, email, phone, total_leads_assigned')
          .eq('status', 'active')
          .order('total_leads_assigned', { ascending: true })
          .limit(1);

        if (!globalError && globalAgents) {
          activeAgents = globalAgents;
          usedFallback = true;
        }
      }

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
          const branchNote = assignedBranch
            ? ` - Sucursal: ${assignedBranch.name}${usedFallback ? ' (fallback global)' : ''}`
            : '';
          await supabase
            .from('lead_assignments')
            .insert([{
              lead_id: insertedLead.id,
              agent_id: assignedAgent.id,
              assigned_at: new Date().toISOString(),
              status: 'active',
              notes: `Asignación automática vía Round Robin - Score inicial: ${initialScore} (${initialStatus})${branchNote}`
            }]);

          console.log(`Lead ${insertedLead.id} asignado a agente ${assignedAgent.name} (${assignedAgent.id}) en sucursal ${assignedBranch?.name || 'N/A'}`);

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
                        { type: 'text', text: insertedLead.name || 'Cliente' },                    // {{1}} nombre del lead
                        { type: 'text', text: insertedLead.phone || 'N/A' },                       // {{2}} teléfono del lead
                        { type: 'text', text: insertedLead.model_interested || 'Interés General' } // {{3}} modelo de interés
                      ]
                    }
                  ]
                }
              };

              const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(notificationBody)
              });

              metaHttpCode = response.status;
              metaResponse = await response.json();
              console.log(`✅ WhatsApp sent to agent ${assignedAgent.name} - Status: ${response.status}`);
            } catch (waError) {
              console.error('❌ Failed to send WhatsApp to agent:', waError);
              metaError = waError instanceof Error ? waError.message : 'Unknown error';
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
        assigned_agent_name: assignedAgent?.name || null,
        branch_id: assignedBranch?.id || null,
        branch_name: assignedBranch?.name || null
      },
      message: assignedAgent
        ? `Lead "${insertedLead.name}" creado exitosamente con score ${insertedLead.score} (${initialStatus}), asignado a ${assignedAgent.name} en sucursal ${assignedBranch?.name || 'N/A'}`
        : `Lead "${insertedLead.name}" creado exitosamente con score ${insertedLead.score} (${initialStatus}) - Sin agentes disponibles para asignar`,
      whatsapp_debug: {
        attempted: !!assignedAgent,
        agent_phone: assignedAgent?.phone || 'N/A',
        has_credentials: !!(process.env.PHONE_NUMBER_ID && process.env.META_ACCESS_TOKEN),
        meta_http_code: metaHttpCode,
        meta_response: metaResponse,
        meta_error: metaError
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
