import { useState, useEffect } from 'react';
import type { Notification } from '../components/NotificationCenter';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    loadNotifications();

    const interval = setInterval(() => {
      loadNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadNotifications = () => {
    const stored = localStorage.getItem('quma_notifications');
    if (stored) {
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
    }
  };

  const saveNotifications = (updatedNotifications: Notification[]) => {
    localStorage.setItem('quma_notifications', JSON.stringify(updatedNotifications));
    setNotifications(updatedNotifications);
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

  return {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll
  };
}
