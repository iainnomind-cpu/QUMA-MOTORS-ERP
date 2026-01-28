import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import type { Notification } from '../components/NotificationCenter';
import { supabase } from '../lib/supabase';

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'is_read' | 'created_at'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [processedLeads, setProcessedLeads] = useState<Set<string>>(new Set());

  // Cargar notificaciones iniciales y limpiar expiradas
  useEffect(() => {
    loadNotifications();
    
    // Actualizar cada 30 segundos
    const interval = setInterval(() => {
      loadNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Suscripción a cambios en tiempo real en la tabla leads
  useEffect(() => {
    console.log('🔔 Iniciando suscripción a notificaciones en tiempo real...');
    
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
          console.log('✅ Evento detectado en leads:', payload.eventType, payload);
          
          const lead = payload.new;
          const leadId = lead.id;

          // Solo procesar si tiene agente asignado y no lo hemos procesado antes
          if (lead.assigned_agent_id && !processedLeads.has(leadId)) {
            console.log('📢 Lead con agente asignado detectado:', leadId);
            
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

              // Crear notificación
              const notification: Omit<Notification, 'id' | 'is_read' | 'created_at'> = {
                type: 'new_lead_assigned',
                title: '🎯 Nuevo Lead Asignado',
                message: `Lead "${lead.name}" ha sido asignado a ${agentName}. Score: ${lead.score}/100 (${lead.status})`,
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
                  timeframe: lead.timeframe,
                  origin: lead.origin
                }
              };

              console.log('📬 Creando notificación:', notification.title);
              addNotification(notification);
            } catch (error) {
              console.error('Error al procesar notificación de lead:', error);
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
  }, [processedLeads]); // Agregar processedLeads como dependencia

  const loadNotifications = () => {
    const stored = localStorage.getItem('quma_notifications');
    if (stored) {
      try {
        const parsedNotifications: Notification[] = JSON.parse(stored);
        const validNotifications = parsedNotifications.filter(n => {
          if (n.expires_at) {
            return new Date(n.expires_at) > new Date();
          }
          return true;
        });
        setNotifications(validNotifications.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      } catch (error) {
        console.error('Error al cargar notificaciones:', error);
        setNotifications([]);
      }
    }
  };

  const saveNotifications = (updatedNotifications: Notification[]) => {
    try {
      localStorage.setItem('quma_notifications', JSON.stringify(updatedNotifications));
      setNotifications(updatedNotifications);
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

    const updated = [newNotification, ...notifications];
    saveNotifications(updated);
    
    console.log('✅ Notificación agregada exitosamente:', newNotification.title);
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
