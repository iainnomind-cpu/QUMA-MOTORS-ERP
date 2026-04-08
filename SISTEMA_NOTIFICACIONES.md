# Sistema de Notificaciones - QuMa Motors CRM

## Descripción General

Sistema centralizado de notificaciones en tiempo real que reemplaza los recordatorios del módulo de agendamiento, proporcionando alertas inteligentes y contextuales en todo el CRM.

## Ubicación

El icono de notificaciones se encuentra en la esquina superior derecha del header, junto a la información de última actualización.

## Tipos de Notificaciones Implementadas

### 1. Notificaciones de Leads

#### Lead Verde (Alta Prioridad)
- **Trigger**: Cuando un lead alcanza status "Verde" (score >= 80)
- **Prioridad**: ALTA
- **Mensaje**: "Lead Verde - Alta Prioridad: [Nombre] ha sido calificado como VERDE (Score: X/100). Contactar inmediatamente."
- **Metadata**: Nombre, score, teléfono, modelo de interés, timeframe
- **Acción Sugerida**: Contacto inmediato del equipo de ventas

#### Score Bajo
- **Trigger**: Cuando un lead cae por debajo de 50 puntos
- **Prioridad**: ALTA
- **Mensaje**: "Lead con Score Bajo: [Nombre] ha caído a un score de X/100. Requiere seguimiento inmediato."
- **Metadata**: Nombre, score, status, modelo de interés
- **Acción Sugerida**: Plan de nutrición y reactivación

### 2. Notificaciones de Agendamiento

#### Prueba de Manejo Agendada
- **Trigger**: Al agendar nueva prueba de manejo
- **Prioridad**: MEDIA
- **Mensaje**: "Nueva prueba de manejo: [Lead] - [Modelo] el [Fecha]"
- **Metadata**: Nombre lead, modelo, fecha, ubicación
- **Acción Sugerida**: Preparar unidad y documentación

#### Servicio Técnico Agendado
- **Trigger**: Al agendar nuevo servicio
- **Prioridad**: MEDIA
- **Mensaje**: "Nuevo servicio: [Cliente] - [Tipo] el [Fecha]"
- **Metadata**: Cliente, tipo servicio, técnico, fecha
- **Acción Sugerida**: Asignar técnico y recursos

#### Recordatorio 24h Antes
- **Trigger**: Automático 1 día antes de cita
- **Prioridad**: ALTA
- **Mensaje**: "Recordatorio: [Tipo de cita] mañana con [Cliente] a las [Hora]"
- **Acción Sugerida**: Confirmación con cliente

### 3. Notificaciones de Inventario

#### Stock Bajo
- **Trigger**: Cuando stock de motocicleta <= 2 unidades
- **Prioridad**: ALTA
- **Mensaje**: "Stock Bajo: El modelo [Modelo] tiene solo X unidades en stock"
- **Metadata**: Modelo, stock actual, segmento, precio
- **Acción Sugerida**: Solicitar reabastecimiento

### 4. Notificaciones del Sistema

#### Seguimiento Pendiente
- **Trigger**: Follow-up programado para hoy
- **Prioridad**: MEDIA
- **Mensaje**: "Seguimiento programado con [Lead] para hoy"
- **Acción Sugerida**: Realizar contacto planificado

## Características del Sistema

### Gestión de Notificaciones

1. **Marcar como Leída**: Click en checkmark
2. **Marcar Todas como Leídas**: Botón en panel superior
3. **Descartar**: Botón X elimina notificación
4. **Indicador Visual**: Badge rojo con contador en icono de campana
5. **Resaltado**: Notificaciones no leídas con fondo azul claro

### Prioridades Visuales

- **ALTA**: Badge rojo con icono de alerta
- **MEDIA**: Badge naranja
- **BAJA**: Badge gris

### Categorías con Iconos

- **Lead/Score**: Icono de TrendingUp (verde/amarillo)
- **Appointment**: Icono de Calendar (azul)
- **Service**: Icono de Wrench (naranja)
- **Inventory**: Icono de Package (gris)
- **Finance**: Icono de DollarSign (verde)
- **System**: Icono de Bell (gris)

### Timestamps Inteligentes

- "Ahora" - Menos de 1 minuto
- "Hace X min" - Menos de 60 minutos
- "Hace X h" - Menos de 24 horas
- "Hace X días" - Más de 24 horas

## Arquitectura Técnica

### Componentes

1. **NotificationCenter**: Panel de notificaciones desplegable
2. **NotificationProvider**: Context provider para estado global
3. **useNotifications**: Hook personalizado para gestión
4. **notificationHelpers**: Utilidades para crear notificaciones

### Almacenamiento

- **LocalStorage**: Persistencia local en navegador
- **Key**: `quma_notifications`
- **Formato**: JSON array de notificaciones
- **Limpieza**: Notificaciones expiradas se eliminan automáticamente

### Integración con Módulos

#### LeadsModule
- Notificaciones al cambiar score
- Alertas de leads verdes
- Notificaciones de score bajo

#### SchedulingModule
- Eliminación de pestaña "Recordatorios"
- Notificaciones al agendar citas
- Alertas 24h antes de citas

#### CatalogModule
- Alertas de stock bajo
- Notificaciones de reabastecimiento

## Ventajas sobre Sistema Anterior

### Antes (Recordatorios en Agendamiento)
- Información aislada en un módulo
- Solo para servicios técnicos
- Sin priorización
- Sin contexto de urgencia
- Navegación requerida para ver

### Ahora (Sistema Centralizado)
- Visible desde cualquier módulo
- Alertas de todo el sistema
- Priorización clara (Alta/Media/Baja)
- Contexto enriquecido con metadata
- Acceso instantáneo desde header
- Notificaciones inteligentes basadas en eventos

## Flujo de Notificación Típico

### Ejemplo: Lead Verde

1. **Evento**: Lead alcanza score 80+ (Verde)
2. **Detección**: Sistema de scoring calcula cambio
3. **Creación**: `createLeadNotification()` genera notificación
4. **Emisión**: `addNotification()` agrega al contexto
5. **Visualización**: Badge rojo aparece en campana
6. **Alerta**: Usuario abre panel y ve notificación ALTA prioridad
7. **Acción**: Usuario marca como leída después de contactar
8. **Persistencia**: Estado guardado en localStorage

## Configuración de Notificaciones

### Agregar Nueva Notificación

```typescript
import { useNotificationContext } from '../context/NotificationContext';

const { addNotification } = useNotificationContext();

addNotification({
  type: 'custom_type',
  title: 'Título de Notificación',
  message: 'Mensaje descriptivo detallado',
  priority: 'high', // 'high' | 'medium' | 'low'
  category: 'lead', // 'lead' | 'appointment' | 'service' | 'score' | 'system' | 'finance' | 'inventory'
  entity_type: 'tipo_entidad',
  metadata: {
    campo1: 'valor1',
    campo2: 'valor2'
  }
});
```

### Helpers Predefinidos

Usa las funciones en `notificationHelpers.ts`:

- `createLeadNotification()`
- `createStockNotification()`
- `createAppointmentReminderNotification()`
- `createFollowUpNotification()`

## Mejoras Futuras Planificadas

### Corto Plazo
1. Integración con Supabase Realtime para sincronización multi-usuario
2. Notificaciones push en navegador
3. Configuración de preferencias por usuario
4. Filtros por categoría en panel

### Mediano Plazo
1. Historial de notificaciones archivadas
2. Búsqueda en notificaciones
3. Agrupación inteligente de notificaciones similares
4. Estadísticas de tiempo de respuesta

### Largo Plazo
1. Integración con WhatsApp/Email para notificaciones externas
2. Machine Learning para priorización adaptativa
3. Notificaciones predictivas basadas en patrones
4. Dashboard de métricas de notificaciones

## Métricas de Éxito

- **Tiempo de Respuesta**: Reducción del tiempo entre alerta y acción
- **Conversión de Leads Verdes**: Aumento por contacto inmediato
- **Gestión de Stock**: Reducción de faltantes por alertas tempranas
- **Satisfacción de Usuario**: Menos citas olvidadas, mejor organización

## Soporte y Mantenimiento

### Limpieza Automática
- Notificaciones sin `expires_at`: Permanecen hasta descarte manual
- Notificaciones con `expires_at`: Se eliminan automáticamente al cargar
- Intervalo de actualización: 30 segundos

### Debug
Para ver notificaciones en consola:
```javascript
JSON.parse(localStorage.getItem('quma_notifications'))
```

Para limpiar todas las notificaciones:
```javascript
localStorage.removeItem('quma_notifications')
```

## Conclusión

El sistema de notificaciones centralizado mejora significativamente la capacidad del equipo para responder rápidamente a eventos críticos del negocio, eliminando la necesidad de navegar entre módulos para encontrar información urgente. La priorización inteligente asegura que las alertas más importantes reciban atención inmediata, mejorando la eficiencia operativa y la satisfacción del cliente.
