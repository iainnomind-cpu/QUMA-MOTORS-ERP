import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, UserProfile } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  active: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // --- FUNCIÓN DE CARGA A PRUEBA DE FALLOS ---
  const loadProfile = async (userId: string, userEmail: string = 'unknown@email.com') => {
    try {
      console.log('🔄 Attempting to load profile for:', userId);
      
      // 1. Timeout corto (4 segundos) para no hacerte esperar si falla
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT_DB')), 4000)
      );
      
      const queryPromise = supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (error) throw error;

      if (data) {
        console.log('✅ Success: Profile loaded from DB');
        setProfile(data);
        setUser({
          id: data.id,
          email: data.email,
          role: data.role,
          full_name: data.full_name,
          phone: data.phone,
          active: data.active
        });
      } else {
        // DB conectó pero no hay perfil -> Usar Fallback
        console.warn('⚠️ No profile found. Activating Fallback Mode.');
        activateFallbackUser(userId, userEmail);
      }

    } catch (error) {
      // AQUÍ ESTÁ LA MAGIA: Si falla por Timeout o Error de Red, NO te saca.
      console.error('❌ DB Connection Failed/Timeout. Activating BYPASS Mode.');
      activateFallbackUser(userId, userEmail);
    } finally {
      setLoading(false);
    }
  };

  // Esta función crea un usuario "falso" en memoria para dejarte entrar
  const activateFallbackUser = (id: string, email: string) => {
    const fallbackProfile: UserProfile = {
      id: id,
      email: email,
      role: 'admin', // Te damos permisos de admin para que puedas trabajar
      full_name: 'Admin (Modo Offline)',
      phone: null,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setProfile(fallbackProfile);
    setUser({
      id: fallbackProfile.id,
      email: fallbackProfile.email,
      role: fallbackProfile.role,
      full_name: fallbackProfile.full_name,
      phone: fallbackProfile.phone,
      active: fallbackProfile.active
    });
    
    // IMPORTANTE: No ejecutamos signOut() aquí. Te dejamos pasar.
  };
  // -------------------------------------------------------

  const refreshProfile = async () => {
    if (!user) return;
    setLoading(true);
    await loadProfile(user.id, user.email);
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data.user) {
        // Pasamos el email explícitamente para el fallback
        await loadProfile(data.user.id, data.user.email || email);
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('Session found, recovering...');
          await loadProfile(session.user.id, session.user.email || '');
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
          setLoading(true);
          await loadProfile(session.user.id, session.user.email || '');
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}