import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, post, setCsrf } from '../services/api';
import type { User } from '../types';
type Auth = { user: User | null; loading: boolean; error: string; login: (email: string, password: string) => Promise<void>; register: (name: string, email: string, password: string) => Promise<void>; logout: () => Promise<void>; refresh: () => Promise<void> };
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  function accept(data: { user: User; csrfToken: string }) { setUser(data.user); setCsrf(data.csrfToken); setError(''); }
  async function refresh() { accept(await api<{ user: User; csrfToken: string }>('/auth/me')); }
  useEffect(() => { refresh().catch(e => { if (!e.message.includes('sign in') && !e.message.includes('expired')) setError(e.message); }).finally(() => setLoading(false)); }, []);
  return <Context.Provider value={{ user, loading, error, refresh, login: async (email, password) => accept(await post('/auth/login', { email, password })), register: async (name, email, password) => accept(await post('/auth/register', { name, email, password })), logout: async () => { await post('/auth/logout', {}); setUser(null); setCsrf(''); } }}>{children}</Context.Provider>;
}
export function useAuth() { const context = useContext(Context); if (!context) throw new Error('Auth context missing'); return context; }
