import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Crear cliente de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Tipos importados de supabase.ts
interface CatalogItem {
  id: string;
  model: string;
  price_cash: number;
  segment: string;
  stock: number;
  active: boolean;
  [key: string]: any;
}

interface FinancingRule {
  id: string;
  financing_type: string;
  min_term_months: number;
  max_term_months: number;
  interest_rate: number;
  min_down_payment_percent: number;
  fixed_down_payment_percent: number | null;
  requires_minimum_price: boolean;
  minimum_price: number | null;
  active: boolean;
  description: string | null;
}

interface FinancingCampaign {
  id: string;
  campaign_name: string;
  campaign_type: string;
  provider: string;
  start_date: string;
  end_date: string;
  applicable_models: string[];
  min_price: number | null;
  max_price: number | null;
  down_payment_percent: number;
  term_months: number;
  interest_rate: number;
  special_conditions: Record<string, any>;
  benefits_description: string | null;
  active: boolean;
  priority: number;
}

interface FinancingCalculationRequest {
  model: string;
  financing_type: string;
  term_months?: number;
  down_payment?: number;
  lead_id?: string; // Opcional para registrar en el log
}

interface FinancingCalculationResponse {
  success: boolean;
  data?: {
    model: string;
    price_cash: number;
    price_formatted: string;
    financing_type: string;
    term_months: number;
    down_payment: number;
    down_payment_formatted: string;
    down_payment_percent: number;
    amount_to_finance: number;
    amount_to_finance_formatted: string;
    monthly_payment: number;
    monthly_payment_formatted: string;
    total_amount: number;
    total_amount_formatted: string;
    interest_amount: number;
    interest_amount_formatted: string;
    interest_rate: number;
    interest_rate_formatted: string;
    campaign_active: boolean;
    campaign_name?: string;
    campaign_description?: string;
    provider?: string;
  };
  error?: string;
  message?: string;
}

/**
 * Formatear precio en formato mexicano
 */
function formatPrice(price: number): string {
  return `$${price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
}

/**
 * Normalizar nombre del modelo
 */
function normalizeModelName(input: string): string {
  return input
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '');
}

/**
 * Calcular mensualidad con interés compuesto
 */
function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  months: number
): number {
  if (principal <= 0) return 0;
  if (months <= 0) return 0;
  
  if (annualRate === 0) {
    return principal / months;
  }

  const monthlyRate = annualRate / 12;
  const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, months);
  const denominator = Math.pow(1 + monthlyRate, months) - 1;
  
  return numerator / denominator;
}

/**
 * Registrar cálculo en el log
 */
async function logCalculation(
  leadId: string | null,
  catalogItem: CatalogItem,
  financingType: string,
  campaignId: string | null,
  downPayment: number,
  termMonths: number,
  monthlyPayment: number,
  totalAmount: number,
  interestAmount: number
): Promise<void> {
  try {
    await supabase
      .from('financing_calculations_log')
      .insert({
        lead_id: leadId,
        model: catalogItem.model,
        price: catalogItem.price_cash,
        financing_type: financingType,
        campaign_id: campaignId,
        down_payment: downPayment,
        term_months: termMonths,
        monthly_payment: monthlyPayment,
        total_amount: totalAmount,
        interest_amount: interestAmount,
        calculation_source: 'api'
      });
  } catch (error) {
    console.error('Error al registrar cálculo:', error);
    // No lanzar error, solo loggear
  }
}

/**
 * Realizar cálculo de financiamiento
 */
async function calculateFinancing(
  request: FinancingCalculationRequest
): Promise<FinancingCalculationResponse> {
  try {
    // Validaciones básicas
    if (!request.model || request.model.trim().length === 0) {
      return {
        success: false,
        error: 'El modelo es requerido',
        message: 'Debe proporcionar el modelo de la motocicleta'
      };
    }

    if (!request.financing_type || request.financing_type.trim().length === 0) {
      return {
        success: false,
        error: 'El tipo de financiamiento es requerido',
        message: 'Debe proporcionar el tipo de financiamiento'
      };
    }

    // 1. Buscar el modelo en el catálogo
    const normalizedModel = normalizeModelName(request.model);

    let { data: catalogItem, error: catalogError } = await supabase
      .from('catalog')
      .select('*')
      .eq('active', true)
      .ilike('model', normalizedModel)
      .maybeSingle();

    // Búsqueda flexible si no encuentra exacta
    if (catalogError || !catalogItem) {
      const { data: models } = await supabase
        .from('catalog')
        .select('*')
        .eq('active', true)
        .or(`model.ilike.%${normalizedModel}%,model.ilike.%${request.model}%`);

      if (!models || models.length === 0) {
        return {
          success: false,
          error: 'Modelo no encontrado',
          message: `No se encontró el modelo "${request.model}" en el catálogo activo. Verifica el nombre del modelo.`
        };
      }

      catalogItem = models[0];
    }

    const price = catalogItem.price_cash;

    if (!price || price <= 0) {
      return {
        success: false,
        error: 'Precio inválido',
        message: 'El modelo no tiene un precio válido configurado'
      };
    }

    // 2. Verificar si hay campaña activa para este modelo
    const today = new Date().toISOString().split('T')[0];

    const { data: campaigns } = await supabase
      .from('financing_campaigns')
      .select('*')
      .eq('active', true)
      .lte('start_date', today)
      .gte('end_date', today)
      .contains('applicable_models', [catalogItem.model])
      .order('priority', { ascending: false });

    let activeCampaign: FinancingCampaign | null = null;
    if (campaigns && campaigns.length > 0) {
      // Filtrar por precio mínimo y máximo si existen
      activeCampaign = campaigns.find(
        (c) => 
          (!c.min_price || price >= c.min_price) &&
          (!c.max_price || price <= c.max_price)
      ) || null;
    }

    // 3. Si hay campaña activa y el tipo es "campaign", usar la campaña
    if (activeCampaign && request.financing_type.toLowerCase() === 'campaign') {
      const downPayment = request.down_payment ?? (price * activeCampaign.down_payment_percent) / 100;
      const amountToFinance = price - downPayment;
      const termMonths = activeCampaign.term_months;
      
      if (amountToFinance < 0) {
        return {
          success: false,
          error: 'Enganche inválido',
          message: 'El enganche no puede ser mayor al precio del vehículo'
        };
      }

      const monthlyPayment = calculateMonthlyPayment(
        amountToFinance,
        activeCampaign.interest_rate,
        termMonths
      );
      const totalAmount = downPayment + (monthlyPayment * termMonths);
      const interestAmount = totalAmount - price;
      const downPaymentPercent = (downPayment / price) * 100;

      // Registrar en el log
      await logCalculation(
        request.lead_id || null,
        catalogItem,
        activeCampaign.campaign_name,
        activeCampaign.id,
        downPayment,
        termMonths,
        monthlyPayment,
        totalAmount,
        interestAmount
      );

      return {
        success: true,
        data: {
          model: catalogItem.model,
          price_cash: price,
          price_formatted: formatPrice(price),
          financing_type: activeCampaign.campaign_name,
          term_months: termMonths,
          down_payment: downPayment,
          down_payment_formatted: formatPrice(downPayment),
          down_payment_percent: Math.round(downPaymentPercent * 100) / 100,
          amount_to_finance: amountToFinance,
          amount_to_finance_formatted: formatPrice(amountToFinance),
          monthly_payment: Math.round(monthlyPayment),
          monthly_payment_formatted: formatPrice(Math.round(monthlyPayment)),
          total_amount: totalAmount,
          total_amount_formatted: formatPrice(totalAmount),
          interest_amount: interestAmount,
          interest_amount_formatted: formatPrice(interestAmount),
          interest_rate: activeCampaign.interest_rate,
          interest_rate_formatted: activeCampaign.interest_rate === 0 
            ? 'Sin Intereses' 
            : `${(activeCampaign.interest_rate * 100).toFixed(2)}%`,
          campaign_active: true,
          campaign_name: activeCampaign.campaign_name,
          campaign_description: activeCampaign.benefits_description || undefined,
          provider: activeCampaign.provider
        }
      };
    }

    // 4. Buscar regla de financiamiento fija
    const { data: rule, error: ruleError } = await supabase
      .from('financing_rules')
      .select('*')
      .eq('active', true)
      .eq('financing_type', request.financing_type)
      .maybeSingle();

    if (ruleError || !rule) {
      // Obtener lista de tipos disponibles
      const { data: availableRules } = await supabase
        .from('financing_rules')
        .select('financing_type')
        .eq('active', true);

      const availableTypes = availableRules?.map(r => r.financing_type).join(', ') || 
        'Corto Plazo Interno, Caja Colón S/I 12, Caja Colón S/I 18, Tarjeta Bancaria S/I';

      return {
        success: false,
        error: 'Tipo de financiamiento no encontrado',
        message: `No se encontró el tipo de financiamiento "${request.financing_type}". Tipos disponibles: ${availableTypes}`
      };
    }

    // 5. Validar precio mínimo si la regla lo requiere
    if (rule.requires_minimum_price && rule.minimum_price && price < rule.minimum_price) {
      return {
        success: false,
        error: 'Precio insuficiente',
        message: `Este tipo de financiamiento requiere un precio mínimo de ${formatPrice(rule.minimum_price)}`
      };
    }

    // 6. Validar plazo
    let termMonths = request.term_months ?? rule.min_term_months;
    if (termMonths < rule.min_term_months || termMonths > rule.max_term_months) {
      return {
        success: false,
        error: 'Plazo inválido',
        message: rule.min_term_months === rule.max_term_months
          ? `Este tipo de financiamiento solo permite un plazo de ${rule.min_term_months} meses`
          : `El plazo debe estar entre ${rule.min_term_months} y ${rule.max_term_months} meses para este tipo de financiamiento`
      };
    }

    // 7. Validar enganche
    const minDownPayment = (price * rule.min_down_payment_percent) / 100;
    let downPayment = request.down_payment ?? minDownPayment;

    // Si hay enganche fijo, usarlo
    if (rule.fixed_down_payment_percent !== null) {
      downPayment = (price * rule.fixed_down_payment_percent) / 100;
      if (request.down_payment && Math.abs(request.down_payment - downPayment) > 1) {
        return {
          success: false,
          error: 'Enganche fijo requerido',
          message: `Este tipo de financiamiento requiere un enganche fijo de ${rule.fixed_down_payment_percent}% (${formatPrice(downPayment)})`
        };
      }
    } else {
      // Validar enganche mínimo
      if (downPayment < minDownPayment) {
        return {
          success: false,
          error: 'Enganche insuficiente',
          message: `El enganche mínimo es ${rule.min_down_payment_percent}% (${formatPrice(minDownPayment)})`
        };
      }
    }

    if (downPayment > price) {
      return {
        success: false,
        error: 'Enganche inválido',
        message: 'El enganche no puede ser mayor al precio del vehículo'
      };
    }

    // 8. Calcular financiamiento
    const amountToFinance = price - downPayment;
    const monthlyPayment = calculateMonthlyPayment(
      amountToFinance,
      rule.interest_rate,
      termMonths
    );
    const totalAmount = downPayment + (monthlyPayment * termMonths);
    const interestAmount = totalAmount - price;
    const downPaymentPercent = (downPayment / price) * 100;

    // 9. Registrar en el log
    await logCalculation(
      request.lead_id || null,
      catalogItem,
      rule.financing_type,
      null,
      downPayment,
      termMonths,
      monthlyPayment,
      totalAmount,
      interestAmount
    );

    return {
      success: true,
      data: {
        model: catalogItem.model,
        price_cash: price,
        price_formatted: formatPrice(price),
        financing_type: rule.financing_type,
        term_months: termMonths,
        down_payment: downPayment,
        down_payment_formatted: formatPrice(downPayment),
        down_payment_percent: Math.round(downPaymentPercent * 100) / 100,
        amount_to_finance: amountToFinance,
        amount_to_finance_formatted: formatPrice(amountToFinance),
        monthly_payment: Math.round(monthlyPayment),
        monthly_payment_formatted: formatPrice(Math.round(monthlyPayment)),
        total_amount: totalAmount,
        total_amount_formatted: formatPrice(totalAmount),
        interest_amount: interestAmount,
        interest_amount_formatted: formatPrice(interestAmount),
        interest_rate: rule.interest_rate,
        interest_rate_formatted:
          rule.interest_rate === 0
            ? 'Sin Intereses'
            : `${(rule.interest_rate * 100).toFixed(2)}%`,
        campaign_active: false
      }
    };
  } catch (error) {
    console.error('Error al calcular financiamiento:', error);
    return {
      success: false,
      error: 'Error al calcular financiamiento',
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método no permitido',
      message: 'Solo se permite el método POST'
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

    const calculationData: FinancingCalculationRequest = req.body;

    if (!calculationData || typeof calculationData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        message: 'El body debe contener los datos del cálculo en formato JSON'
      });
    }

    const result = await calculateFinancing(calculationData);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error en /api/financing/calculate:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}