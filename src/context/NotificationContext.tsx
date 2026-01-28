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
          event: 'INSERT',
          schema: 'public',
          table: 'leads'
        },
        async (payload) => {
          console.log('✅ Nuevo lead detectado:', payload);
          const newLead = payload.new;
          
          // Solo crear notificación si el lead tiene agente asignado
          if (newLead.assigned_agent_id) {
            try {
              // Obtener información del agente
              const { data: agent, error: agentError } = await supabase
                .from('sales_agents')
                .select('name, email')
                .eq('id', newLead.assigned_agent_id)
                .single();

              if (agentError) {
                console.error('Error al obtener agente:', agentError);
              }

              // Crear notificación
              const notification: Omit<Notification, 'id' | 'is_read' | 'created_at'> = {
                type: 'new_lead_assigned',
                title: '🎯 Nuevo Lead Asignado',
                message: `Lead "${newLead.name}" ha sido asignado a ${agent?.name || 'un agente'}. Score: ${newLead.score}/100 (${newLead.status})`,
                priority: newLead.status === 'Verde' ? 'high' : newLead.status === 'Amarillo' ? 'medium' : 'low',
                category: 'lead',
                entity_type: 'lead',
                entity_id: newLead.id,
                metadata: {
                  lead_id: newLead.id,
                  lead_name: newLead.name,
                  agent_id: newLead.assigned_agent_id,
                  agent_name: agent?.name || 'Agente',
                  score: newLead.score,
                  status: newLead.status,
                  model: newLead.model_interested,
                  phone: newLead.phone,
                  timeframe: newLead.timeframe,
                  origin: newLead.origin
                }
              };

              console.log('📢 Creando notificación:', notification);
              addNotification(notification);
            } catch (error) {
              console.error('Error al procesar notificación de lead:', error);
            }
          } else {
            console.log('⚠️ Lead sin agente asignado, no se crea notificación');
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
  }, []); // Solo se ejecuta una vez al montar

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
    
    console.log('✅ Notificación agregada:', newNotification.title);
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
