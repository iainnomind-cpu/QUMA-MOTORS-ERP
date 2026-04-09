import { Lead, LeadInteraction, LeadFollowUp } from './supabase';

export interface ScoreAdjustment {
  newScore: number;
  adjustment: number;
  reason: string;
  newStatus: 'Verde' | 'Amarillo' | 'Rojo';
}

export class LeadScoringEngine {
  static calculateScoreAdjustment(
    lead: Lead,
    event: {
      type: 'interaction' | 'follow_up' | 'preference_change' | 'edit';
      data?: {
        interactionType?: string;
        channel?: string;
        direction?: string;
        followUpCompleted?: boolean;
        oldTimeframe?: string;
        newTimeframe?: string;
        oldFinancing?: string;
        newFinancing?: string;
        oldModel?: string;
        newModel?: string;
      };
    }
  ): ScoreAdjustment {
    let scoreChange = 0;
    let reason = '';
    const currentScore = lead.score;

    if (event.type === 'interaction') {
      const { interactionType, channel, direction } = event.data || {};

      if (direction === 'inbound') {
        scoreChange += 8;
        reason = 'Interacción iniciada por el lead (alta intención)';
      } else if (direction === 'outbound') {
        scoreChange += 3;
        reason = 'Contacto exitoso del equipo de ventas';
      }

      if (channel === 'WhatsApp') {
        scoreChange += 5;
        reason += ' + Canal WhatsApp (alta receptividad)';
      } else if (channel === 'Phone') {
        scoreChange += 7;
        reason += ' + Llamada telefónica (contacto directo)';
      } else if (channel === 'In-Person') {
        scoreChange += 12;
        reason += ' + Visita presencial (interés muy alto)';
      }

      if (interactionType === 'meeting') {
        scoreChange += 15;
        reason = 'Reunión agendada y realizada (alta probabilidad)';
      } else if (interactionType === 'test_drive') {
        scoreChange += 20;
        reason = 'Prueba de manejo realizada (intención de compra muy alta)';
      } else if (interactionType === 'quotation') {
        scoreChange += 10;
        reason = 'Cotización solicitada (interés comercial)';
      }
    }

    if (event.type === 'follow_up') {
      const { followUpCompleted } = event.data || {};

      if (followUpCompleted) {
        scoreChange += 6;
        reason = 'Seguimiento completado (progreso en pipeline)';
      } else {
        scoreChange -= 3;
        reason = 'Seguimiento programado no completado (baja receptividad)';
      }
    }

    if (event.type === 'preference_change') {
      const { oldTimeframe, newTimeframe, oldFinancing, newFinancing } = event.data || {};

      if (oldTimeframe === 'Futuro' && newTimeframe === 'Inmediato') {
        scoreChange += 15;
        reason = 'Cambio a timeframe inmediato (urgencia de compra)';
      } else if (oldTimeframe === 'Inmediato' && newTimeframe === 'Futuro') {
        scoreChange -= 10;
        reason = 'Cambio a timeframe futuro (menor urgencia)';
      }

      if (newFinancing === 'Yamaha Especial') {
        scoreChange += 12;
        reason += ' + Interés en financiamiento Yamaha Especial (condiciones óptimas)';
      } else if (oldFinancing === 'Yamaha Especial' && newFinancing !== 'Yamaha Especial') {
        scoreChange -= 8;
        reason += ' - Cambió de financiamiento Yamaha Especial (reevaluación)';
      }
    }

    if (event.type === 'edit') {
      const { oldModel, newModel, oldTimeframe, newTimeframe, oldFinancing, newFinancing } = event.data || {};

      if (oldModel !== newModel && newModel) {
        scoreChange += 3;
        reason = 'Actualizó preferencia de modelo (interés activo)';
      }

      if (oldTimeframe !== newTimeframe) {
        if (newTimeframe === 'Inmediato') {
          scoreChange += 15;
          reason += ' + Urgencia de compra inmediata';
        } else if (newTimeframe === 'Futuro') {
          scoreChange -= 10;
          reason += ' - Compra futura (menor prioridad)';
        }
      }

      if (oldFinancing !== newFinancing && newFinancing === 'Yamaha Especial') {
        scoreChange += 12;
        reason += ' + Financiamiento estratégico';
      }
    }

    const daysSinceCreation = Math.floor(
      (new Date().getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceCreation > 30 && scoreChange < 5) {
      scoreChange -= 2;
      reason += ' - Lead antiguo sin progreso significativo';
    }

    let newScore = Math.max(0, Math.min(100, currentScore + scoreChange));

    let newStatus: 'Verde' | 'Amarillo' | 'Rojo';
    if (newScore >= 80) {
      newStatus = 'Verde';
    } else if (newScore >= 60) {
      newStatus = 'Amarillo';
    } else {
      newStatus = 'Rojo';
    }

    return {
      newScore: Math.round(newScore),
      adjustment: scoreChange,
      reason,
      newStatus
    };
  }

  static async applyScoreAdjustment(
    leadId: string,
    currentScore: number,
    adjustment: number
  ): Promise<{ score: number; status: string }> {
    const newScore = Math.max(0, Math.min(100, currentScore + adjustment));

    let newStatus: 'Verde' | 'Amarillo' | 'Rojo';
    if (newScore >= 80) {
      newStatus = 'Verde';
    } else if (newScore >= 60) {
      newStatus = 'Amarillo';
    } else {
      newStatus = 'Rojo';
    }

    return { score: Math.round(newScore), status: newStatus };
  }

  /**
   * Calculate the initial score for a newly created lead based on its data.
   * This replaces the old hardcoded score of 45/Rojo.
   */
  static calculateInitialScore(data: {
    timeframe?: string;
    financing_type?: string;
    test_drive_requested?: boolean;
    origin?: string;
    model_interested?: string;
    requires_financing?: boolean;
    email?: string;
    phone?: string;
  }): { score: number; status: 'Verde' | 'Amarillo' | 'Rojo' } {
    let score = 30; // Base score for any new lead

    // === TIMEFRAME (highest impact) ===
    if (data.timeframe === 'Inmediato') {
      score += 30; // Urgent buyer
    } else if (data.timeframe === '1-3 meses') {
      score += 15;
    } else if (data.timeframe === '3-6 meses') {
      score += 8;
    }
    // 'Futuro' or empty = no bonus

    // === FINANCING TYPE ===
    if (data.financing_type === 'Contado' || data.financing_type === 'contado') {
      score += 25; // Cash buyer = highest intent
    } else if (data.financing_type === 'Yamaha Especial') {
      score += 15;
    } else if (data.financing_type === 'Corto Plazo Interno') {
      score += 12;
    } else if (data.financing_type === 'Tarjeta Bancaria S/I') {
      score += 10;
    } else if (data.financing_type && data.financing_type.trim() !== '') {
      score += 5; // Any other financing = some intent
    }

    // === TEST DRIVE ===
    if (data.test_drive_requested) {
      score += 10; // Shows strong intent
    }

    // === ORIGIN ===
    if (data.origin === 'Planta' || data.origin === 'Visita') {
      score += 8; // Walk-in = high intent
    } else if (data.origin === 'Referido') {
      score += 6;
    } else if (data.origin === 'Chatbot WA') {
      score += 4;
    }
    // Social media, web = no extra bonus

    // === CONTACT INFO COMPLETENESS ===
    if (data.email && data.email.trim() !== '') {
      score += 2;
    }
    if (data.phone && data.phone.trim() !== '') {
      score += 3;
    }

    // === MODEL INTEREST ===
    if (data.model_interested && data.model_interested.trim() !== '') {
      score += 5; // Knows what they want
    }

    // Cap score at 100
    score = Math.min(100, Math.max(0, score));

    // Determine status
    let status: 'Verde' | 'Amarillo' | 'Rojo';
    if (score >= 80) {
      status = 'Verde';
    } else if (score >= 60) {
      status = 'Amarillo';
    } else {
      status = 'Rojo';
    }

    return { score, status };
  }
}
