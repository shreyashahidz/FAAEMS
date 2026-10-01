import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, setTokens } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import AuthShell from "../components/AuthShell.jsx";

export default function MFASetupPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { completeLogin } = useAuth();
  const [setupData, setSetupData] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state?.mfaToken) {
      navigate("/login");
      return;
    }
    api
      .post("/auth/mfa/setup/", { mfa_token: state.mfaToken })
      .then(({ data }) => setSetupData(data))
      .catch(() => setError("This session has expired. Please log in again."));
  }, [state, navigate]);

  const handleActivate = async (e) => {
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
    <AuthShell
      title="Set up two-factor authentication"
      subtitle="Your role requires an authenticator app for extra account security."
    >
      {error && (
        <div className="mb-5 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3">{error}</div>
      )}

      {!setupData ? (
        <p className="text-sm text-slate-500">Generating your setup code…</p>
      ) : (
        <form onSubmit={handleActivate} className="space-y-5">
          <ol className="text-sm text-slate-600 space-y-3 list-decimal list-inside">
            <li>Install Google Authenticator, Authy, or a similar TOTP app.</li>
            <li>Scan this QR code (or enter the key manually).</li>
            <li>Enter the 6-digit code it shows to activate.</li>
          </ol>

          <div className="flex justify-center">
            <img src={setupData.qr_code} alt="MFA QR code" className="h-44 w-44 rounded-xl border border-slate-200" />
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Manual entry key</p>
            <p className="font-mono text-sm tracking-wider text-slate-800 break-all">{setupData.secret}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
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
            {busy ? "Activating…" : "Activate & sign in"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
