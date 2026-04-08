import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Crear cliente de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface CatalogResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

/**
 * Normalizar nombre del modelo para búsqueda flexible
 */
function normalizeModelName(input: string): string {
  return input
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '');
}

/**
 * Formatear precio en formato mexicano
 */
function formatPrice(price: number): string {
  return `$${price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
}

/**
 * Obtener información del modelo
 */
async function getModelInfo(modelName: string): Promise<CatalogResponse> {
  try {
    const normalizedModel = normalizeModelName(modelName);

    // Intentar búsqueda exacta primero
    let { data: model, error } = await supabase
      .from('catalog')
      .select('*')
      .eq('active', true)
      .ilike('model', normalizedModel)
      .maybeSingle();

    // Si no encuentra, intentar búsqueda con LIKE para coincidencias parciales
    if (error || !model) {
      const { data: models } = await supabase
        .from('catalog')
        .select('*')
        .eq('active', true)
        .or(`model.ilike.%${normalizedModel}%,model.ilike.%${modelName}%`);

      if (!models || models.length === 0) {
        return {
          success: false,
          error: 'Modelo no encontrado',
          message: `No se encontró el modelo "${modelName}" en el catálogo activo. Verifica el nombre del modelo.`
        };
      }

      // Tomar el primer resultado
      model = models[0];
    }

    return {
      success: true,
      data: {
        id: model.id,
        model: model.model,
        segment: model.segment,
        price_cash: model.price_cash,
        price_formatted: formatPrice(model.price_cash),
        stock: model.stock,
        stock_status: model.stock > 3 ? 'Disponible' : model.stock > 0 ? 'Últimas unidades' : 'Agotado',
        test_drive_available: model.test_drive_available,
        year: model.year,
        color_options: model.color_options || [],
        engine_cc: model.engine_cc,
        engine_type: model.engine_type,
        max_power: model.max_power,
        max_torque: model.max_torque,
        transmission: model.transmission,
        fuel_capacity: model.fuel_capacity,
        weight: model.weight,
        seat_height: model.seat_height,
        abs: model.abs,
        traction_control: model.traction_control,
        riding_modes: model.riding_modes || [],
        description: model.description,
        key_features: model.key_features || [],
        image_url: model.image_url,
        brochure_url: model.brochure_url
      }
    };
  } catch (error) {
    console.error('Error al obtener modelo:', error);
    return {
      success: false,
      error: 'Error al consultar el catálogo',
      message: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Listar todos los modelos disponibles
 */
async function listAllModels(filters: any): Promise<CatalogResponse> {
  try {
    let query = supabase
      .from('catalog')
      .select('*')
      .eq('active', true);

    // Aplicar filtros
    if (filters.segment) {
      query = query.eq('segment', filters.segment);
    }

    if (filters.min_price) {
      query = query.gte('price_cash', parseFloat(filters.min_price));
    }

    if (filters.max_price) {
      query = query.lte('price_cash', parseFloat(filters.max_price));
    }

    if (filters.test_drive === 'true') {
      query = query.eq('test_drive_available', true);
    }

    // Ordenar
    query = query.order('segment').order('price_cash');

    const { data: models, error } = await query;

    if (error) {
      return {
        success: false,
        error: 'Error al obtener el catálogo',
        message: error.message
      };
    }

    if (!models || models.length === 0) {
      return {
        success: true,
        data: {
          count: 0,
          models: [],
          message: 'No hay modelos disponibles con los filtros especificados'
        }
      };
    }

    // Formatear datos
    const formattedModels = models.map(model => ({
      id: model.id,
      model: model.model,
      segment: model.segment,
      price_cash: model.price_cash,
      price_formatted: formatPrice(model.price_cash),
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

    // Estadísticas
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

    return {
      success: true,
      data: {
        count: formattedModels.length,
        stats,
        models: formattedModels
      }
    };
  } catch (error) {
    console.error('Error al listar modelos:', error);
    return {
      success: false,
      error: 'Error al listar modelos',
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
    // Validar API Key (opcional)
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.API_KEY;
    
    if (validApiKey && apiKey !== validApiKey) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado',
        message: 'API Key inválida'
      });
    }

    const { model, segment, min_price, max_price, test_drive } = req.query;

    // Si se proporciona modelo, buscar ese modelo específico
    if (model && typeof model === 'string') {
      const result = await getModelInfo(model);
      
      if (result.success) {
        // Retornar datos directamente en el primer nivel para facilitar mapping en ManyChat
        return res.status(200).json({
          success: true,
          ...result.data // Spread los datos al primer nivel
        });
      } else {
        return res.status(404).json(result);
      }
    }

    // Si no, listar todos los modelos con filtros opcionales
    const filters = { segment, min_price, max_price, test_drive };
    const result = await listAllModels(filters);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }

  } catch (error) {
    console.error('Error en /api/catalog/query:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}