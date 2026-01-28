import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import type { Notification } from '../components/NotificationCenter';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'is_read' | 'created_at'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Función helper para generar el mensaje de notificación
function generateLeadNotificationMessage(lead: any): string {
  const statusEmoji = {
    'Verde': '🟢',
    'Amarillo': '🟡',
    'Rojo': '🔴'
  }[lead.status] || '⚪';

  const priorityText = {
    'Verde': 'Prioridad Alta',
    'Amarillo': 'Prioridad Media',
    'Rojo': 'Prioridad Baja'
  }[lead.status] || 'Prioridad Normal';

  const timeframeText = lead.timeframe ? `, Timeframe: ${lead.timeframe}` : '';
  const modelText = lead.model_interested || 'No especificado';
  const contactInfo = lead.phone || lead.email || 'Sin contacto';
  
  // Acción sugerida según el status
  const suggestedAction = {
    'Verde': '🎯 Contactar de inmediato para mantener el interés alto y agendar cita.',
    'Amarillo': '📞 Realizar seguimiento pronto para identificar objeciones y convertir.',
    'Rojo': '📧 Nutrir con información del modelo de interés y beneficios de financiamiento.'
  }[lead.status] || 'Realizar seguimiento según disponibilidad.';

  return `👤 Nombre: ${lead.name}
📊 Calificación: ${lead.score}/100 (${priorityText} ${statusEmoji})
🏍️ Interés: ${modelText}${timeframeText}
📱 Contacto: ${contactInfo}
💡 Origen: ${lead.origin || 'No especificado'}

${suggestedAction}`;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [processedLeads, setProcessedLeads] = useState<Set<string>>(new Set());
  const [salesAgentId, setSalesAgentId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const { user } = useAuth();

  // Función para obtener la key de localStorage según el usuario
  const getStorageKey = () => {
    if (!user?.id) return 'quma_notifications';
    return `quma_notifications_${user.id}`;
  };

  // Obtener el sales_agent_id del usuario autenticado usando su email
  useEffect(() => {
    if (!user?.email) {
      setSalesAgentId(null);
      return;
    }

    const fetchSalesAgentId = async () => {
      try {
        console.log('🔍 Buscando sales_agent por email:', user.email);
        
        const { data, error } = await supabase
          .from('sales_agents')
          .select('id, name, email')
          .eq('email', user.email)
          .eq('status', 'active')
          .single();

        if (error) {
          console.error('Error al buscar sales_agent:', error);
          setSalesAgentId(null);
          return;
        }

        if (data) {
          console.log('✅ Sales Agent encontrado:', data.id, '-', data.name);
          setSalesAgentId(data.id);
        } else {
          console.log('⚠️ No se encontró sales_agent para este email');
          setSalesAgentId(null);
        }
      } catch (error) {
        console.error('Error al obtener sales_agent_id:', error);
        setSalesAgentId(null);
      }
    };

    fetchSalesAgentId();
  }, [user?.email]);

  // Cargar historial de leads para admin al iniciar sesión
  useEffect(() => {
    if (!user || historyLoaded) return;

    const loadLeadsHistory = async () => {
      if (user.role === 'admin') {
        console.log('📚 Admin detectado - Cargando historial de leads asignados...');
        
        try {
          // Obtener leads creados en las últimas 24 horas con agente asignado
          const twentyFourHoursAgo = new Date();
          twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

          const { data: recentLeads, error } = await supabase
            .from('leads')
            .select(`
              id,
              name,
              score,
              status,
              model_interested,
              phone,
              email,
              timeframe,
              origin,
              financing_type,
              assigned_agent_id,
              created_at
            `)
            .not('assigned_agent_id', 'is', null)
            .gte('created_at', twentyFourHoursAgo.toISOString())
            .order('created_at', { ascending: false });

          if (error) {
            console.error('Error al cargar historial de leads:', error);
            return;
          }

          if (recentLeads && recentLeads.length > 0) {
            console.log(`📋 ${recentLeads.length} leads asignados encontrados en las últimas 24h`);

            // Obtener información de todos los agentes
            const agentIds = [...new Set(recentLeads.map(l => l.assigned_agent_id))];
            const { data: agents } = await supabase
              .from('sales_agents')
              .select('id, name')
              .in('id', agentIds);

            const agentMap = new Map(agents?.map(a => [a.id, a.name]) || []);

            // Crear notificaciones para cada lead
            const historyNotifications: Notification[] = recentLeads.map(lead => {
              const agentName = agentMap.get(lead.assigned_agent_id!) || 'Agente';
              const detailedMessage = generateLeadNotificationMessage(lead);

              return {
                id: `hist_${lead.id}`,
                type: 'new_lead_assigned',
                title: `¡Nuevo Lead Asignado! 🚀 - ${agentName}`,
                message: detailedMessage,
                priority: lead.status === 'Verde' ? 'high' : lead.status === 'Amarillo' ? 'medium' : 'low',
                category: 'lead' as const,
                entity_type: 'lead',
                entity_id: lead.id,
                metadata: {
                  lead_id: lead.id,
                  lead_name: lead.name,
                  agent_id: lead.assigned_agent_id,
                  agent_name: agentName,
                  score: lead.score,
                  status: lead.status,
                  model: lead.model_interested,
                  phone: lead.phone,
                  email: lead.email,
                  timeframe: lead.timeframe,
                  origin: lead.origin,
                  financing_type: lead.financing_type
                },
                is_read: false,
                created_at: lead.created_at
              };
            });

            // Cargar notificaciones existentes del localStorage
            const existingNotifications = loadNotifications(false);
            
            // Combinar historial con notificaciones existentes (evitar duplicados)
            const existingIds = new Set(existingNotifications.map(n => n.entity_id));
            const newHistoryNotifications = historyNotifications.filter(
              n => !existingIds.has(n.entity_id)
            );

            if (newHistoryNotifications.length > 0) {
              console.log(`✅ Agregando ${newHistoryNotifications.length} notificaciones de historial`);
              const combined = [...newHistoryNotifications, ...existingNotifications];
              saveNotifications(combined);
            } else {
              console.log('ℹ️ Todas las notificaciones de historial ya existen');
            }

            // Marcar todos los leads como procesados
            const leadIds = recentLeads.map(l => l.id);
            setProcessedLeads(new Set(leadIds));
          } else {
            console.log('ℹ️ No hay leads asignados en las últimas 24h');
          }
        } catch (error) {
          console.error('Error al cargar historial:', error);
        } finally {
          setHistoryLoaded(true);
        }
      } else {
        setHistoryLoaded(true);
      }
    };

    loadLeadsHistory();
  }, [user?.id, user?.role, historyLoaded]);

  // Cargar notificaciones iniciales del localStorage
  useEffect(() => {
    loadNotifications();
    
    // Actualizar cada 30 segundos
    const interval = setInterval(() => {
      loadNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.id]);

  // Suscripción a cambios en tiempo real en la tabla leads
  useEffect(() => {
    if (!user?.email) {
      console.log('⚠️ No hay usuario autenticado, no se puede suscribir a notificaciones');
      return;
    }

    console.log('🔔 Iniciando suscripción a notificaciones en tiempo real...');
    console.log('👤 Usuario:', user.email, '- Rol:', user.role);
    console.log('🆔 Sales Agent ID:', salesAgentId);
    
    const channel = supabase
      .channel('leads-notifications')
      .on(
        'postgres_changes',
        {
          event: '*', // Escuchar INSERT y UPDATE
          schema: 'public',
          table: 'leads'
        },
        async (payload) => {
          console.log('✅ Evento detectado en leads:', payload.eventType);
          
          const lead = payload.new;
          const leadId = lead.id;

          // Solo procesar si tiene agente asignado y no lo hemos procesado antes
          if (lead.assigned_agent_id && !processedLeads.has(leadId)) {
            console.log('📢 Lead con agente asignado detectado:', leadId);
            console.log('🔍 Agente asignado al lead:', lead.assigned_agent_id);
            console.log('🔍 Sales Agent ID del usuario:', salesAgentId);
            console.log('🔍 Rol del usuario:', user.role);
            
            // Verificar si el lead es para este usuario
            const isAdmin = user.role === 'admin';
            const isAssignedToCurrentUser = salesAgentId && lead.assigned_agent_id === salesAgentId;

            console.log('✓ Es admin?', isAdmin);
            console.log('✓ Asignado a usuario actual?', isAssignedToCurrentUser);

            // Solo mostrar notificación si:
            // 1. El usuario es admin (ve todos los leads)
            // 2. O el lead está asignado al sales_agent de este usuario
            if (isAdmin || isAssignedToCurrentUser) {
              console.log('✅ Notificación PERMITIDA para este usuario');
              
              // Marcar como procesado
              setProcessedLeads(prev => new Set(prev).add(leadId));
              
              try {
                // Obtener información del agente
                const { data: agent, error: agentError } = await supabase
                  .from('sales_agents')
                  .select('name, email')
                  .eq('id', lead.assigned_agent_id)
                  .single();

                if (agentError) {
                  console.error('Error al obtener agente:', agentError);
                }

                const agentName = agent?.name || 'un agente';

                // Generar mensaje detallado
                const detailedMessage = generateLeadNotificationMessage(lead);

                // Crear notificación
                const notification: Omit<Notification, 'id' | 'is_read' | 'created_at'> = {
                  type: 'new_lead_assigned',
                  title: `¡Nuevo Lead Asignado! 🚀 - ${agentName}`,
                  message: detailedMessage,
                  priority: lead.status === 'Verde' ? 'high' : lead.status === 'Amarillo' ? 'medium' : 'low',
                  category: 'lead',
                  entity_type: 'lead',
                  entity_id: leadId,
                  metadata: {
                    lead_id: leadId,
                    lead_name: lead.name,
                    agent_id: lead.assigned_agent_id,
                    agent_name: agentName,
                    score: lead.score,
                    status: lead.status,
                    model: lead.model_interested,
                    phone: lead.phone,
                    email: lead.email,
                    timeframe: lead.timeframe,
                    origin: lead.origin,
                    financing_type: lead.financing_type
                  }
                };

                console.log('📬 Creando notificación:', notification.title);
                addNotification(notification);
              } catch (error) {
                console.error('Error al procesar notificación de lead:', error);
              }
            } else {
              console.log('🚫 Notificación BLOQUEADA - Lead no asignado a este usuario');
              console.log('   - Lead asignado a:', lead.assigned_agent_id);
              console.log('   - Usuario es sales_agent:', salesAgentId);
              console.log('   - Coinciden?', lead.assigned_agent_id === salesAgentId);
            }
          } else if (!lead.assigned_agent_id) {
            console.log('⚠️ Lead sin agente asignado (aún), esperando UPDATE...');
          } else {
            console.log('ℹ️ Lead ya procesado:', leadId);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Estado de suscripción:', status);
      });

    return () => {
      console.log('🔌 Desconectando suscripción de notificaciones...');
      supabase.removeChannel(channel);
    };
  }, [processedLeads, user?.email, user?.role, salesAgentId]);

  const loadNotifications = (updateState = true) => {
    const storageKey = getStorageKey();
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      try {
        const parsedNotifications: Notification[] = JSON.parse(stored);
        const validNotifications = parsedNotifications.filter(n => {
          if (n.expires_at) {
            return new Date(n.expires_at) > new Date();
          }
          return true;
        });
        
        const sortedNotifications = validNotifications.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        if (updateState) {
          setNotifications(sortedNotifications);
        }
        
        return sortedNotifications;
      } catch (error) {
        console.error('Error al cargar notificaciones:', error);
        if (updateState) {
          setNotifications([]);
        }
        return [];
      }
    }
    
    if (updateState) {
      setNotifications([]);
    }
    return [];
  };

  const saveNotifications = (updatedNotifications: Notification[]) => {
    try {
      const storageKey = getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(updatedNotifications));
      setNotifications(updatedNotifications);
      console.log(`💾 Guardadas ${updatedNotifications.length} notificaciones en ${storageKey}`);
    } catch (error) {
      console.error('Error al guardar notificaciones:', error);
    }
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'is_read' | 'created_at'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      is_read: false,
      created_at: new Date().toISOString()
    };

    // Agregar al inicio del array (más reciente primero)
    const updated = [newNotification, ...notifications];
    saveNotifications(updated);
    
    console.log('✅ Notificación agregada exitosamente:', newNotification.title);
    console.log(`📊 Total de notificaciones: ${updated.length}`);
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map(n =>
      n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
    );
    saveNotifications(updated);
  };

  const markAllAsRead = () => {
    const updated = notifications.map(n => ({
      ...n,
      is_read: true,
      read_at: new Date().toISOString()
    }));
    saveNotifications(updated);
  };

  const dismissNotification = (id: string) => {
    const updated = notifications.filter(n => n.id !== id);
    saveNotifications(updated);
  };

  const clearAll = () => {
    saveNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      markAsRead,
      markAllAsRead,
      dismissNotification,
      clearAll
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
}
