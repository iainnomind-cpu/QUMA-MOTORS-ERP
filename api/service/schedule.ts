import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Crear cliente de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ScheduleServiceRequest {
  client_name: string;
  client_phone: string;
  client_email?: string;
  appointment_date: string;
  service_type: 'preventivo' | 'correctivo' | 'garantia' | 'diagnostico';
  vehicle_model?: string;
  vehicle_plate?: string;
  mileage?: number;
  services_requested?: string[];
  notes?: string;
  technician_id?: string;
  estimated_duration_minutes?: number;
}

interface ScheduleServiceResponse {
  success: boolean;
  appointment_id?: string;
  client_name?: string;
  appointment_date?: string;
  appointment_date_formatted?: string;
  service_type?: string;
  service_type_formatted?: string;
  technician_name?: string;
  vehicle_model?: string;
  vehicle_plate?: string;
  services_requested?: string;
  estimated_duration_minutes?: number;
  status?: string;
  confirmation_message?: string;
  error?: string;
  message?: string;
}

/**
 * Formatear tipo de servicio
 */
function formatServiceType(type: string): string {
  const types: Record<string, string> = {
    'preventivo': 'Mantenimiento Preventivo',
    'correctivo': 'Mantenimiento Correctivo',
    'garantia': 'Servicio de Garantía',
    'diagnostico': 'Diagnóstico'
  };
  return types[type] || type;
}

/**
 * Formatear fecha en español
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Buscar o crear cliente
 */
async function findOrCreateClient(
  name: string,
  phone: string,
  email?: string
): Promise<{ id: string; name: string; phone: string | null }> {
  // Buscar cliente existente por teléfono
  const { data: existingClient } = await supabase
    .from('clients')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (existingClient) {
    return existingClient;
  }

  // Crear nuevo cliente
  const { data: newClient, error } = await supabase
    .from('clients')
    .insert([{
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      status: 'active',
      created_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (error || !newClient) {
    throw new Error('Error al crear cliente');
  }

  return newClient;
}

/**
 * Asignar técnico disponible
 */
async function assignAvailableTechnician(
  appointmentDate: string,
  technicianId?: string
): Promise<{ id: string; name: string } | null> {
  // Si se especificó un técnico, verificar que esté disponible
  if (technicianId) {
    const { data: technician } = await supabase
      .from('service_technicians')
      .select('*')
      .eq('id', technicianId)
      .eq('status', 'active')
      .maybeSingle();

    if (technician) {
      return { id: technician.id, name: technician.name };
    }
  }

  // Buscar técnico disponible
  const { data: technicians } = await supabase
    .from('service_technicians')
    .select('*')
    .eq('status', 'active')
    .order('name');

  if (!technicians || technicians.length === 0) {
    return null;
  }

  // Por simplicidad, asignar el primer técnico disponible
  // En producción, aquí verificarías disponibilidad por horario
  return { id: technicians[0].id, name: technicians[0].name };
}

/**
 * Agendar servicio técnico
 */
async function scheduleService(
  request: ScheduleServiceRequest
): Promise<ScheduleServiceResponse> {
  try {
    // Validaciones
    if (!request.client_name || request.client_name.trim().length === 0) {
      return {
        success: false,
        error: 'Nombre del cliente es requerido',
        message: 'Debe proporcionar el nombre del cliente'
      };
    }

    if (!request.client_phone || request.client_phone.trim().length < 10) {
      return {
        success: false,
        error: 'Teléfono inválido',
        message: 'Debe proporcionar un teléfono válido (mínimo 10 dígitos)'
      };
    }

    if (!request.appointment_date) {
      return {
        success: false,
        error: 'Fecha de cita requerida',
        message: 'Debe proporcionar la fecha y hora de la cita'
      };
    }

    // Validar fecha (no puede ser en el pasado)
    const appointmentDate = new Date(request.appointment_date);
    const now = new Date();
    if (appointmentDate < now) {
      return {
        success: false,
        error: 'Fecha inválida',
        message: 'La fecha de la cita no puede ser en el pasado'
      };
    }

    // Validar tipo de servicio
    const validServiceTypes = ['preventivo', 'correctivo', 'garantia', 'diagnostico'];
    if (!validServiceTypes.includes(request.service_type)) {
      return {
        success: false,
        error: 'Tipo de servicio inválido',
        message: `El tipo de servicio debe ser uno de: ${validServiceTypes.join(', ')}`
      };
    }

    // 1. Buscar o crear cliente
    const client = await findOrCreateClient(
      request.client_name,
      request.client_phone,
      request.client_email
    );

    // 2. Asignar técnico
    const technician = await assignAvailableTechnician(
      request.appointment_date,
      request.technician_id
    );

    if (!technician) {
      return {
        success: false,
        error: 'No hay técnicos disponibles',
        message: 'No hay técnicos disponibles en este momento. Por favor, contacte a la agencia.'
      };
    }

    // 3. Crear cita de servicio
    const appointmentData = {
      client_id: client.id,
      client_name: client.name,
      client_phone: client.phone,
      technician_id: technician.id,
      technician_name: technician.name,
      appointment_date: request.appointment_date,
      service_type: request.service_type,
      estimated_duration_minutes: request.estimated_duration_minutes || 120,
      vehicle_model: request.vehicle_model?.trim() || null,
      vehicle_plate: request.vehicle_plate?.trim() || null,
      mileage: request.mileage || null,
      services_requested: request.services_requested || [],
      notes: request.notes?.trim() || null,
      status: 'scheduled',
      labor_cost: 0,
      parts_cost: 0,
      total_cost: 0,
      services_performed: [],
      parts_used: []
    };

    const { data: appointment, error } = await supabase
      .from('service_appointments')
      .insert([appointmentData])
      .select()
      .single();

    if (error || !appointment) {
      console.error('Error al crear cita:', error);
      return {
        success: false,
        error: 'Error al agendar servicio',
        message: error?.message || 'Error desconocido al crear la cita'
      };
    }

    // 4. Preparar respuesta
    const servicesText = request.services_requested && request.services_requested.length > 0
      ? request.services_requested.join(', ')
      : 'Servicios generales';

    const confirmationMessage = `✅ Servicio agendado exitosamente\n\n` +
      `📋 Tipo: ${formatServiceType(request.service_type)}\n` +
      `📅 Fecha: ${formatDate(request.appointment_date)}\n` +
      `👤 Técnico: ${technician.name}\n` +
      `🔧 Servicios: ${servicesText}\n\n` +
      `Recibirás una confirmación por WhatsApp. ¡Te esperamos!`;

    return {
      success: true,
      appointment_id: appointment.id,
      client_name: client.name,
      appointment_date: request.appointment_date,
      appointment_date_formatted: formatDate(request.appointment_date),
      service_type: request.service_type,
      service_type_formatted: formatServiceType(request.service_type),
      technician_name: technician.name,
      vehicle_model: request.vehicle_model || '',
      vehicle_plate: request.vehicle_plate || '',
      services_requested: servicesText,
      estimated_duration_minutes: request.estimated_duration_minutes || 120,
      status: 'scheduled',
      confirmation_message: confirmationMessage
    };

  } catch (error) {
    console.error('Error al agendar servicio:', error);
    return {
      success: false,
      error: 'Error al agendar servicio',
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

    const serviceData: ScheduleServiceRequest = req.body;

    if (!serviceData || typeof serviceData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        message: 'El body debe contener los datos del servicio en formato JSON'
      });
    }

    const result = await scheduleService(serviceData);

    if (result.success) {
      // Retornar en formato plano para ManyChat
      return res.status(201).json({
        success: true,
        ...result
      });
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error en /api/service/schedule:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}