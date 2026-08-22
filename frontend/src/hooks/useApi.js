import { useState, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (method, path, body = null, jwt = null) => {
    setLoading(true);
    setError(null);
    try {
      const opts = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      };
      const res = await fetch(`${API}${path}`, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { request, loading, error };
}
