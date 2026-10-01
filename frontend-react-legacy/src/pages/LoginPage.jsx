import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setTokens } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import ForgotPasswordModal from "../components/ForgotPasswordModal.jsx";
import Icon from "../components/Icon.jsx";

export default function LoginPage() {
  const navigate = useNavigate();
  const { completeLogin } = useAuth();

  const [captcha, setCaptcha] = useState(null);
  const [form, setForm] = useState({ email: "", password: "", captchaAnswer: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [heroImageOk, setHeroImageOk] = useState(true);

  const loadCaptcha = async () => {
    try {
      const { data } = await api.get("/auth/captcha/");
      setCaptcha(data);
    } catch {
      setError("Could not reach the server. Is the backend running?");
    }
  };

  useEffect(() => {
    loadCaptcha();
  }, []);

  const fillGuest = () => {
    setForm((f) => ({ ...f, email: "guest.faculty@tcetmumbai.in", password: "Faems@2026!" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/login/", {
        email: form.email,
        password: form.password,
        captcha_token: captcha?.token,
        captcha_answer: form.captchaAnswer,
      });

      if (data.mfa_setup_required) {
        navigate("/mfa/setup", { state: { mfaToken: data.mfa_token, email: form.email } });
        return;
      }
      if (data.mfa_required) {
        navigate("/mfa/verify", { state: { mfaToken: data.mfa_token, email: form.email } });
        return;
      }
      setTokens({ access: data.access, refresh: data.refresh });
      completeLogin({ access: data.access, refresh: data.refresh }, data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed. Please check your details and try again.");
      loadCaptcha();
      setForm((f) => ({ ...f, captchaAnswer: "" }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* College hero banner — drop the real TCET campus photo at
          frontend/public/hero-tcet.jpg and it replaces this gradient
          automatically, no code change needed. */}
      <div className="relative h-[38vh] min-h-[280px] w-full overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
        {heroImageOk && (
          <img
            src="/hero-tcet.jpg"
            alt="Thakur College of Engineering campus"
            onError={() => setHeroImageOk(false)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-slate-900/10" />
        <div className="absolute inset-0 bg-hero-grid bg-[length:3rem_3rem] opacity-20" />

        <div className="relative z-10 h-full max-w-[1680px] mx-auto px-4 sm:px-8 flex flex-col">
          <div className="flex items-center gap-3 pt-6">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center text-white font-bold text-xl tracking-tight">
              F
            </div>
            <div>
              <p className="text-xl tracking-tight text-white font-bold leading-none">FAEMS</p>
              <p className="text-[11px] font-semibold text-blue-200 tracking-wider uppercase mt-1">
                Thakur College of Engineering
              </p>
            </div>
          </div>

          <div className="mt-auto pb-8 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-[11px] font-semibold text-blue-100 uppercase tracking-wider mb-3">
              Accreditation Core
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              Every achievement, evidenced and audit-ready.
            </h1>
          </div>
        </div>
      </div>

      <div className="relative flex items-start justify-center px-4 sm:px-6 -mt-16 pb-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl p-7 sm:p-8 bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-[0_20px_45px_rgba(30,58,138,0.12),0_2px_10px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <Icon name="shield_person" size={22} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Welcome back</h3>
                <p className="text-xs text-slate-500">Sign in with your institutional account</p>
              </div>
            </div>

            {error && (
              <div className="mb-5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Email address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Icon name="mail" size={19} />
                  </span>
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="firstname.lastname@tcetmumbai.in"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all rounded-xl py-3 pl-11 pr-4 text-sm shadow-sm"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">Password</label>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Icon name="lock" size={19} />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all rounded-xl py-3 pl-11 pr-11 text-sm shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <Icon name={showPassword ? "visibility_off" : "visibility"} size={19} />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Security check — {captcha?.question ?? "…"}
                  </label>
                </div>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-blue-600">
                      <Icon name="verified_user" size={19} />
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={form.captchaAnswer}
                      onChange={(e) => setForm({ ...form, captchaAnswer: e.target.value })}
                      className="w-full bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all rounded-xl py-3 pl-11 pr-4 text-sm shadow-sm"
                      placeholder="Answer"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={loadCaptcha}
                    title="Refresh challenge"
                    className="rounded-xl border border-slate-300 px-3.5 text-slate-400 hover:text-slate-600 hover:border-slate-400 bg-white shadow-sm transition"
                  >
                    <Icon name="refresh" size={19} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/30 text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm disabled:opacity-60"
              >
                <Icon name="fingerprint" size={20} />
                <span>{submitting ? "Signing in…" : "Sign in"}</span>
              </button>
            </form>

            <div className="mt-6 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 px-4 py-3">
              <p className="text-xs text-slate-600 mb-2">
                Testing locally? Use the seeded guest account (faculty role, no MFA required).
              </p>
              <button
                type="button"
                onClick={fillGuest}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Fill guest credentials <Icon name="arrow_forward" size={14} />
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            Access restricted to <span className="font-semibold text-slate-500">@tcetmumbai.in</span> institutional accounts.
          </p>
        </div>
      </div>

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  );
}
