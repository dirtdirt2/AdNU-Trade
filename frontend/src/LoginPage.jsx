import { useState, useEffect } from "react";
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ArrowLeft, ShieldCheck } from "lucide-react";
import { NAVY_LIGHT, Logo, Field, Background } from "./ui.jsx";
import { refreshProfileStore } from "./profile/data.js";

function EyeToggle({ shown, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2b47a3]"
    >
      {shown ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}

const primaryBtn =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white shadow-md shadow-[#2b47a3]/25 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2b47a3]/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:brightness-100";

export default function LoginPage() {
  const [f, setF] = useState({ email: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot Password States ("none" | "email" | "code" | "success")
  const [forgotStep, setForgotStep] = useState("none");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Pre-fill remembered email on component mount
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setF((p) => ({ ...p, email: savedEmail }));
      setRememberMe(true);
    }
  }, []);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const link = { color: NAVY_LIGHT };

  // Standard Login Handler (Always routes to Home)
  const submit = async (ev) => {
    ev.preventDefault();
    if (!f.email || !f.password) {
      return setError("Please fill in all fields.");
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid email or password.");

      // Handle "Remember Me" logic
      if (rememberMe) {
        if (data.token) localStorage.setItem("token", data.token);
        localStorage.setItem("rememberedEmail", f.email);
      } else {
        if (data.token) sessionStorage.setItem("token", data.token);
        localStorage.removeItem("token");
        localStorage.removeItem("rememberedEmail");
      }

      if (data.user?.role) {
        localStorage.setItem("role", data.user.role);
      }

      refreshProfileStore();
      // Normal sign in always lands on main home
      window.location.hash = "#/home";
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Dedicated Admin Login Handler
  const submitAsAdmin = async (ev) => {
    ev.preventDefault();
    if (!f.email || !f.password) {
      return setError("Please fill in all fields.");
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid email or password.");

      // Strict Admin Role Guard
      if (data.user?.role !== "admin") {
        throw new Error("Access denied: You do not have administrator privileges.");
      }

      // Persist session and role
      if (rememberMe) {
        if (data.token) localStorage.setItem("token", data.token);
        localStorage.setItem("rememberedEmail", f.email);
      } else {
        if (data.token) sessionStorage.setItem("token", data.token);
        localStorage.removeItem("token");
        localStorage.removeItem("rememberedEmail");
      }

      localStorage.setItem("role", "admin");
      refreshProfileStore();
      window.location.hash = "#/admin";
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Request Reset OTP
  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) return setResetError("Enter your AdNU email.");
    setResetLoading(true);
    setResetError("");

    try {
      const res = await fetch("http://localhost:5000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reset code.");

      setForgotStep("code");
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  // Submit New Password with OTP
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetCode.length !== 6) return setResetError("Enter the 6-digit code.");
    if (newPassword.length < 8) return setResetError("Password must be at least 8 characters.");

    setResetLoading(true);
    setResetError("");

    try {
      const res = await fetch("http://localhost:5000/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, code: resetCode, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed.");

      setForgotStep("success");
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-8 font-sans">
      <Background />
      <main className="relative w-full max-w-[420px] rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_10px_40px_-12px_rgba(22,41,107,0.18)] sm:p-9">

        {/* VIEW 1: NORMAL SIGN IN */}
        {forgotStep === "none" && (
          <>
            <Logo />
            <div className="mt-4 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign In to ADNU TRADE</h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Welcome back! Please enter your details.
              </p>
            </div>

            <form onSubmit={submit} noValidate className="mt-7 space-y-4">
              {error && (
                <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" /> {error}
                </div>
              )}

              <Field
                id="email"
                label="AdNU Email"
                icon={Mail}
                type="email"
                autoComplete="email"
                placeholder="username@adnu.edu.ph"
                value={f.email}
                onChange={set("email")}
              />

              <div>
                <Field
                  id="password"
                  label="Password"
                  icon={Lock}
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={f.password}
                  onChange={set("password")}
                  right={<EyeToggle shown={showPw} onToggle={() => setShowPw(!showPw)} />}
                />

                {/* Remember Me & Forgot Password Row */}
                <div className="mt-3 flex items-center justify-between text-xs">
                  <label className="flex cursor-pointer items-center gap-2 text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 accent-[#2b47a3] focus:ring-[#2b47a3]"
                    />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => { setForgotStep("email"); setResetEmail(f.email); setResetError(""); }}
                    className="font-medium hover:underline"
                    style={link}
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              {/* Standard Sign In Button */}
              <button
                type="submit"
                disabled={loading || !f.email || !f.password}
                style={{ background: NAVY_LIGHT }}
                className={primaryBtn}
              >
                {loading ? (<><Loader2 size={18} className="animate-spin" /> Signing in…</>) : "Sign In"}
              </button>

              {/* Secondary Admin Sign In Button */}
              <button
                type="button"
                onClick={submitAsAdmin}
                disabled={loading || !f.email || !f.password}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-[15px] font-semibold text-slate-700 shadow-sm transition duration-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldCheck size={18} className="text-amber-600" />
                Sign In as Administrator
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-slate-500">
              Don't have an account?{" "}
              <a href="#/register" className="font-semibold hover:underline" style={link}>
                Create an account
              </a>
            </p>
          </>
        )}

        {/* VIEW 2: FORGOT PASSWORD - ENTER EMAIL */}
        {forgotStep === "email" && (
          <div>
            <button
              type="button"
              onClick={() => setForgotStep("none")}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:underline"
            >
              <ArrowLeft size={14} /> Back to Sign In
            </button>
            <h2 className="mt-4 text-xl font-semibold text-slate-900">Reset Your Password</h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter your official AdNU email address and we'll send you a 6-digit verification code.
            </p>

            <form onSubmit={handleRequestReset} className="mt-6 space-y-4">
              {resetError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" /> {resetError}
                </div>
              )}
              <Field
                id="resetEmail"
                label="AdNU Email"
                icon={Mail}
                type="email"
                placeholder="username@adnu.edu.ph"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
              <button
                type="submit"
                disabled={resetLoading || !resetEmail}
                style={{ background: NAVY_LIGHT }}
                className={primaryBtn}
              >
                {resetLoading ? (<><Loader2 size={18} className="animate-spin" /> Sending Code…</>) : "Send Reset Code"}
              </button>
            </form>
          </div>
        )}

        {/* VIEW 3: FORGOT PASSWORD - ENTER CODE & NEW PASSWORD */}
        {forgotStep === "code" && (
          <div>
            <button
              type="button"
              onClick={() => setForgotStep("email")}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:underline"
            >
              <ArrowLeft size={14} /> Change email
            </button>
            <h2 className="mt-4 text-xl font-semibold text-slate-900">Enter Verification Code</h2>
            <p className="mt-1 text-sm text-slate-500">
              We sent a code to <span className="font-medium text-slate-800">{resetEmail}</span>.
            </p>

            <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
              {resetError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" /> {resetError}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">6-Digit Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="h-12 w-full rounded-xl border border-slate-200 text-center text-xl tracking-[0.4em] font-semibold text-slate-900 outline-none focus:border-[#2b47a3] focus:ring-4 focus:ring-[#2b47a3]/15"
                />
              </div>

              <Field
                id="newPassword"
                label="New Password"
                icon={Lock}
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <button
                type="submit"
                disabled={resetLoading || resetCode.length !== 6 || newPassword.length < 8}
                style={{ background: NAVY_LIGHT }}
                className={primaryBtn}
              >
                {resetLoading ? (<><Loader2 size={18} className="animate-spin" /> Resetting…</>) : "Reset Password"}
              </button>
            </form>
          </div>
        )}

        {/* VIEW 4: SUCCESS CONFIRMATION */}
        {forgotStep === "success" && (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 size={56} className="text-emerald-500" />
            <h2 className="mt-4 text-2xl font-semibold text-slate-900">Password Reset!</h2>
            <p className="mt-2 text-sm text-slate-500">Your password has been updated successfully.</p>
            <button
              type="button"
              onClick={() => { setForgotStep("none"); setResetError(""); }}
              style={{ background: NAVY_LIGHT }}
              className={`${primaryBtn} mt-6`}
            >
              Sign In Now
            </button>
          </div>
        )}

      </main>
    </div>
  );
}