/**
 * UnityLink OS — client-side auth token storage.
 *
 * The operator/member enters their API key on the /login page; it is stored in
 * localStorage and sent as `Authorization: Bearer <key>` on every API call.
 * The key never appears in the bundle or in git — it is user-supplied at
 * runtime, matching the server-side RBAC in server/lib/auth.mjs.
 */

const STORAGE_KEY = "unitylink.auth.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token.trim());
  } catch {
    /* storage unavailable */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

/** Headers to merge into API requests when a token is stored. */
export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}