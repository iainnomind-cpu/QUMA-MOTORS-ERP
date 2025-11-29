import { supabase } from '../lib/supabase';

// Tipos para la solicitud del chatbot
export interface CreateLeadRequest {
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
  // Campos adicionales de ManyChat
  manychat_user_id?: string;
  manychat_conversation_id?: string;
  metadata?: Record<string, any>;
}

export interface CreateLeadResponse {
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

/**
 * Valida los datos del lead antes de insertarlos
 */
function validateLeadData(data: CreateLeadRequest): { valid: boolean; error?: string } {
  // Validación de nombre (requerido)
  if (!data.name || data.name.trim().length === 0) {
    return { valid: false, error: 'El nombre es requerido' };
  }

  // Validación de origen (requerido)
  if (!data.origin || data.origin.trim().length === 0) {
    return { valid: false, error: 'El origen es requerido' };
  }

  // Validación de email (si se proporciona)
  if (data.email && data.email.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return { valid: false, error: 'El formato del email es inválido' };
    }
  }

  // Validación de teléfono (si se proporciona)
  if (data.phone && data.phone.trim().length > 0) {
    // Remover espacios y caracteres no numéricos
    const cleanPhone = data.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return { valid: false, error: 'El teléfono debe tener al menos 10 dígitos' };
    }
  }

  return { valid: true };
}

/**
 * Calcula el score inicial basado en los datos del lead
 */
function calculateInitialScore(data: CreateLeadRequest): number {
  let score = 45; // Score base

  // +10 puntos si tiene email
  if (data.email && data.email.trim().length > 0) {
    score += 10;
  }

  // +10 puntos si tiene teléfono
  if (data.phone && data.phone.trim().length > 0) {
    score += 10;
  }

  // +15 puntos si tiene modelo de interés
  if (data.model_interested && data.model_interested.trim().length > 0) {
    score += 15;
  }

  // Puntos según timeframe
  if (data.timeframe) {
    switch (data.timeframe.toLowerCase()) {
      case 'inmediato':
        score += 20;
        break;
      case 'pronto':
        score += 10;
        break;
      case 'futuro':
        score += 5;
        break;
    }
  }

  // +10 puntos si requiere financiamiento
  if (data.requires_financing) {
    score += 10;
  }

  // +5 puntos si solicitó prueba de manejo
  if (data.test_drive_requested) {
    score += 5;
  }

  return Math.min(score, 100); // Máximo 100 puntos
}

/**
 * Determina el status inicial basado en el score
 */
function calculateInitialStatus(score: number): string {
  if (score >= 80) return 'Verde';
  if (score >= 60) return 'Amarillo';
  return 'Rojo';
}

/**
 * Crea un nuevo lead en la base de datos
 */
export async function createLead(data: CreateLeadRequest): Promise<CreateLeadResponse> {
  try {
    // 1. Validar los datos
    const validation = validateLeadData(data);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        message: validation.error
      };
    }

    // 2. Calcular score y status inicial
    const initialScore = calculateInitialScore(data);
    const initialStatus = calculateInitialStatus(initialScore);

    // 3. Preparar los datos para insertar
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

    // 4. Insertar el lead en la base de datos
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

    // 5. Crear interacción inicial
    const { error: interactionError } = await supabase
      .from('lead_interactions')
      .insert([{
        lead_id: insertedLead.id,
        interaction_type: 'note',
        channel: data.origin === 'Chatbot WA' ? 'WhatsApp' : 'System',
        message: `Lead registrado desde ${data.origin}${data.manychat_user_id ? ` - ManyChat ID: ${data.manychat_user_id}` : ''}`,
        direction: 'inbound',
        agent_id: null
      }]);

    if (interactionError) {
      console.error('Error al crear interacción:', interactionError);
      // No falla la operación principal si falla la interacción
    }

    // 6. Si solicitó prueba de manejo, crear la cita
    if (data.test_drive_requested && data.test_drive_date && data.model_interested) {
      const { data: catalogItem } = await supabase
        .from('catalog')
        .select('id')
        .eq('model', data.model_interested)
        .eq('active', true)
        .maybeSingle();

      const { error: appointmentError } = await supabase
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

      if (appointmentError) {
        console.error('Error al crear cita de prueba de manejo:', appointmentError);
        // No falla la operación principal
      }
    }

    // 7. Retornar respuesta exitosa
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

/**
 * Obtiene un lead por su ID
 */
export async function getLeadById(leadId: string): Promise<CreateLeadResponse> {
  try {
    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (error || !lead) {
      return {
        success: false,
        error: 'Lead no encontrado',
        message: 'No se encontró un lead con ese ID'
      };
    }

    return {
      success: true,
      data: {
        lead_id: lead.id,
        name: lead.name,
        score: lead.score,
        status: lead.status
      }
    };
  } catch (error) {
    console.error('Error al obtener lead:', error);
    return {
      success: false,
      error: 'Error al obtener el lead',
      message: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Actualiza un lead existente
 */
export async function updateLead(
  leadId: string,
  data: Partial<CreateLeadRequest>
): Promise<CreateLeadResponse> {
  try {
    const { data: updatedLead, error } = await supabase
      .from('leads')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .select()
      .single();

    if (error || !updatedLead) {
      return {
        success: false,
        error: 'Error al actualizar el lead',
        message: error?.message || 'Lead no encontrado'
      };
    }

    return {
      success: true,
      data: {
        lead_id: updatedLead.id,
        name: updatedLead.name,
        score: updatedLead.score,
        status: updatedLead.status
      },
      message: 'Lead actualizado exitosamente'
    };
  } catch (error) {
    console.error('Error al actualizar lead:', error);
    return {
      success: false,
      error: 'Error inesperado al actualizar',
      message: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}