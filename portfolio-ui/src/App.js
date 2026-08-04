/*
 * App.js
 * ------
 * Routing shell.
 *
 * No account is special: "/" is a generic landing page, and every user —
 * including whoever runs the site — is served from /u/:username.
 */

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Landing from "./components/Landing";
import PublicProfile from "./components/PublicProfile";
import Login from "./components/Login";
import Signup from "./components/Signup";
import Dashboard from "./components/Dashboard";
import Settings from "./components/Settings";
import AllUsers from "./components/AllUsers";

/* Gate for owner-only routes. Waits for the token check so a signed-in user
 * isn't bounced to /login on a refresh. */
function RequireAuth({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}

function App() {
  /* Future flags opt in to v7 behaviour now, so the upgrade is a version bump. */
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <Settings />
              </RequireAuth>
            }
          />
          <Route path="/users" element={<AllUsers />} />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
