/*
 * AuthContext.js
 * --------------
 * Holds the signed-in user for the whole app.
 *
 * The JWT lives in localStorage; on mount we call /auth/me to check it is still
 * valid, so an expired token logs the user out rather than leaving a dead session.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { TOKEN_KEY } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  /* Shared by login and signup — both return the same token payload. */
  const authenticate = useCallback(async (path, payload) => {
    const res = await api.post(path, payload);
    localStorage.setItem(TOKEN_KEY, res.data.access_token);
    const me = await api.get("/auth/me");
    setUser(me.data);
    return me.data;
  }, []);

  const login = useCallback(
    (email, password) => authenticate("/auth/login", { email, password }),
    [authenticate]
  );

  const signup = useCallback(
    (payload) => authenticate("/auth/signup", payload),
    [authenticate]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  /* Lets a screen push server-confirmed changes (e.g. a new theme colour) back
   * into context without a round trip through /auth/me. */
  const updateUser = useCallback((updated) => setUser(updated), []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, signup, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
}
