import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionContextType {
    isOnline: boolean;
    isReconnecting: boolean;
    refreshKey: number;
    checkConnection: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export function ConnectionProvider({ children }: { children: ReactNode }) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [showReconnectedToast, setShowReconnectedToast] = useState(false);

    // Track last active time to avoid unnecessary refreshes on quick tab switches
    const lastActiveRef = useRef<number>(Date.now());
    const documentVisibleRef = useRef<boolean>(!document.hidden);

    const checkConnection = async (force: boolean = false) => {
        if (isReconnecting && !force) return;

        // Don't check if we just checked recently (e.g. < 5 seconds)
        const now = Date.now();
        if (!force && now - lastActiveRef.current < 5000 && documentVisibleRef.current) {
            return;
        }

        lastActiveRef.current = now;
        setIsReconnecting(true);
        console.log('🔄 Checking connection and session validity...');

        try {
            // 1. Check network status first
            if (!navigator.onLine) {
                setIsOnline(false);
                setIsReconnecting(false);
                return;
            }

            // 2. Check Supabase session
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error || !session) {
                console.warn('⚠️ Session invalid or expired during check:', error);
                // Attempt refresh if possible, otherwise auth state change listener in AuthContext handles logout
                const { error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError) {
                    console.error('❌ Session refresh failed:', refreshError);
                }
            } else {
                console.log('✅ Session valid');
                // Only increment refresh key (forcing UI reload) if we haven't refreshed in a while (> 5 mins)
                // or if we are coming back from offline
                // For now, simpler approach: if this check was triggered by "coming back", we might want to refresh data.
                // Let's use a simple counter that components can depend on.
                setRefreshKey(prev => prev + 1);

                // Show "Back Online" toast if we were offline or it's a significant recovery
                if (!isOnline) {
                    setIsOnline(true);
                    setShowReconnectedToast(true);
                    setTimeout(() => setShowReconnectedToast(false), 3000);
                }
            }
        } catch (err) {
            console.error('Error checking connection:', err);
        } finally {
            setIsReconnecting(false);
            setIsOnline(navigator.onLine);
        }
    };

    useEffect(() => {
        const handleOnline = () => {
            console.log('📶 Network is online');
            setIsOnline(true);
            checkConnection(true);
        };

        const handleOffline = () => {
            console.log('📴 Network is offline');
            setIsOnline(false);
        };

        const handleVisibilityChange = () => {
            documentVisibleRef.current = !document.hidden;
            if (!document.hidden) {
                console.log('👁️ Tab became visible');
                // Check if we've been gone for a while (e.g., > 1 minute)
                const now = Date.now();
                const timeSinceLastActive = now - lastActiveRef.current;

                if (timeSinceLastActive > 60000) { // 1 minute
                    console.log(`⏱️ Inactive for ${Math.round(timeSinceLastActive / 1000)}s, triggering recovery...`);
                    checkConnection(true); // Force check
                } else {
                    lastActiveRef.current = now; // Just update timestamp
                }
            } else {
                lastActiveRef.current = Date.now();
            }
        };

        const handleFocus = () => {
            if (documentVisibleRef.current) {
                // similar logic to visibility change, often redundant but good fallback
                handleVisibilityChange();
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);

        // Initial check
        checkConnection();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    return (
        <ConnectionContext.Provider value={{ isOnline, isReconnecting, refreshKey, checkConnection }}>
            {children}

            {/* Global Connection Status Indicators */}
            <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
                {/* Offline Indicator */}
                {!isOnline && (
                    <div className="bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
                        <WifiOff className="w-5 h-5" />
                        <span className="font-semibold text-sm">Sin conexión a internet</span>
                    </div>
                )}

                {/* Reconnecting Indicator */}
                {isReconnecting && isOnline && (
                    <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span className="font-semibold text-sm">Reconectando...</span>
                    </div>
                )}

                {/* Create "Back Online" Toast */}
                {showReconnectedToast && (
                    <div className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-5 fade-in duration-300">
                        <Wifi className="w-5 h-5" />
                        <span className="font-semibold text-sm">Conexión restablecida</span>
                    </div>
                )}
            </div>
        </ConnectionContext.Provider>
    );
}

export function useConnection() {
    const context = useContext(ConnectionContext);
    if (context === undefined) {
        throw new Error('useConnection must be used within a ConnectionProvider');
    }
    return context;
}
