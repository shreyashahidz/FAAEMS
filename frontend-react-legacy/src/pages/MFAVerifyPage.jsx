import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, setTokens } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import AuthShell from "../components/AuthShell.jsx";

export default function MFAVerifyPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { completeLogin } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!state?.mfaToken) {
    navigate("/login");
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/auth/mfa/verify/", { mfa_token: state.mfaToken, code });
      setTokens({ access: data.access, refresh: data.refresh });
      completeLogin({ access: data.access, refresh: data.refresh }, data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Incorrect code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Enter your authentication code" subtitle={`Signed in as ${state.email}`}>
      {error && (
        <div className="mb-5 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">6-digit code</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full text-center tracking-[0.4em] rounded-xl border border-slate-200 px-4 py-2.5 text-lg font-semibold text-slate-900 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 outline-none transition"
            placeholder="000000"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 shadow-md shadow-blue-500/25 transition disabled:opacity-60"
        >
          {busy ? "Verifying…" : "Verify & sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
