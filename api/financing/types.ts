import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Crear cliente de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface FinancingTypesResponse {
  success: boolean;
  data?: {
    count: number;
    types: FinancingTypeInfo[];
    campaigns?: CampaignInfo[];
  };
  error?: string;
  message?: string;
}

interface FinancingTypeInfo {
  id: string;
  financing_type: string;
  description: string | null;
  min_term_months: number;
  max_term_months: number;
  interest_rate: number;
  interest_rate_formatted: string;
  min_down_payment_percent: number;
  fixed_down_payment_percent: number | null;
  requires_minimum_price: boolean;
  minimum_price: number | null;
  minimum_price_formatted: string | null;
}

interface CampaignInfo {
  id: string;
  campaign_name: string;
  campaign_type: string;
  provider: string;
  description: string | null;
  applicable_models: string[];
  start_date: string;
  end_date: string;
  term_months: number;
  down_payment_percent: number;
  interest_rate: number;
  interest_rate_formatted: string;
  min_price: number | null;
  min_price_formatted: string | null;
  is_active_now: boolean;
  days_remaining: number | null;
}

/**
 * Formatear precio en formato mexicano
 */
function formatPrice(price: number): string {
  return `$${price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
}

/**
 * Calcular días restantes de una campaña
 */
function getDaysRemaining(endDate: string): number {
  const today = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Verificar si una campaña está activa ahora
 */
function isCampaignActiveNow(startDate: string, endDate: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return startDate <= today && endDate >= today;
}

/**
 * Obtener todos los tipos de financiamiento disponibles
 */
async function getFinancingTypes(
  includeCampaigns: boolean = true,
  model?: string
): Promise<FinancingTypesResponse> {
  try {
    // 1. Obtener reglas de financiamiento activas
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

    const types: FinancingTypeInfo[] = (rules || []).map(rule => ({
      id: rule.id,
      financing_type: rule.financing_type,
      description: rule.description,
      min_term_months: rule.min_term_months,
      max_term_months: rule.max_term_months,
      interest_rate: rule.interest_rate,
      interest_rate_formatted: rule.interest_rate === 0 
        ? 'Sin Intereses' 
        : `${(rule.interest_rate * 100).toFixed(2)}%`,
      min_down_payment_percent: rule.min_down_payment_percent,
      fixed_down_payment_percent: rule.fixed_down_payment_percent,
      requires_minimum_price: rule.requires_minimum_price,
      minimum_price: rule.minimum_price,
      minimum_price_formatted: rule.minimum_price ? formatPrice(rule.minimum_price) : null
    }));

    const result: FinancingTypesResponse = {
      success: true,
      data: {
        count: types.length,
        types
      }
    };

    // 2. Obtener campañas activas si se solicita
    if (includeCampaigns) {
      const today = new Date().toISOString().split('T')[0];

      let campaignsQuery = supabase
        .from('financing_campaigns')
        .select('*')
        .eq('active', true)
        .order('priority', { ascending: false });

      const { data: campaigns, error: campaignsError } = await campaignsQuery;

      if (!campaignsError && campaigns) {
        let filteredCampaigns = campaigns;

        // Filtrar por modelo si se especifica
        if (model) {
          filteredCampaigns = campaigns.filter(c => 
            c.applicable_models.includes(model)
          );
        }

        const campaignInfos: CampaignInfo[] = filteredCampaigns.map(campaign => ({
          id: campaign.id,
          campaign_name: campaign.campaign_name,
          campaign_type: campaign.campaign_type,
          provider: campaign.provider,
          description: campaign.benefits_description,
          applicable_models: campaign.applicable_models,
          start_date: campaign.start_date,
          end_date: campaign.end_date,
          term_months: campaign.term_months,
          down_payment_percent: campaign.down_payment_percent,
          interest_rate: campaign.interest_rate,
          interest_rate_formatted: campaign.interest_rate === 0 
            ? 'Sin Intereses' 
            : `${(campaign.interest_rate * 100).toFixed(2)}%`,
          min_price: campaign.min_price,
          min_price_formatted: campaign.min_price ? formatPrice(campaign.min_price) : null,
          is_active_now: isCampaignActiveNow(campaign.start_date, campaign.end_date),
          days_remaining: isCampaignActiveNow(campaign.start_date, campaign.end_date) 
            ? getDaysRemaining(campaign.end_date) 
            : null
        }));

        result.data!.campaigns = campaignInfos;
      }
    }

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
    // Validar API Key (opcional para este endpoint)
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.API_KEY;

    if (validApiKey && apiKey !== validApiKey) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado',
        message: 'API Key inválida'
      });
    }

    // Parámetros opcionales
    const { campaigns, model } = req.query;
    const includeCampaigns = campaigns !== 'false'; // Por defecto incluye campañas
    const modelFilter = typeof model === 'string' ? model : undefined;

    const result = await getFinancingTypes(includeCampaigns, modelFilter);

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