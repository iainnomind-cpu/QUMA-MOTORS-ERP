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

function extractSegmentFromQuery(text: string): string | null {
  const segments = [
    'SCOOTER',
    'DEPORTIVA',
    'NAKED',
    'TOURING',
    'ADVENTURE',
    'DOBLE PROPOSITO',
    'DUAL SPORT',
    'CRUISER',
    'TRAIL',
    'ENDURO',
    'RETRO',
    'CAFE RACER',
    'SPORT',
    'URBAN'
  ];

  const upperText = text.toUpperCase();
  
  for (const segment of segments) {
    if (upperText.includes(segment)) {
      return segment;
    }
  }
  
  return null;
}

function calculateTokenSimilarity(searchTokens: string[], modelTokens: string[]): number {
  let matchCount = 0;
  let score = 0;
  const totalSearchTokens = searchTokens.length;

  for (const searchToken of searchTokens) {
    // Match exacto: peso muy alto
    if (modelTokens.includes(searchToken)) {
      matchCount++;
      score += 40; // Aumentado de 15 a 40
    } else {
      // Match parcial: peso medio
      const partialMatch = modelTokens.some(modelToken => 
        modelToken.includes(searchToken) || searchToken.includes(modelToken)
      );
      if (partialMatch) {
        matchCount++;
        score += 20; // Aumentado de 8 a 20
      }
    }
  }

  // Bonus por porcentaje de coincidencia
  const matchPercentage = totalSearchTokens > 0 ? matchCount / totalSearchTokens : 0;
  
  if (matchPercentage === 1.0 && totalSearchTokens > 0) {
    score += 50; // Aumentado de 10 a 50 - Match perfecto de todas las palabras
  } else if (matchPercentage >= 0.75) {
    score += 30; // Match del 75% o más
  } else if (matchPercentage >= 0.5) {
    score += 15; // Match del 50% o más
  }

  return score;
}

function calculateSegmentMatch(modelSegment: string, searchQuery: string): { score: number; reason: string | null } {
  if (!modelSegment) {
    return { score: 0, reason: null };
  }

  const searchSegment = extractSegmentFromQuery(searchQuery);
  const modelSegmentUpper = modelSegment.toUpperCase();
  const searchQueryUpper = searchQuery.toUpperCase();

  // Si se detectó un segmento específico en la búsqueda
  if (searchSegment) {
    // Match exacto de segmento
    if (modelSegmentUpper.includes(searchSegment) || searchSegment.includes(modelSegmentUpper)) {
      return { 
        score: 100, 
        reason: `Segmento exacto: ${modelSegment} (+100 pts CRÍTICO)` 
      };
    }
    
    // Segmentos similares
    const similarSegments: { [key: string]: string[] } = {
      'DEPORTIVA': ['SPORT', 'SUPERSPORT'],
      'DOBLE PROPOSITO': ['DUAL SPORT', 'ADVENTURE', 'TRAIL', 'ENDURO'],
      'ADVENTURE': ['DOBLE PROPOSITO', 'DUAL SPORT', 'TRAIL', 'TOURING'],
      'NAKED': ['SPORT', 'URBAN', 'RETRO'],
      'CRUISER': ['TOURING', 'RETRO'],
      'SCOOTER': ['URBAN']
    };

    for (const [mainSegment, relatedSegments] of Object.entries(similarSegments)) {
      if (searchSegment.includes(mainSegment) || mainSegment.includes(searchSegment)) {
        if (relatedSegments.some(rel => modelSegmentUpper.includes(rel))) {
          return { 
            score: 40, 
            reason: `Segmento relacionado: ${modelSegment} (+40 pts)` 
          };
        }
      }
    }
    
    // Penalización severa por segmento incompatible
    return { 
      score: -80, 
      reason: `Segmento incompatible: ${modelSegment} vs búsqueda ${searchSegment} (-80 pts PENALIZACIÓN)` 
    };
  }

  // Si no se especificó segmento pero el modelo tiene uno
  // Solo mencionar el segmento sin dar puntos extra
  return { 
    score: 0, 
    reason: `Segmento del modelo: ${modelSegment}` 
  };
}

function scoreModel(model: any, searchQuery: string): ScoredModel {
  let score = 0;
  const reasons: string[] = [];
  
  const searchTokens = extractTokens(searchQuery);
  const modelTokens = extractTokens(model.model);
  const searchYear = extractYear(searchQuery);

  // 1. NOMBRE DEL MODELO - MÁXIMA PRIORIDAD (hasta 130 puntos)
  const tokenScore = calculateTokenSimilarity(searchTokens, modelTokens);
  score += tokenScore;
  if (tokenScore > 80) {
    reasons.push(`✓ Match excelente de nombre (${tokenScore} pts)`);
  } else if (tokenScore > 50) {
    reasons.push(`✓ Match fuerte de nombre (${tokenScore} pts)`);
  } else if (tokenScore > 30) {
    reasons.push(`Match medio de nombre (${tokenScore} pts)`);
  } else if (tokenScore > 0) {
    reasons.push(`Match débil de nombre (${tokenScore} pts)`);
  }

  // 2. SEGMENTO - ALTA PRIORIDAD (hasta 100 puntos o -80 penalización)
  const segmentMatch = calculateSegmentMatch(model.segment, searchQuery);
  score += segmentMatch.score;
  if (segmentMatch.reason) {
    reasons.push(segmentMatch.reason);
  }

  // 3. AÑO - PRIORIDAD MEDIA (hasta 50 puntos)
  if (model.year) {
    const currentYear = new Date().getFullYear();
    const yearDiff = currentYear - model.year;

    if (searchYear) {
      if (model.year === searchYear) {
        score += 50;
        reasons.push(`✓ Año exacto: ${model.year} (+50 pts)`);
      } else {
        const yearDistance = Math.abs(model.year - searchYear);
        if (yearDistance === 1) {
          score += 15;
          reasons.push(`Año cercano: ${model.year} (+15 pts)`);
        } else if (yearDistance === 2) {
          score += 5;
          reasons.push(`Año próximo: ${model.year} (+5 pts)`);
        }
      }
    } else {
      // Sin año específico en búsqueda, premiar modelos recientes
      if (yearDiff === 0) {
        score += 15;
        reasons.push(`Modelo ${model.year} actual (+15 pts)`);
      } else if (yearDiff === 1) {
        score += 10;
        reasons.push(`Modelo ${model.year} reciente (+10 pts)`);
      } else if (yearDiff === 2) {
        score += 5;
        reasons.push(`Modelo ${model.year} (+5 pts)`);
      }
    }
  }

  // 4. STOCK - PRIORIDAD BAJA, SOLO DESEMPATE (hasta 15 puntos)
  if (model.stock > 0) {
    if (model.stock > 3) {
      score += 15;
      reasons.push(`Stock disponible: ${model.stock} unidades (+15 pts)`);
    } else {
      score += 10;
      reasons.push(`Stock limitado: ${model.stock} unidades (+10 pts)`);
    }
  } else {
    score += 0; // Sin penalización por falta de stock
    reasons.push(`⚠ Sin stock disponible (0 pts)`);
  }

  // 5. EXTRAS - PRIORIDAD MUY BAJA (hasta 5 puntos)
  if (model.test_drive_available) {
    score += 5;
    reasons.push('Prueba de manejo disponible (+5 pts)');
  }

  // 6. VALIDACIÓN FINAL
  if (!model.active) {
    score = -999;
    reasons.push('❌ Modelo inactivo (descartado)');
  }

  return {
    model,
    score,
    reasons
  };
}

function getMatchConfidence(score: number): string {
  if (score >= 100) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 30) return 'low';
  return 'very_low';
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

    // Debug: mostrar top 3 resultados en logs
    console.log('=== TOP 3 RESULTADOS ===');
    scoredModels.slice(0, 3).forEach((sm, idx) => {
      console.log(`${idx + 1}. ${sm.model.model} - Score: ${sm.score}`);
      console.log(`   Razones: ${sm.reasons.join(' | ')}`);
    });

    const bestMatch = scoredModels[0];

    // Umbral mínimo aumentado para mejor calidad
    if (bestMatch.score < 30) {
      return {
        success: false,
        error: 'No se encontró coincidencia',
        message: `No se encontró un modelo que coincida con "${searchQuery}". Intenta con otro término de búsqueda.`,
        suggestion: 'Verifica el nombre del modelo o busca por categoría (Scooter, Deportiva, Doble Propósito, etc.)',
        debug_top_results: scoredModels.slice(0, 3).map(sm => ({
          model: sm.model.model,
          segment: sm.model.segment,
          score: sm.score,
          reasons: sm.reasons
        }))
      };
    }

    const alternativeModelsCount = scoredModels.filter(
      (sm, index) => index > 0 && sm.score > 50
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