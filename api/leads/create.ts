import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createLead, CreateLeadRequest } from '../../src/api/leads';

/**
 * API Endpoint: POST /api/leads/create
 * 
 * Endpoint para crear un nuevo lead desde ManyChat o cualquier integración externa
 * 
 * @example
 * POST https://tu-app.vercel.app/api/leads/create
 * Headers: 
 *   Content-Type: application/json
 *   X-API-Key: tu-api-key-secreta (opcional, para seguridad adicional)
 * 
 * Body:
 * {
 *   "name": "Juan Pérez",
 *   "phone": "5551234567",
 *   "email": "juan@email.com",
 *   "origin": "Chatbot WA",
 *   "model_interested": "MT-07",
 *   "timeframe": "Inmediato"
 * }
 * 
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "lead_id": "uuid-here",
 *     "name": "Juan Pérez",
 *     "score": 75,
 *     "status": "Amarillo"
 *   },
 *   "message": "Lead creado exitosamente"
 * }
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Configurar CORS para permitir solicitudes desde ManyChat
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  // Manejar preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método no permitido',
      message: 'Solo se permite el método POST'
    });
  }

  try {
    // Opcional: Validar API Key para seguridad adicional
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.API_KEY; // Configurar en Vercel
    
    if (validApiKey && apiKey !== validApiKey) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado',
        message: 'API Key inválida'
      });
    }

    // Obtener los datos del body
    const leadData: CreateLeadRequest = req.body;

    // Validar que haya datos
    if (!leadData || typeof leadData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        message: 'El body debe contener los datos del lead en formato JSON'
      });
    }

    // Crear el lead
    const result = await createLead(leadData);

    // Retornar respuesta según el resultado
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