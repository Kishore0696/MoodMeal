import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Leaf } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
export function AuthPage({ register = false }: { register?: boolean }) {
  const auth = useAuth(), navigate = useNavigate(), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError('');
    try { if (register) await auth.register(String(f.get('name')), String(f.get('email')), String(f.get('password'))); else await auth.login(String(f.get('email')), String(f.get('password'))); navigate('/dashboard', { replace: true }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="auth-page wrap"><div className="auth-art"><Leaf size={40}/><p className="eyebrow">WELCOME TO YOUR FEEL-GOOD KITCHEN</p><h1>A little more you.<br/>In every meal.</h1><p>Good food for the days you’re having,<br/>and the moments you’re making.</p><span className="auth-emoji">🥑 🍋 🥬</span></div><form className="auth-form panel" onSubmit={submit}><p className="eyebrow">{register ? 'LET’S GET TO KNOW YOU' : 'GOOD TO SEE YOU AGAIN'}</p><h2>{register ? 'Make yourself at home.' : 'Welcome back.'}</h2><p className="muted">{register ? 'Your next favorite meal is waiting.' : 'Your pantry and preferences are right where you left them.'}</p>{register && <label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={80} placeholder="What should we call you?"/></label>}<label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" maxLength={254}/></label><label>Password<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={10} maxLength={72} placeholder="At least 10 characters"/></label><p className="form-hint">Use 10–72 characters. A unique passphrase works well.</p>{error && <p role="alert" className="error">{error}</p>}<button className="button" disabled={busy}>{busy ? 'One moment…' : register ? 'Create my account' : 'Sign in'}<ArrowUpRight size={18}/></button><p className="auth-switch">{register ? 'Already part of the table?' : 'New around here?'} <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p></form></div>;
}
