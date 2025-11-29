import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Crear cliente de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

    // Obtener parámetros de filtro (opcionales)
    const { segment, min_price, max_price, test_drive } = req.query;

    let query = supabase
      .from('catalog')
      .select('*')
      .eq('active', true);

    // Aplicar filtros
    if (segment && typeof segment === 'string') {
      query = query.eq('segment', segment);
    }

    if (min_price && typeof min_price === 'string') {
      query = query.gte('price_cash', parseFloat(min_price));
    }

    if (max_price && typeof max_price === 'string') {
      query = query.lte('price_cash', parseFloat(max_price));
    }

    if (test_drive === 'true') {
      query = query.eq('test_drive_available', true);
    }

    // Ordenar por segmento y precio
    query = query.order('segment').order('price_cash');

    const { data: models, error } = await query;

    if (error) {
      console.error('Error al obtener catálogo:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al obtener el catálogo',
        message: error.message
      });
    }

    if (!models || models.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        models: [],
        message: 'No hay modelos disponibles con los filtros especificados'
      });
    }

    // Formatear datos
    const formattedModels = models.map(model => ({
      id: model.id,
      model: model.model,
      segment: model.segment,
      price_cash: model.price_cash,
      price_formatted: `$${model.price_cash.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`,
      stock: model.stock,
      stock_status: model.stock > 3 ? 'Disponible' : model.stock > 0 ? 'Últimas unidades' : 'Agotado',
      test_drive_available: model.test_drive_available,
      year: model.year,
      color_options: model.color_options || [],
      engine_cc: model.engine_cc,
      image_url: model.image_url,
      brochure_url: model.brochure_url,
      description: model.description
    }));

    // Estadísticas del catálogo
    const stats = {
      total_models: formattedModels.length,
      segments: [...new Set(formattedModels.map(m => m.segment))],
      price_range: {
        min: Math.min(...formattedModels.map(m => m.price_cash)),
        max: Math.max(...formattedModels.map(m => m.price_cash)),
        avg: Math.round(formattedModels.reduce((acc, m) => acc + m.price_cash, 0) / formattedModels.length)
      },
      total_stock: formattedModels.reduce((acc, m) => acc + m.stock, 0),
      test_drive_available: formattedModels.filter(m => m.test_drive_available).length
    };

    return res.status(200).json({
      success: true,
      count: formattedModels.length,
      stats,
      models: formattedModels
    });

  } catch (error) {
    console.error('Error en /api/catalog/list:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}