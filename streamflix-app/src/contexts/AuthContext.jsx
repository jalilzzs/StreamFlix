import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ensureProfile } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null);
      setAuthError(null);
      return;
    }

    try {
      const p = await ensureProfile(user);
      setProfile(p);
      setAuthError(null);
    } catch (err) {
      console.error('Failed to load/create profile:', err);
      setAuthError('We could not load your profile. Please refresh.');
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        setAuthError(error.message);
      }

      setSession(data.session);

      loadProfile(data.session?.user).finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        loadProfile(newSession?.user);

        // Reload once after successful login
        if (event === 'SIGNED_IN' && newSession) {
          const alreadyReloaded = sessionStorage.getItem(
            'streamflix_login_reloaded'
          );

          if (!alreadyReloaded) {
            sessionStorage.setItem(
              'streamflix_login_reloaded',
              'true'
            );

            window.location.reload();
          }
        }

        // Reload after logout
        if (event === 'SIGNED_OUT') {
          sessionStorage.removeItem(
            'streamflix_login_reloaded'
          );

          window.location.reload();
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setAuthError(error.message);
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
    }
  }, []);

  const refreshProfile = useCallback(
    () => loadProfile(session?.user),
    [loadProfile, session]
  );

  const value = {
    session,
    user: session?.user || null,
    profile,
    isPremium: !!profile?.is_premium,
    loading,
    authError,
    signInWithGoogle,
    signOut,
    refreshProfile,
    setProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return ctx;
}
