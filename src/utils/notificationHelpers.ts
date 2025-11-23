import type { Notification } from '../components/NotificationCenter';

type NotificationInput = Omit<Notification, 'id' | 'is_read' | 'created_at'>;

export function createLeadNotification(lead: { name: string; score: number; status: string; phone?: string | null; model_interested?: string | null; timeframe?: string | null }): NotificationInput | null {
  if (lead.status === 'Verde' && lead.score >= 80) {
    return {
      type: 'green_lead_alert',
      title: 'Lead Verde - Alta Prioridad',
      message: `El lead ${lead.name} ha sido calificado como VERDE (Score: ${lead.score}/100). Contactar inmediatamente.`,
      priority: 'high',
      category: 'lead',
      entity_type: 'lead',
      metadata: {
        lead_name: lead.name,
        score: lead.score,
        phone: lead.phone,
        model: lead.model_interested,
        timeframe: lead.timeframe
      }
    };
  }

  if (lead.score < 50) {
    return {
      type: 'low_score_alert',
      title: 'Lead con Score Bajo',
      message: `El lead ${lead.name} ha caído a un score de ${lead.score}/100. Requiere seguimiento inmediato.`,
      priority: 'high',
      category: 'score',
      entity_type: 'lead',
      metadata: {
        lead_name: lead.name,
        score: lead.score,
        status: lead.status,
        model: lead.model_interested
      }
    };
  }

  return null;
}

export function createStockNotification(model: string, stock: number, segment: string, price: number): NotificationInput {
  return {
    type: 'low_stock_alert',
    title: 'Stock Bajo en Inventario',
    message: `El modelo ${model} tiene solo ${stock} unidades en stock.`,
    priority: 'high',
    category: 'inventory',
    entity_type: 'catalog',
    metadata: {
      model,
      stock,
      segment,
      price
    }
  };
}

export function createAppointmentReminderNotification(
  type: 'test_drive' | 'service',
  clientName: string,
  details: string,
  date: string
): NotificationInput {
  return {
    type: 'appointment_reminder',
    title: `Recordatorio: ${type === 'test_drive' ? 'Prueba de Manejo' : 'Servicio Técnico'} Próxima`,
    message: `${clientName} - ${details} programado para ${new Date(date).toLocaleString('es-MX')}`,
    priority: 'high',
    category: 'appointment',
    entity_type: type,
    metadata: {
      client_name: clientName,
      details,
      date
    }
  };
}

export function createFollowUpNotification(leadName: string, dueDate: string): NotificationInput {
  return {
    type: 'follow_up_due',
    title: 'Seguimiento Pendiente',
    message: `Seguimiento programado con ${leadName} para hoy.`,
    priority: 'medium',
    category: 'lead',
    entity_type: 'follow_up',
    metadata: {
      lead_name: leadName,
      due_date: dueDate
    }
  };
}
