import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getLeadById, updateLead } from './lib';
/**
 * API Endpoint: GET /api/leads/[id] o PUT /api/leads/[id]
 * 
 * Obtiene o actualiza información de un lead específico
 * 
 * @example GET
 * GET https://tu-app.vercel.app/api/leads/uuid-del-lead
 * 
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "lead_id": "uuid-here",
 *     "name": "Juan Pérez",
 *     "score": 75,
 *     "status": "Amarillo"
 *   }
 * }
 * 
 * @example PUT
 * PUT https://tu-app.vercel.app/api/leads/uuid-del-lead
 * Body:
 * {
 *   "phone": "5559876543",
 *   "timeframe": "Inmediato"
 * }
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  // Manejar preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Obtener el ID del lead de la URL
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'ID inválido',
      message: 'Debe proporcionar un ID de lead válido'
    });
  }

  try {
    // Opcional: Validar API Key
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

    // Método no permitido
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