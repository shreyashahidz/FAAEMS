import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getTokens, setTokens } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const tokens = getTokens();
    if (!tokens?.access) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me/");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const completeLogin = useCallback((tokens, userData) => {
    setTokens(tokens);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    const tokens = getTokens();
    try {
      if (tokens?.refresh) await api.post("/auth/logout/", { refresh: tokens.refresh });
    } catch {
      // best-effort — clear local state regardless
    }
    setTokens(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, completeLogin, logout, refresh: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
