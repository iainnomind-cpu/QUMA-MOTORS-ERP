# Sistema de Scoring Dinámico - QuMa Motors CRM

## Descripción General

El sistema de scoring dinámico ajusta automáticamente la calificación de los leads (0-100 puntos) basándose en sus interacciones, comportamiento y cambios en preferencias. Cada acción tiene un valor específico que refleja la probabilidad de conversión.

## Clasificación de Leads por Score

- **Verde (80-100 puntos)**: Alta probabilidad de conversión, trámite activo
- **Amarillo (60-79 puntos)**: Interés medio, en proceso de seguimiento
- **Rojo (0-59 puntos)**: Requiere nutrición, baja urgencia

## Factores de Ajuste de Score

### 1. Interacciones

#### Por Dirección
- **Inbound (Lead nos contacta)**: +8 puntos
  - Demuestra iniciativa e interés activo
- **Outbound (Nosotros contactamos)**: +3 puntos
  - Seguimiento exitoso del equipo

#### Por Canal
- **Presencial (In-Person)**: +12 puntos
  - Máximo compromiso, visita física
- **Teléfono (Phone)**: +7 puntos
  - Contacto directo de alta calidad
- **WhatsApp**: +5 puntos
  - Canal moderno, alta receptividad
- **Email**: +3 puntos
  - Comunicación formal
- **Redes Sociales**: +2 puntos
  - Interés inicial

#### Por Tipo de Interacción
- **Prueba de Manejo (test_drive)**: +20 puntos
  - Señal más fuerte de intención de compra
- **Reunión (meeting)**: +15 puntos
  - Compromiso formal agendado
- **Cotización (quotation)**: +10 puntos
  - Interés comercial concreto
- **Llamada (call)**: +5 puntos
  - Comunicación bidireccional
- **Nota (note)**: +2 puntos
  - Registro de seguimiento

#### Combinaciones Efectivas
Ejemplos de ajustes combinados:
- Lead llama + solicita prueba de manejo: **+28 puntos** (8 inbound + 20 test_drive)
- Reunión presencial programada: **+27 puntos** (12 presencial + 15 reunión)
- Cotización vía WhatsApp solicitada: **+18 puntos** (8 inbound + 5 WhatsApp + 10 cotización - ajuste por superposición)

### 2. Seguimientos Programados

- **Seguimiento completado**: +6 puntos
  - Demuestra progreso en el pipeline
- **Seguimiento no completado**: -3 puntos
  - Indica baja receptividad o falta de interés

### 3. Cambios en Preferencias

#### Timeframe
- **Cambio Futuro → Inmediato**: +15 puntos
  - Urgencia de compra aumentada
- **Cambio Inmediato → Futuro**: -10 puntos
  - Reducción de urgencia

#### Financiamiento
- **Selecciona "Yamaha Especial"**: +12 puntos
  - Mejor opción de financiamiento, mayor probabilidad de cierre
- **Cambia de "Yamaha Especial" a otro**: -8 puntos
  - Reevaluación de condiciones

#### Modelo
- **Actualiza modelo de interés**: +3 puntos
  - Demuestra interés activo y refinamiento de preferencias

### 4. Penalizaciones por Inactividad

- **Lead antiguo (>30 días) sin progreso**: -2 puntos
  - Leads sin interacciones significativas pierden relevancia

## Casos de Uso Reales

### Caso 1: Lead Entrante Calificado
**Situación**: Lead contacta por WhatsApp, interesado en MT-07, timeframe inmediato, Yamaha Especial

**Score inicial**: 45 puntos (Rojo)

**Interacciones**:
1. Primer contacto inbound + WhatsApp: **+13 pts** → 58 puntos (Rojo)
2. Agrega timeframe inmediato + Yamaha Especial: **+27 pts** → 85 puntos (Verde)
3. Prueba de manejo completada: **+20 pts** → 100 puntos (Verde)

**Resultado**: Lead pasa de Rojo a Verde en 3 interacciones

### Caso 2: Seguimiento Efectivo
**Situación**: Lead amarillo con seguimientos activos

**Score inicial**: 65 puntos (Amarillo)

**Interacciones**:
1. Llamada outbound exitosa: **+10 pts** (3 outbound + 7 phone) → 75 puntos (Amarillo)
2. Reunión presencial agendada y completada: **+21 pts** → 96 puntos (Verde)
3. Cotización solicitada: **+10 pts** → 100 puntos (Verde)

**Resultado**: Progresión natural mediante seguimiento estructurado

### Caso 3: Lead Frío
**Situación**: Lead con más de 30 días sin interacción significativa

**Score inicial**: 62 puntos (Amarillo)

**Penalizaciones**:
- Sin interacciones en 30+ días: **-2 pts** → 60 puntos (Amarillo)
- Cambio de timeframe Inmediato → Futuro: **-10 pts** → 50 puntos (Rojo)

**Recuperación**:
- Lead contacta (inbound) + solicita información: **+10 pts** → 60 puntos (Amarillo)

## Integración en Módulos

### Módulo de Leads
- Al agregar interacciones: Ajuste automático
- Al editar preferencias: Recalculación inmediata
- Al marcar seguimientos completados: Bonus de progreso
- Modal informativo muestra ajuste y razón

### Módulo de Pipeline Kanban
- Visualización en tiempo real de cambios
- Botón de completar seguimiento con ajuste automático
- Notificaciones de cambios de score
- Movimiento automático entre columnas (Rojo/Amarillo/Verde)

### Dashboard
- Panel explicativo del sistema de scoring
- Métricas de score promedio por categoría
- Insights sobre calidad de leads basados en scoring

## Fórmula de Cálculo

```typescript
Score Final = min(100, max(0, Score Actual + Suma de Ajustes))

Categorización:
- Verde: Score >= 80
- Amarillo: 60 <= Score < 80
- Rojo: Score < 60
```

## Beneficios del Sistema

1. **Objetividad**: Elimina sesgos personales en la calificación
2. **Automatización**: Sin intervención manual, ajustes en tiempo real
3. **Transparencia**: Cada cambio muestra la razón del ajuste
4. **Priorización**: Los vendedores se enfocan en leads verdes
5. **Mejora continua**: Los pesos se pueden ajustar según conversión real
6. **Visibilidad**: Todo el equipo entiende por qué un lead es prioritario

## Próximas Mejoras

- Machine Learning para ajustar pesos automáticamente
- Integración con historial de conversión para calibración
- Predicción de tiempo hasta conversión
- Análisis de patrones de leads exitosos
- Scoring predictivo basado en datos históricos
