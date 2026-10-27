let csrfToken = '';
export const setCsrf = (token: string) => { csrfToken = token; };
const base = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_URL || '/api';
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try { res = await fetch(`${base}${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}), ...options.headers } }); }
  catch { throw new Error('Cannot reach MoodMeal. Check your connection and try again.'); }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const details = body?.error?.details?.fieldErrors;
    const detail = details ? Object.values(details).flat().join('. ') : '';
    throw new Error(detail || body?.error?.message || `Request failed (${res.status}). Please try again.`);
  }
  return res.status === 204 ? undefined as T : res.json();
}
export const post = <T>(path: string, data: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(data) });
