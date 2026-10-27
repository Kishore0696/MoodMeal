import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
export function useData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const requestId = useRef(0);
  const reload = useCallback(async () => { const current = ++requestId.current; if (!path) { setData(null); setLoading(false); return; } setLoading(true); setError(''); try { const result = await api<T>(path); if (current === requestId.current) setData(result); } catch (e) { if (current === requestId.current) setError((e as Error).message); } finally { if (current === requestId.current) setLoading(false); } }, [path]);
  useEffect(() => { void reload(); return () => { requestId.current++; }; }, [reload]);
  return { data, loading, error, reload, setData };
}
