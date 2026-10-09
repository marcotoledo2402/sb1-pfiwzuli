import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Business, Settings } from './types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  business: Business | null;
  settings: Settings | null;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshBusiness: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  async function loadBusinessAndSettings(userId: string) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setBusiness(biz as Business | null);

    const { data: set } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setSettings(set as Settings | null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadBusinessAndSettings(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        (async () => {
          await loadBusinessAndSettings(sess.user.id);
          setLoading(false);
        })();
      } else {
        setBusiness(null);
        setSettings(null);
        setLoading(false);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: translateAuthError(error.message) };
    if (data.user) {
      await ensureBusinessAndSettings(data.user.id);
    }
    return { error: null };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setBusiness(null);
    setSettings(null);
  }

  async function refreshBusiness() {
    if (user) await loadBusinessAndSettings(user.id);
  }

  return (
    <AuthContext.Provider
      value={{ user, session, loading, business, settings, signUp, signIn, signOut, refreshBusiness }}
    >
      {children}
    </AuthContext.Provider>
  );
}

async function ensureBusinessAndSettings(userId: string) {
  const { data: existingBiz } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!existingBiz) {
    await supabase.from('businesses').insert({ user_id: userId });
  }

  const { data: existingSettings } = await supabase
    .from('settings')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!existingSettings) {
    await supabase.from('settings').insert({ user_id: userId });
  }
}

function translateAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (msg.includes('User already registered')) return 'Ya existe una cuenta con este email.';
  if (msg.includes('Password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (msg.includes('Unable to validate email')) return 'El email no es válido.';
  return 'Ocurrió un error. Intentá de nuevo.';
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
