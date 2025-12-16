import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Crear cliente de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Obtener información de servicios técnicos en formato plano
 */
async function getServiceInfo() {
  try {
    // Obtener técnicos activos
    const { data: technicians, error: techError } = await supabase
      .from('service_technicians')
      .select('*')
      .eq('status', 'active')
      .order('name');

    if (techError) {
      return {
        success: false,
        error: 'Error al obtener técnicos',
        message: techError.message
      };
    }

    // Tipos de servicio disponibles
    const serviceTypes = [
      {
        id: 'preventivo',
        name: 'Mantenimiento Preventivo',
        description: 'Cambio de aceite, filtros, revisión general',
        estimated_duration: 120,
        typical_services: ['Cambio de aceite', 'Revisión de frenos', 'Ajuste de cadena', 'Revisión general']
      },
      {
        id: 'correctivo',
        name: 'Mantenimiento Correctivo',
        description: 'Reparación de fallas o problemas específicos',
        estimated_duration: 180,
        typical_services: ['Reparación de motor', 'Cambio de piezas', 'Solución de fallas']
      },
      {
        id: 'garantia',
        name: 'Servicio de Garantía',
        description: 'Servicio cubierto por garantía del fabricante',
        estimated_duration: 120,
        typical_services: ['Revisión por garantía', 'Reparación cubierta']
      },
      {
        id: 'diagnostico',
        name: 'Diagnóstico',
        description: 'Evaluación y diagnóstico de problemas',
        estimated_duration: 60,
        typical_services: ['Escaneo computarizado', 'Prueba de funcionamiento', 'Diagnóstico de fallas']
      }
    ];

    // Formato plano para ManyChat
    const result: any = {
      success: true,
      technicians_count: technicians?.length || 0,
      service_types_count: serviceTypes.length
    };

    // Agregar técnicos en formato plano
    if (technicians && technicians.length > 0) {
      technicians.forEach((tech, index) => {
        const prefix = `tech_${index + 1}`;
        result[`${prefix}_id`] = tech.id;
        result[`${prefix}_name`] = tech.name;
        result[`${prefix}_phone`] = tech.phone || '';
        result[`${prefix}_email`] = tech.email || '';
        result[`${prefix}_specialties`] = tech.specialties.join(', ') || '';
        result[`${prefix}_working_hours`] = `${tech.working_hours_start} - ${tech.working_hours_end}`;
        result[`${prefix}_max_appointments`] = tech.max_daily_appointments;
      });
    }

    // Agregar tipos de servicio en formato plano
    serviceTypes.forEach((type, index) => {
      const prefix = `service_${index + 1}`;
      result[`${prefix}_id`] = type.id;
      result[`${prefix}_name`] = type.name;
      result[`${prefix}_description`] = type.description;
      result[`${prefix}_duration`] = type.estimated_duration;
      result[`${prefix}_typical_services`] = type.typical_services.join(', ');
    });

    return result;

  } catch (error) {
    console.error('Error al obtener información de servicios:', error);
    return {
      success: false,
      error: 'Error al obtener información',
      message: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Obtener citas de un cliente por teléfono
 */
async function getClientAppointments(phone: string) {
  try {
    if (!phone || phone.trim().length < 10) {
      return {
        success: false,
        error: 'Teléfono inválido',
        message: 'Debe proporcionar un teléfono válido'
      };
    }

    // Buscar cliente
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (!client) {
      return {
        success: true,
        has_appointments: false,
        message: 'No se encontraron citas para este número'
      };
    }

    // Obtener citas del cliente
    const { data: appointments, error } = await supabase
      .from('service_appointments')
      .select('*')
      .eq('client_id', client.id)
      .order('appointment_date', { ascending: false })
      .limit(5);

    if (error || !appointments || appointments.length === 0) {
      return {
        success: true,
        has_appointments: false,
        client_name: client.name,
        message: 'No hay citas registradas'
      };
    }

    // Formato plano
    const result: any = {
      success: true,
      has_appointments: true,
      client_name: client.name,
      client_phone: client.phone,
      appointments_count: appointments.length
    };

    // Agregar citas en formato plano
    appointments.forEach((apt, index) => {
      const prefix = `apt_${index + 1}`;
      result[`${prefix}_id`] = apt.id;
      result[`${prefix}_date`] = apt.appointment_date;
      result[`${prefix}_date_formatted`] = new Date(apt.appointment_date).toLocaleString('es-MX');
      result[`${prefix}_service_type`] = apt.service_type;
      result[`${prefix}_status`] = apt.status;
      result[`${prefix}_technician`] = apt.technician_name || 'Sin asignar';
      result[`${prefix}_vehicle`] = apt.vehicle_model || '';
    });

    return result;

  } catch (error) {
    console.error('Error al obtener citas del cliente:', error);
    return {
      success: false,
      error: 'Error al obtener citas',
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Método no permitido',
      message: 'Solo se permite el método GET'
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

    const { phone } = req.query;

    // Si se proporciona teléfono, buscar citas del cliente
    if (phone && typeof phone === 'string') {
      const result = await getClientAppointments(phone);
      return res.status(200).json(result);
    }

    // Si no, devolver información general
    const result = await getServiceInfo();

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error en /api/service/info:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}