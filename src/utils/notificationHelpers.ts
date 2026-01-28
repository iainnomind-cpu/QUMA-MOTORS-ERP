import type { Notification } from '../components/NotificationCenter';

type NotificationInput = Omit<Notification, 'id' | 'is_read' | 'created_at'>;

// ========================================
// 1. NOTIFICACIONES DE LEADS
// ========================================

/**
 * Crear notificación cuando un lead alcanza status Verde (Alta Prioridad)
 */
export function createGreenLeadNotification(lead: {
  id: string;
  name: string;
  score: number;
  status: string;
  phone?: string | null;
  model_interested?: string | null;
  timeframe?: string | null;
  origin?: string | null;
}): NotificationInput | null {
  if (lead.status === 'Verde' && lead.score >= 80) {
    return {
      type: 'green_lead_alert',
      title: '🎯 Lead Verde - Alta Prioridad',
      message: `👤 Nombre: ${lead.name}
📊 Calificación: ${lead.score}/100 (Prioridad Alta 🟢)
🏍️ Interés: ${lead.model_interested || 'No especificado'}
📱 Contacto: ${lead.phone || 'No disponible'}
💡 Origen: ${lead.origin || 'No especificado'}

🎯 Contactar de inmediato para mantener el interés alto y agendar cita.`,
      priority: 'high',
      category: 'lead',
      entity_type: 'lead',
      entity_id: lead.id,
      metadata: {
        lead_id: lead.id,
        lead_name: lead.name,
        score: lead.score,
        phone: lead.phone,
        model: lead.model_interested,
        timeframe: lead.timeframe,
        status: lead.status
      }
    };
  }
  return null;
}

/**
 * Crear notificación cuando un lead tiene score bajo (< 50)
 */
export function createLowScoreNotification(lead: {
  id: string;
  name: string;
  score: number;
  status: string;
  model_interested?: string | null;
}): NotificationInput | null {
  if (lead.score < 50) {
    return {
      type: 'low_score_alert',
      title: '⚠️ Lead con Score Bajo',
      message: `El lead ${lead.name} ha caído a un score de ${lead.score}/100. Requiere plan de nutrición y reactivación inmediata.`,
      priority: 'high',
      category: 'score',
      entity_type: 'lead',
      entity_id: lead.id,
      metadata: {
        lead_id: lead.id,
        lead_name: lead.name,
        score: lead.score,
        status: lead.status,
        model: lead.model_interested
      }
    };
  }
  return null;
}

/**
 * Crear notificación de seguimiento pendiente
 */
export function createFollowUpNotification(lead: {
  id: string;
  name: string;
  dueDate: string;
  agent?: string;
}): NotificationInput {
  return {
    type: 'follow_up_due',
    title: '📅 Seguimiento Pendiente',
    message: `Seguimiento programado con ${lead.name} para hoy. ${lead.agent ? `Asignado a: ${lead.agent}` : ''}`,
    priority: 'medium',
    category: 'lead',
    entity_type: 'follow_up',
    entity_id: lead.id,
    metadata: {
      lead_id: lead.id,
      lead_name: lead.name,
      due_date: lead.dueDate,
      agent: lead.agent
    }
  };
}

// ========================================
// 2. NOTIFICACIONES DE AGENDAMIENTO
// ========================================

/**
 * Crear notificación cuando se agenda una prueba de manejo
 */
export function createTestDriveScheduledNotification(appointment: {
  id: string;
  leadName: string;
  model: string;
  date: string;
  location?: string;
}): NotificationInput {
  const appointmentDate = new Date(appointment.date);
  const formattedDate = appointmentDate.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    type: 'test_drive_scheduled',
    title: '🏍️ Nueva Prueba de Manejo Agendada',
    message: `Cliente: ${appointment.leadName}
Modelo: ${appointment.model}
Fecha: ${formattedDate}
Ubicación: ${appointment.location || 'Agencia'}

✅ Preparar unidad y documentación necesaria.`,
    priority: 'medium',
    category: 'appointment',
    entity_type: 'test_drive',
    entity_id: appointment.id,
    metadata: {
      appointment_id: appointment.id,
      lead_name: appointment.leadName,
      model: appointment.model,
      date: appointment.date,
      location: appointment.location
    }
  };
}

/**
 * Crear notificación cuando se agenda un servicio técnico
 */
export function createServiceScheduledNotification(appointment: {
  id: string;
  clientName: string;
  serviceType: string;
  date: string;
  technician?: string;
}): NotificationInput {
  const appointmentDate = new Date(appointment.date);
  const formattedDate = appointmentDate.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    type: 'service_scheduled',
    title: '🔧 Nuevo Servicio Técnico Agendado',
    message: `Cliente: ${appointment.clientName}
Tipo: ${appointment.serviceType}
Fecha: ${formattedDate}
${appointment.technician ? `Técnico: ${appointment.technician}` : ''}

🔧 Asignar técnico y preparar recursos necesarios.`,
    priority: 'medium',
    category: 'service',
    entity_type: 'service_appointment',
    entity_id: appointment.id,
    metadata: {
      appointment_id: appointment.id,
      client_name: appointment.clientName,
      service_type: appointment.serviceType,
      date: appointment.date,
      technician: appointment.technician
    }
  };
}

/**
 * Crear notificación recordatorio 24h antes de cita
 */
export function createAppointmentReminderNotification(appointment: {
  id: string;
  type: 'test_drive' | 'service';
  clientName: string;
  details: string;
  date: string;
}): NotificationInput {
  const appointmentDate = new Date(appointment.date);
  const time = appointmentDate.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const typeText = appointment.type === 'test_drive' ? 'Prueba de Manejo' : 'Servicio Técnico';
  const emoji = appointment.type === 'test_drive' ? '🏍️' : '🔧';

  return {
    type: 'appointment_reminder_24h',
    title: `${emoji} Recordatorio: ${typeText} Mañana`,
    message: `${typeText} mañana con ${appointment.clientName} a las ${time}
Detalles: ${appointment.details}

📞 Confirmar con el cliente hoy mismo.`,
    priority: 'high',
    category: 'appointment',
    entity_type: appointment.type,
    entity_id: appointment.id,
    metadata: {
      appointment_id: appointment.id,
      appointment_type: appointment.type,
      client_name: appointment.clientName,
      details: appointment.details,
      date: appointment.date
    },
    expires_at: appointment.date // Expira después de la cita
  };
}

// ========================================
// 3. NOTIFICACIONES DE INVENTARIO
// ========================================

/**
 * Crear notificación de stock bajo (≤ 2 unidades)
 */
export function createLowStockNotification(item: {
  id: string;
  model: string;
  stock: number;
  segment: string;
  price: number;
}): NotificationInput | null {
  if (item.stock <= 2) {
    return {
      type: 'low_stock_alert',
      title: '📦 Stock Bajo en Inventario',
      message: `⚠️ El modelo ${item.model} tiene solo ${item.stock} unidades en stock.
Segmento: ${item.segment}
Precio: $${item.price.toLocaleString('es-MX')}

🚨 Solicitar reabastecimiento urgente.`,
      priority: 'high',
      category: 'inventory',
      entity_type: 'catalog',
      entity_id: item.id,
      metadata: {
        catalog_id: item.id,
        model: item.model,
        stock: item.stock,
        segment: item.segment,
        price: item.price
      }
    };
  }
  return null;
}

/**
 * Crear notificación cuando el stock llega a 0
 */
export function createOutOfStockNotification(item: {
  id: string;
  model: string;
  segment: string;
}): NotificationInput {
  return {
    type: 'out_of_stock_alert',
    title: '🚫 Modelo Agotado',
    message: `El modelo ${item.model} está AGOTADO (0 unidades).
Segmento: ${item.segment}

❌ Modelo no disponible para venta. Reabastecer inmediatamente.`,
    priority: 'high',
    category: 'inventory',
    entity_type: 'catalog',
    entity_id: item.id,
    metadata: {
      catalog_id: item.id,
      model: item.model,
      segment: item.segment,
      stock: 0
    }
  };
}

// ========================================
// 4. NOTIFICACIONES FINANCIERAS
// ========================================

/**
 * Crear notificación cuando se aprueba un financiamiento
 */
export function createFinancingApprovedNotification(financing: {
  id: string;
  clientName: string;
  amount: number;
  term: number;
  model: string;
}): NotificationInput {
  return {
    type: 'financing_approved',
    title: '💰 Financiamiento Aprobado',
    message: `Cliente: ${financing.clientName}
Modelo: ${financing.model}
Monto: $${financing.amount.toLocaleString('es-MX')}
Plazo: ${financing.term} meses

✅ Proceder con el proceso de venta.`,
    priority: 'high',
    category: 'finance',
    entity_type: 'financing',
    entity_id: financing.id,
    metadata: {
      financing_id: financing.id,
      client_name: financing.clientName,
      amount: financing.amount,
      term: financing.term,
      model: financing.model
    }
  };
}

// ========================================
// 5. NOTIFICACIONES DEL SISTEMA
// ========================================

/**
 * Crear notificación de cumpleaños de cliente
 */
export function createBirthdayNotification(client: {
  id: string;
  name: string;
  phone?: string;
  lastPurchase?: string;
}): NotificationInput {
  return {
    type: 'client_birthday',
    title: '🎂 Cumpleaños de Cliente',
    message: `¡Es el cumpleaños de ${client.name}!
${client.phone ? `Contacto: ${client.phone}` : ''}
${client.lastPurchase ? `Última compra: ${client.lastPurchase}` : ''}

🎁 Enviar felicitación y promoción especial.`,
    priority: 'medium',
    category: 'system',
    entity_type: 'client',
    entity_id: client.id,
    metadata: {
      client_id: client.id,
      client_name: client.name,
      phone: client.phone,
      last_purchase: client.lastPurchase
    },
    expires_at: new Date(new Date().setHours(23, 59, 59, 999)).toISOString() // Expira al final del día
  };
}

/**
 * Crear notificación de error del sistema
 */
export function createSystemErrorNotification(error: {
  code: string;
  message: string;
  module?: string;
}): NotificationInput {
  return {
    type: 'system_error',
    title: '⚠️ Error del Sistema',
    message: `Se ha detectado un error en el sistema.
${error.module ? `Módulo: ${error.module}` : ''}
Código: ${error.code}
${error.message}

🔧 Reportar al equipo técnico si persiste.`,
    priority: 'high',
    category: 'system',
    entity_type: 'system',
    metadata: {
      error_code: error.code,
      error_message: error.message,
      module: error.module,
      timestamp: new Date().toISOString()
    }
  };
}

// ========================================
// HELPER PARA NOTIFICACIONES GENÉRICAS
// ========================================

/**
 * Crear notificación personalizada
 */
export function createCustomNotification(
  title: string,
  message: string,
  priority: 'high' | 'medium' | 'low',
  category: 'lead' | 'appointment' | 'service' | 'score' | 'system' | 'finance' | 'inventory',
  metadata?: Record<string, any>
): NotificationInput {
  return {
    type: 'custom',
    title,
    message,
    priority,
    category,
    entity_type: 'custom',
    metadata: metadata || {}
  };
}