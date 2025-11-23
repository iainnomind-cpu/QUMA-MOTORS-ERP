import { useState, useEffect } from 'react';
import { Bell, X, Check, CheckCheck, AlertTriangle, TrendingUp, Calendar, Wrench, Package, DollarSign } from 'lucide-react';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  category: 'lead' | 'appointment' | 'service' | 'score' | 'system' | 'finance' | 'inventory';
  entity_type?: string;
  entity_id?: string;
  metadata: Record<string, any>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  expires_at?: string;
}

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDismiss: (id: string) => void;
}

export function NotificationCenter({ notifications, onMarkAsRead, onMarkAllAsRead, onDismiss }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'lead':
      case 'score':
        return <TrendingUp className="w-5 h-5" />;
      case 'appointment':
        return <Calendar className="w-5 h-5" />;
      case 'service':
        return <Wrench className="w-5 h-5" />;
      case 'inventory':
        return <Package className="w-5 h-5" />;
      case 'finance':
        return <DollarSign className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category: string, priority: string) => {
    if (priority === 'high') {
      return 'bg-red-50 border-red-300 text-red-800';
    }
    switch (category) {
      case 'lead':
        return 'bg-green-50 border-green-300 text-green-800';
      case 'score':
        return 'bg-yellow-50 border-yellow-300 text-yellow-800';
      case 'appointment':
        return 'bg-blue-50 border-blue-300 text-blue-800';
      case 'service':
        return 'bg-orange-50 border-orange-300 text-orange-800';
      case 'inventory':
        return 'bg-gray-50 border-gray-300 text-gray-800';
      default:
        return 'bg-gray-50 border-gray-300 text-gray-800';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <span className="text-xs font-bold text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />URGENTE</span>;
      case 'medium':
        return <span className="text-xs font-semibold text-orange-600">MEDIO</span>;
      case 'low':
        return <span className="text-xs text-gray-500">BAJO</span>;
      default:
        return null;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    return `Hace ${diffDays} días`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-12 w-96 bg-white rounded-xl shadow-2xl border-2 border-gray-200 z-50 max-h-[600px] flex flex-col">
            <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-white" />
                <h3 className="font-bold text-white">Notificaciones</h3>
                {unreadCount > 0 && (
                  <span className="bg-white text-blue-600 text-xs font-bold px-2 py-1 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-blue-800 rounded-full p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {notifications.length > 0 && unreadCount > 0 && (
              <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
                <button
                  onClick={onMarkAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                >
                  <CheckCheck className="w-4 h-4" />
                  Marcar todas como leídas
                </button>
              </div>
            )}

            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-medium">No hay notificaciones</p>
                  <p className="text-xs mt-1">Todas las alertas aparecerán aquí</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        !notification.is_read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg border ${getCategoryColor(notification.category, notification.priority)}`}>
                          {getCategoryIcon(notification.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className={`text-sm font-bold ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                              {notification.title}
                            </h4>
                            {getPriorityBadge(notification.priority)}
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">
                              {formatTimeAgo(notification.created_at)}
                            </span>
                            <div className="flex gap-2">
                              {!notification.is_read && (
                                <button
                                  onClick={() => onMarkAsRead(notification.id)}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                  title="Marcar como leída"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => onDismiss(notification.id)}
                                className="text-xs text-gray-400 hover:text-red-600 font-medium"
                                title="Descartar"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
