import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Crear cliente de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface CatalogResponse {
  success: boolean;
  data?: {
    id: string;
    model: string;
    segment: string;
    price_cash: number;
    price_formatted: string;
    stock: number;
    test_drive_available: boolean;
    year: number;
    color_options: string[];
    engine_cc: number | null;
    engine_type: string | null;
    max_power: string | null;
    max_torque: string | null;
    transmission: string | null;
    fuel_capacity: number | null;
    weight: number | null;
    seat_height: number | null;
    abs: boolean;
    traction_control: boolean;
    riding_modes: string[];
    description: string | null;
    key_features: string[];
    image_url: string | null;
    brochure_url: string | null;
  };
  error?: string;
  message?: string;
}

/**
 * Normalizar nombre del modelo para búsqueda flexible
 * Ejemplos: "mt-07" -> "MT-07", "mt07" -> "MT-07", "yzfr3" -> "YZF-R3"
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
      .single();

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
async function listAllModels(): Promise<CatalogResponse[]> {
  try {
    const { data: models, error } = await supabase
      .from('catalog')
      .select('model, segment, price_cash, stock, test_drive_available')
      .eq('active', true)
      .order('segment')
      .order('price_cash');

    if (error || !models) {
      return [{
        success: false,
        error: 'Error al listar modelos',
        message: 'No se pudieron obtener los modelos del catálogo'
      }];
    }

    return models.map(model => ({
      success: true,
      data: {
        id: '',
        model: model.model,
        segment: model.segment,
        price_cash: model.price_cash,
        price_formatted: formatPrice(model.price_cash),
        stock: model.stock,
        test_drive_available: model.test_drive_available,
        year: 0,
        color_options: [],
        engine_cc: null,
        engine_type: null,
        max_power: null,
        max_torque: null,
        transmission: null,
        fuel_capacity: null,
        weight: null,
        seat_height: null,
        abs: false,
        traction_control: false,
        riding_modes: [],
        description: null,
        key_features: [],
        image_url: null,
        brochure_url: null
      }
    }));
  } catch (error) {
    console.error('Error al listar modelos:', error);
    return [{
      success: false,
      error: 'Error al listar modelos',
      message: error instanceof Error ? error.message : 'Error desconocido'
    }];
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

    const { model } = req.query;

    // Si no se proporciona modelo, listar todos
    if (!model || typeof model !== 'string') {
      const models = await listAllModels();
      return res.status(200).json({
        success: true,
        count: models.length,
        models: models.map(m => m.data)
      });
    }

    // Buscar modelo específico
    const result = await getModelInfo(model);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(404).json(result);
    }

  } catch (error) {
    console.error('Error en /api/catalog/[model]:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}