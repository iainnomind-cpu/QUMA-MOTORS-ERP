import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ScoredModel {
  model: any;
  score: number;
  reasons: string[];
}

function formatPrice(price: number): string {
  return `$${price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
}

function extractTokens(text: string): string[] {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
}

function extractYear(text: string): number | null {
  const yearMatch = text.match(/\b(20\d{2})\b/);
  return yearMatch ? parseInt(yearMatch[1]) : null;
}

function calculateTokenSimilarity(searchTokens: string[], modelTokens: string[]): number {
  let matchCount = 0;
  let score = 0;

  for (const searchToken of searchTokens) {
    if (modelTokens.includes(searchToken)) {
      matchCount++;
      score += 15;
    } else {
      const partialMatch = modelTokens.some(modelToken => 
        modelToken.includes(searchToken) || searchToken.includes(modelToken)
      );
      if (partialMatch) {
        matchCount++;
        score += 8;
      }
    }
  }

  if (matchCount === searchTokens.length && searchTokens.length > 0) {
    score += 10;
  }

  return score;
}

function scoreModel(model: any, searchQuery: string): ScoredModel {
  let score = 0;
  const reasons: string[] = [];
  
  const searchTokens = extractTokens(searchQuery);
  const modelTokens = extractTokens(model.model);
  const searchYear = extractYear(searchQuery);

  const tokenScore = calculateTokenSimilarity(searchTokens, modelTokens);
  score += tokenScore;
  if (tokenScore > 30) {
    reasons.push(`Match fuerte de palabras clave (${tokenScore} pts)`);
  } else if (tokenScore > 15) {
    reasons.push(`Match medio de palabras clave (${tokenScore} pts)`);
  } else if (tokenScore > 0) {
    reasons.push(`Match débil de palabras clave (${tokenScore} pts)`);
  }

  if (model.stock > 0) {
    if (model.stock > 3) {
      score += 30;
      reasons.push(`Stock disponible: ${model.stock} unidades (+30 pts)`);
    } else {
      score += 20;
      reasons.push(`Stock limitado: ${model.stock} unidades (+20 pts)`);
    }
  } else {
    reasons.push('Sin stock (-0 pts)');
  }

  if (model.year) {
    const currentYear = new Date().getFullYear();
    const yearDiff = currentYear - model.year;

    if (searchYear) {
      if (model.year === searchYear) {
        score += 50;
        reasons.push(`Año exacto solicitado: ${model.year} (+50 pts BONUS)`);
      } else {
        const yearDistance = Math.abs(model.year - searchYear);
        if (yearDistance === 1) {
          score += 10;
          reasons.push(`Año cercano al solicitado: ${model.year} (+10 pts)`);
        }
      }
    } else {
      if (yearDiff === 0) {
        score += 20;
        reasons.push(`Modelo del año actual: ${model.year} (+20 pts)`);
      } else if (yearDiff === 1) {
        score += 15;
        reasons.push(`Modelo del año pasado: ${model.year} (+15 pts)`);
      } else if (yearDiff === 2) {
        score += 10;
        reasons.push(`Modelo de hace 2 años: ${model.year} (+10 pts)`);
      } else if (yearDiff > 2) {
        score += 5;
        reasons.push(`Modelo antiguo: ${model.year} (+5 pts)`);
      }
    }
  }

  if (model.test_drive_available) {
    score += 5;
    reasons.push('Prueba de manejo disponible (+5 pts)');
  }

  if (!model.active) {
    score = 0;
    reasons.push('Modelo inactivo (descartado)');
  }

  return {
    model,
    score,
    reasons
  };
}

function getMatchConfidence(score: number): string {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

async function smartSearch(searchQuery: string) {
  try {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return {
        success: false,
        error: 'Consulta vacía',
        message: 'Debe proporcionar un término de búsqueda'
      };
    }

    const { data: models, error } = await supabase
      .from('catalog')
      .select('*')
      .eq('active', true);

    if (error) {
      return {
        success: false,
        error: 'Error al consultar catálogo',
        message: error.message
      };
    }

    if (!models || models.length === 0) {
      return {
        success: false,
        error: 'Catálogo vacío',
        message: 'No hay modelos disponibles en el catálogo'
      };
    }

    const scoredModels: ScoredModel[] = models.map(model => 
      scoreModel(model, searchQuery)
    );

    scoredModels.sort((a, b) => b.score - a.score);

    const bestMatch = scoredModels[0];

    if (bestMatch.score < 15) {
      return {
        success: false,
        error: 'No se encontró coincidencia',
        message: `No se encontró un modelo que coincida con "${searchQuery}". Intenta con otro término de búsqueda.`,
        suggestion: 'Verifica el nombre del modelo o busca por categoría (Scooter, Deportiva, etc.)'
      };
    }

    const alternativeModelsCount = scoredModels.filter(
      (sm, index) => index > 0 && sm.score > 30
    ).length;

    const model = bestMatch.model;
    
    return {
      success: true,
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
      brochure_url: model.brochure_url,
      match_score: bestMatch.score,
      match_confidence: getMatchConfidence(bestMatch.score),
      match_reasons: bestMatch.reasons.join(' | '),
      alternative_models_available: alternativeModelsCount,
      search_query: searchQuery
    };

  } catch (error) {
    console.error('Error en smart search:', error);
    return {
      success: false,
      error: 'Error en búsqueda',
      message: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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

    if (!model || typeof model !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Parámetro requerido',
        message: 'Debe proporcionar el parámetro "model" con el término de búsqueda'
      });
    }

    const result = await smartSearch(model);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(404).json(result);
    }

  } catch (error) {
    console.error('Error en /api/catalog/smart-search:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}