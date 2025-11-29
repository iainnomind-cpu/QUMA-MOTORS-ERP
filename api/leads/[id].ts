import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Crear cliente de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface LeadResponse {
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

// Obtener lead por ID
async function getLeadById(leadId: string): Promise<LeadResponse> {
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

// Actualizar lead
async function updateLead(
  leadId: string,
  data: Record<string, any>
): Promise<LeadResponse> {
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

// Handler principal
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'ID inválido',
      message: 'Debe proporcionar un ID de lead válido'
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

    // GET - Obtener lead
    if (req.method === 'GET') {
      const result = await getLeadById(id);
      
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(404).json(result);
      }
    }

    // PUT - Actualizar lead
    if (req.method === 'PUT') {
      const updateData = req.body;
      
      if (!updateData || typeof updateData !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Datos inválidos',
          message: 'El body debe contener los datos a actualizar en formato JSON'
        });
      }

      const result = await updateLead(id, updateData);
      
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    }

    return res.status(405).json({
      success: false,
      error: 'Método no permitido',
      message: 'Solo se permiten los métodos GET y PUT'
    });

  } catch (error) {
    console.error('Error en /api/leads/[id]:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}