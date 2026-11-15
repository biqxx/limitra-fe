import { API_BASE_URL } from './config';
import { getToken, storeSession, clearTokens } from '@/lib/auth';

// `errors` is the field-level validation payload from an ErrorResponse (nullable).
export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

let _refreshPromise = null;
async function tryRefreshToken() {
  const token = getToken();
  if (!token) return null;
  if (!_refreshPromise) {
    _refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const payload = await res.json().catch(() => null);
        const data = payload?.data;
        if (data?.access_token) {
          storeSession(data);
          return data.access_token;
        }
        return null;
      })
      .catch(() => null)
      .finally(() => { _refreshPromise = null; });
  }
  return _refreshPromise;
}

export async function apiFetch(path, { method = 'GET', body, params, auth = true, headers = {}, _retried = false } = {}) {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
  }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const finalHeaders = isFormData ? { ...headers } : { 'Content-Type': 'application/json', ...headers };
  if (auth) {
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url.toString(), {
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : (isFormData ? body : JSON.stringify(body)),
    cache: 'no-store',
  });

  if (res.status === 401 && auth && !_retried && !path.startsWith('/auth/refresh') && !path.startsWith('/auth/login')) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      return apiFetch(path, { method, body, params, auth, headers, _retried: true });
    }
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text();

  const ok = res.ok && (!isJson || payload?.success !== false);
  if (!ok) {
    if (res.status === 401) clearTokens();
    throw new ApiError(payload?.message || res.statusText, res.status, payload?.errors);
  }
  return isJson ? payload?.data : payload;
}
