import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase, logActivity } from '../lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  active: boolean;
  branch_id: string | null;
}

interface UserProfile {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  active: boolean;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
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
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);
  const loadingProfileRef = useRef(false);
  const lastSignedInTimeRef = useRef(0);

  const loadProfile = async (userId: string): Promise<UserProfile | null> => {
    // Evitar cargas simultáneas - pero esperar si hay una en progreso
    if (loadingProfileRef.current) {
      console.log('⚠ Profile load already in progress, waiting for completion...');
      // Esperar máximo 15 segundos a que termine la carga en progreso
      let attempts = 0;
      while (loadingProfileRef.current && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      // Si ya se cargó el perfil, retornar el perfil
      if (user?.id === userId && profile) {
        console.log('✓ Profile already loaded during wait');
        return profile;
      }

      // Si aún está bloqueado después de 15 segundos, forzar reset
      if (loadingProfileRef.current) {
        console.warn('⚠ Profile load timeout, forcing reset');
        loadingProfileRef.current = false;
      }
    }

    loadingProfileRef.current = true;

    try {
      console.log('→ Loading profile for user:', userId);

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('Profile query result:', { hasData: !!data, hasError: !!error });

      if (error) {
        console.error('Error loading profile:', error);
        if (mountedRef.current) {
          setUser(null);
          setProfile(null);
        }
        return null;
      }

      if (data) {
        console.log('✓ Profile loaded successfully');

        if (!data.active) {
          console.error('User account is inactive');
          if (mountedRef.current) {
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
          }
          return null;
        }

        if (mountedRef.current) {
          setProfile(data);
          setUser({
            id: data.id,
            email: data.email,
            role: data.role,
            full_name: data.full_name,
            phone: data.phone,
            active: data.active,
            branch_id: data.branch_id || null
          });
        }
        return data;
      } else {
        console.error('No profile data found');
        if (mountedRef.current) {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
        }
        return null;
      }
    } catch (error) {
      console.error('Exception loading profile:', error);
      if (mountedRef.current) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
      }
      return null;
    } finally {
      loadingProfileRef.current = false;
      console.log('Profile load lock released');
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await loadProfile(user.id);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        const loadedProfile = await loadProfile(data.user.id);
        if (!loadedProfile) {
          throw new Error('No se pudo cargar el perfil del usuario');
        }

        // Log login activity
        await logActivity({
          userId: loadedProfile.id,
          userName: loadedProfile.full_name || loadedProfile.email,
          userEmail: loadedProfile.email,
          userRole: loadedProfile.role,
          branchId: loadedProfile.branch_id,
          actionType: 'login',
          entityType: 'auth',
          details: { action: 'Inicio de sesión' }
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const signOut = async () => {
    try {
      if (user) {
        // Log logout activity before clearing session
        await logActivity({
          userId: user.id,
          userName: user.full_name || user.email,
          userEmail: user.email,
          userRole: user.role,
          branchId: user.branch_id,
          actionType: 'logout',
          entityType: 'auth',
          details: { action: 'Cierre de sesión' }
        });
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      if (mountedRef.current) {
        setUser(null);
        setProfile(null);
      }
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    const initializeAuth = async () => {
      if (initializedRef.current) {
        console.log('Already initialized, skipping...');
        return;
      }

      try {
        console.log('Initializing auth...');

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          if (mountedRef.current) {
            setLoading(false);
          }
          return;
        }

        if (session?.user) {
          console.log('Session found, loading profile...');
          const success = await loadProfile(session.user.id);
          console.log('Profile load success:', success);
        } else {
          console.log('No session found');
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        initializedRef.current = true;
        if (mountedRef.current) {
          console.log('Initialization complete, setting loading to false');
          setLoading(false);
        }
      }
    };

    if (!user) {
      console.log('→ No user loaded, initializing auth...');
      initializeAuth();
    } else {
      console.log('✓ User already loaded, skipping initialization:', { userId: user.id, email: user.email });
      initializedRef.current = true;
      setLoading(false);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);

        if (!initializedRef.current) {
          console.log('Still initializing, ignoring event');
          return;
        }

        if (event === 'INITIAL_SESSION') {
          console.log('Ignoring INITIAL_SESSION');
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('User signed in event received, userId:', session.user.id);
          console.log('Current user state:', { hasUser: !!user, hasProfile: !!profile, userId: user?.id });

          if (user?.id === session.user.id && profile) {
            console.log('✓ User already authenticated and loaded, ignoring SIGNED_IN event');
            return;
          }

          const now = Date.now();
          if (now - lastSignedInTimeRef.current < 5000) {
            console.log('⚠ Duplicate SIGNED_IN event detected (within 5s), ignoring');
            return;
          }
          lastSignedInTimeRef.current = now;

          console.log('→ New sign in detected, loading profile...');
          if (mountedRef.current) {
            setLoading(true);
            console.log('Loading state set to true');
          }

          try {
            const success = await loadProfile(session.user.id);
            console.log('SIGNED_IN: Profile load result:', success);
          } catch (error) {
            console.error('SIGNED_IN: Error loading profile:', error);
          } finally {
            console.log('SIGNED_IN: Finally block executing, mountedRef:', mountedRef.current);
            if (mountedRef.current) {
              console.log('SIGNED_IN: Setting loading to false');
              setLoading(false);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          if (mountedRef.current) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('Token refreshed, silently loading profile...');
          try {
            await loadProfile(session.user.id);
          } catch (error) {
            console.error('Error refreshing profile after token refresh:', error);
          }
        }
      }
    );

    return () => {
      console.log('🧹 Cleaning up AuthProvider');
      mountedRef.current = false;
      loadingProfileRef.current = false;
      if (!user) {
        initializedRef.current = false;
      }
      subscription.unsubscribe();
    };
  }, [user, profile, loading]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signOut,
        refreshProfile
      }}
    >
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