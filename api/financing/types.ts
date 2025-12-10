import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Crear cliente de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Formatear precio en formato mexicano
 */
function formatPrice(price: number): string {
  return `$${price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
}

/**
 * Obtener todos los tipos de financiamiento en formato plano para ManyChat
 */
async function getFinancingTypesFlat() {
  try {
    // Obtener reglas de financiamiento activas
    const { data: rules, error: rulesError } = await supabase
      .from('financing_rules')
      .select('*')
      .eq('active', true)
      .order('financing_type');

    if (rulesError) {
      return {
        success: false,
        error: 'Error al obtener tipos de financiamiento',
        message: rulesError.message
      };
    }

    if (!rules || rules.length === 0) {
      return {
        success: true,
        count: 0,
        message: 'No hay tipos de financiamiento disponibles'
      };
    }

    // Convertir array a objeto plano con índices
    const result: any = {
      success: true,
      count: rules.length
    };

    rules.forEach((rule, index) => {
      const prefix = `type_${index + 1}`;
      result[`${prefix}_id`] = rule.id;
      result[`${prefix}_name`] = rule.financing_type;
      result[`${prefix}_description`] = rule.description || '';
      result[`${prefix}_min_months`] = rule.min_term_months;
      result[`${prefix}_max_months`] = rule.max_term_months;
      result[`${prefix}_interest_rate`] = rule.interest_rate;
      result[`${prefix}_interest_formatted`] = rule.interest_rate === 0 
        ? 'Sin Intereses' 
        : `${(rule.interest_rate * 100).toFixed(2)}%`;
      result[`${prefix}_min_down_percent`] = rule.min_down_payment_percent;
      result[`${prefix}_fixed_down_percent`] = rule.fixed_down_payment_percent || 0;
      result[`${prefix}_requires_min_price`] = rule.requires_minimum_price;
      result[`${prefix}_min_price`] = rule.minimum_price || 0;
      result[`${prefix}_min_price_formatted`] = rule.minimum_price 
        ? formatPrice(rule.minimum_price) 
        : '$0.00 MXN';
    });

    return result;
  } catch (error) {
    console.error('Error al obtener tipos de financiamiento:', error);
    return {
      success: false,
      error: 'Error al obtener tipos de financiamiento',
      message: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Verificar si hay campañas activas para un modelo específico
 */
async function checkCampaignsForModel(model: string) {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: campaigns, error } = await supabase
      .from('financing_campaigns')
      .select('*')
      .eq('active', true)
      .lte('start_date', today)
      .gte('end_date', today)
      .contains('applicable_models', [model])
      .order('priority', { ascending: false });

    if (error || !campaigns || campaigns.length === 0) {
      return {
        success: true,
        has_campaign: false,
        model: model,
        message: 'No hay campañas activas para este modelo'
      };
    }

    // Tomar la campaña con mayor prioridad
    const campaign = campaigns[0];
    const daysRemaining = Math.ceil(
      (new Date(campaign.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      success: true,
      has_campaign: true,
      model: model,
      campaign_id: campaign.id,
      campaign_name: campaign.campaign_name,
      campaign_type: campaign.campaign_type,
      provider: campaign.provider,
      description: campaign.benefits_description || '',
      applicable_models: campaign.applicable_models.join(', '),
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      term_months: campaign.term_months,
      down_payment_percent: campaign.down_payment_percent,
      interest_rate: campaign.interest_rate,
      interest_formatted: campaign.interest_rate === 0 
        ? 'Sin Intereses' 
        : `${(campaign.interest_rate * 100).toFixed(2)}%`,
      min_price: campaign.min_price || 0,
      min_price_formatted: campaign.min_price ? formatPrice(campaign.min_price) : '$0.00 MXN',
      days_remaining: daysRemaining,
      days_remaining_text: daysRemaining === 1 
        ? '1 día restante' 
        : `${daysRemaining} días restantes`
    };
  } catch (error) {
    console.error('Error al verificar campañas:', error);
    return {
      success: false,
      error: 'Error al verificar campañas',
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

    const { model } = req.query;

    // Si se proporciona modelo, verificar campañas para ese modelo
    if (model && typeof model === 'string') {
      const result = await checkCampaignsForModel(model);
      return res.status(200).json(result);
    }

    // Si no, devolver todos los tipos en formato plano
    const result = await getFinancingTypesFlat();
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error en /api/financing/types:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}