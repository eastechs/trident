export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly response: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* leave as text */ }
    throw new ApiError(res.status, parsed, `API error ${res.status}`);
  }

  return res.json();
}

export const api_get = <T>(path: string) => api<T>(path);

export const api_post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

export const api_put = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });

export const api_patch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });

export const api_delete = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined });
