const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const WA_BASE = import.meta.env.VITE_WA_BASE_URL || "/wa";

export function getAuthToken() {
  return localStorage.getItem("l2_token") || "";
}

export function setAuthToken(token: string) {
  localStorage.setItem("l2_token", token);
}

function withAuth(headers: Record<string, string> = {}) {
  const token = getAuthToken();
  if (token) return { ...headers, Authorization: `Bearer ${token}` };
  return headers;
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { headers: withAuth() });
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: withAuth({ "content-type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

export async function waGet<T>(path: string): Promise<T> {
  const r = await fetch(`${WA_BASE}${path}`);
  if (!r.ok) throw new Error(`WA ${r.status}`);
  return r.json();
}

export async function waPost<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${WA_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`WA ${r.status}`);
  return r.json();
}
