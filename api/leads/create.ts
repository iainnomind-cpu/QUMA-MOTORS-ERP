import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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
  };
  error?: string;
  message?: string;
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

  if (data.email && data.email.trim().length > 0) score += 10;
  if (data.phone && data.phone.trim().length > 0) score += 10;
  if (data.model_interested && data.model_interested.trim().length > 0) score += 15;

  if (data.timeframe) {
    switch (data.timeframe.toLowerCase()) {
      case 'inmediato': score += 20; break;
      case 'pronto': score += 10; break;
      case 'futuro': score += 5; break;
    }
  }

  if (data.requires_financing) score += 10;
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

    const leadData = {
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      origin: data.origin,
      model_interested: data.model_interested?.trim() || null,
      timeframe: data.timeframe || null,
      financing_type: data.financing_type || null,
      birthday: data.birthday || null,
      test_drive_requested: data.test_drive_requested || false,
      test_drive_date: data.test_drive_date || null,
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

    // Crear interacción inicial
    await supabase
      .from('lead_interactions')
      .insert([{
        lead_id: insertedLead.id,
        interaction_type: 'note',
        channel: data.origin === 'Chatbot WA' ? 'WhatsApp' : 'System',
        message: `Lead registrado desde ${data.origin}${data.manychat_user_id ? ` - ManyChat ID: ${data.manychat_user_id}` : ''}`,
        direction: 'inbound',
        agent_id: null
      }]);

    // Si solicitó prueba de manejo
    if (data.test_drive_requested && data.test_drive_date && data.model_interested) {
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
          appointment_date: data.test_drive_date,
          duration_minutes: 30,
          status: 'scheduled',
          pickup_location: 'agencia',
          notes: `Prueba de manejo programada desde ${data.origin}`
        }]);
    }

    return {
      success: true,
      data: {
        lead_id: insertedLead.id,
        name: insertedLead.name,
        score: insertedLead.score,
        status: insertedLead.status
      },
      message: `Lead "${insertedLead.name}" creado exitosamente con score ${insertedLead.score} (${initialStatus})`
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