/*
 * client.js
 * ---------
 * Single axios instance for the agent backend.
 *
 * The base URL comes from REACT_APP_AGENT_URL (CRA convention) so the backend
 * can move without editing components. The interceptor attaches the stored JWT
 * to every request, so components never handle the token themselves.
 */

import axios from "axios";

export const TOKEN_KEY = "portfolio_agent_token";

const api = axios.create({
  baseURL: process.env.REACT_APP_AGENT_URL || "http://localhost:8000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* Pull a readable message out of a FastAPI error response. */
export function errorMessage(err, fallback = "Something went wrong.") {
  const detail = err?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  /* 422 from pydantic comes back as an array of field errors */
  if (Array.isArray(detail) && detail.length > 0) {
    return detail[0].msg || fallback;
  }

  if (err?.code === "ERR_NETWORK") {
    return "Cannot reach the agent backend. Is it running?";
  }

  return fallback;
}

export default api;
