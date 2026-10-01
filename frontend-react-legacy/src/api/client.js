import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

// Tokens live in localStorage for this MVP so a page refresh keeps the
// session. A hardened deployment (Phase 12) should move this to httpOnly
// cookies to reduce the XSS blast radius — tracked as a follow-up, not a
// silent gap.
const TOKEN_KEY = "faems.tokens";

export function getTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
  } catch {
    return null;
  }
}

export function setTokens(tokens) {
  if (tokens) localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const tokens = getTokens();
  if (tokens?.access) {
    config.headers.Authorization = `Bearer ${tokens.access}`;
  }
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // A dropped connection (no response at all) is usually transient —
    // flaky WiFi, a reverse proxy blip — so retry once before surfacing an
    // error to the user, rather than failing on the first hiccup.
    if (!error.response && !original._networkRetry) {
      original._networkRetry = true;
      await new Promise((r) => setTimeout(r, 400));
      return api(original);
    }

    if (error.response?.status === 401 && !original._retry && !original.url.includes("/auth/")) {
      original._retry = true;
      const tokens = getTokens();
      if (!tokens?.refresh) {
        setTokens(null);
        window.location.href = "/login";
        return Promise.reject(error);
      }
      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${BASE_URL}/auth/token/refresh/`, { refresh: tokens.refresh })
            .finally(() => {
              refreshPromise = null;
            });
        }
        const { data } = await refreshPromise;
        setTokens({ ...tokens, access: data.access });
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch (refreshError) {
        setTokens(null);
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
