import { apiUrl } from "./api.js";
import { useState } from "react";
import {
  GraduationCap, BookOpen, Briefcase, User, Mail, Lock, Eye, EyeOff,
  Loader2, CheckCircle2, ShieldCheck, AlertCircle, ShieldAlert,
} from "lucide-react";
import { NAVY_LIGHT, Logo, Field, Background } from "./ui.jsx";

const DOMAIN = "@adnu.edu.ph"; // approved university email domain

const ROLES = [
  { id: "student", label: "Student", icon: GraduationCap, idLabel: "ID Number", idPlaceholder: "Enter your 9-digit ID number", idHint: "Enter exactly 9 digits",
    confirm: "I confirm that I am a currently enrolled student, active teacher, or staff member of Ateneo de Naga University." },
  { id: "teacher", label: "Teacher", icon: BookOpen, idLabel: "ID Number", idPlaceholder: "Enter your 9-digit ID number", idHint: "Enter exactly 9 digits",
    confirm: "I confirm that I am a currently enrolled student, active teacher, or staff member of Ateneo de Naga University." },
  { id: "staff", label: "Staff", icon: Briefcase, idLabel: "ID Number", idPlaceholder: "Enter your 9-digit ID number", idHint: "Enter exactly 9 digits",
    confirm: "I confirm that I am a currently enrolled student, active teacher, or staff member of Ateneo de Naga University." },
  { id: "admin", label: "Admin", icon: ShieldAlert, idLabel: "Admin / ID Number", idPlaceholder: "Enter your ID number", idHint: "Enter your university identifier",
    confirm: "I confirm that I am registering for an official administrator account, subject to manual review and approval by an existing administrator." },
];

const RULES = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
];

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

function Check2({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-[#2b47a3]"
      />
      <span>{children}</span>
    </label>
  );
}

const primaryBtn =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white shadow-md shadow-[#2b47a3]/25 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2b47a3]/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:brightness-100";

export default function RegisterPage({ onSwitchToLogin }) {
  const [f, setF] = useState({ idNumber: "", first: "", last: "", email: "", password: "", confirm: "" });
  const [show, setShow] = useState({ pw: false, cf: false });
  const [enrolled, setEnrolled] = useState(false);
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState("form"); // form | code | done
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [resent, setResent] = useState(false);
  const [role, setRole] = useState("student");
  const R = ROLES.find((r) => r.id === role);
  const changeRole = (id) => { setRole(id); setEnrolled(false); setErrors({}); };

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const ready =
    Object.values(f).every((v) => v.trim()) && f.idNumber.length === 9 && enrolled;

  const validate = () => {
    const e = {};
    if (!f.idNumber) e.idNumber = `Enter your ${R.idLabel}.`;
    else if (!/^\d{9}$/.test(f.idNumber)) e.idNumber = "ID Number must contain exactly 9 digits.";
    if (!f.first.trim()) e.first = "Enter your first name.";
    if (!f.last.trim()) e.last = "Enter your last name.";
    const email = f.email.trim().toLowerCase();
    if (!email) e.email = "Enter your AdNU email.";
    else if (!/^[^\s@]+@adnu\.edu\.ph$/.test(email))
      e.email = `Use your ${DOMAIN} email. Personal addresses such as Gmail, Yahoo or Outlook aren't accepted.`;
    if (!f.password) e.password = "Create a password.";
    else if (!RULES[0].test(f.password)) e.password = "Password must be at least 8 characters.";
    if (!f.confirm) e.confirm = "Re-enter your password.";
    else if (f.confirm !== f.password) e.confirm = "Passwords don't match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Live Backend Registration Request (Sends OTP Email)
  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setErrors({});

    try {
      const res = await fetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");

      setStep("code"); // Move to OTP input screen
    } catch (err) {
      setErrors({ email: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Live Backend OTP Verification Request
  const verify = async (ev) => {
    ev.preventDefault();
    if (code.length !== 6) return setCodeError("Enter the 6-digit code.");
    setLoading(true);
    setCodeError("");

    try {
      const res = await fetch(apiUrl("/api/auth/verify-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: f.email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      setStep("done"); // Success!
    } catch (err) {
      setCodeError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResent(true);
    setCodeError("");
    try {
      await fetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, role }),
      });
    } catch (err) {
      console.error("Resend error:", err);
    }
    setTimeout(() => setResent(false), 4000);
  };

  const link = { color: NAVY_LIGHT };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-8 font-sans">
      <Background />
      <main className="relative w-full max-w-[460px] rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_10px_40px_-12px_rgba(22,41,107,0.18)] sm:p-9">
        {step === "done" ? (
          <div className="flex flex-col items-center py-8 text-center" role="status">
            <CheckCircle2 size={56} className="text-emerald-500" />
            <h1 className="mt-5 text-2xl font-semibold text-slate-900">Account created</h1>
            <p className="mt-2 text-sm text-slate-500">
              {role === 'admin'
                ? "Your AdNU email is verified. Your administrator account is pending approval from an existing admin."
                : "Your AdNU email is verified. You can now sign in to ADNU TRADE."}
            </p>
            <button
              type="button"
              onClick={onSwitchToLogin}
              style={{ background: NAVY_LIGHT }}
              className={`${primaryBtn} mt-7`}
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <>
            <Logo />
            <div className="mt-4 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create Your Account</h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Register using your Ateneo de Naga University account.
              </p>
              <span
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                style={{ color: NAVY_LIGHT, borderColor: "#2b47a333", background: "#2b47a30d" }}
              >
                <GraduationCap size={14} /> AdNU Students, Teachers, Staff & Admins
              </span>
              <p className="mt-2 text-xs text-slate-400">
                Only official Ateneo de Naga University accounts can register. An official @adnu.edu.ph email is required.
              </p>
            </div>

            {step === "form" ? (
              <form onSubmit={submit} noValidate className="mt-7 space-y-4">
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium text-slate-700">I am a</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
                    {ROLES.map((r) => {
                      const on = role === r.id;
                      const I = r.icon;
                      return (
                        <button key={r.id} type="button" role="radio" aria-checked={on} onClick={() => changeRole(r.id)}
                          style={on ? { background: NAVY_LIGHT } : undefined}
                          className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2b47a3]/20 ${on ? "border-transparent text-white shadow-md shadow-[#2b47a3]/25" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                          <I size={15} /> {r.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <Field id="idNumber" label={R.idLabel} icon={R.icon} type="text" inputMode="numeric" pattern="[0-9]{9}" maxLength={9}
                  placeholder={R.idPlaceholder} hint={R.idHint} autoComplete="off"
                  value={f.idNumber} error={errors.idNumber} onChange={(e) => setF((p) => ({ ...p, idNumber: e.target.value.replace(/\D/g, "").slice(0, 9) }))} />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="first" label="First Name" icon={User} type="text" autoComplete="given-name"
                    placeholder="Enter your first name" value={f.first} error={errors.first} onChange={set("first")} />
                  <Field id="last" label="Last Name" icon={User} type="text" autoComplete="family-name"
                    placeholder="Enter your last name" value={f.last} error={errors.last} onChange={set("last")} />
                </div>

                <Field id="email" label="AdNU Email" icon={Mail} type="email" autoComplete="email"
                  placeholder={`Enter your ${DOMAIN} email`}
                  hint="Use your official Ateneo de Naga University email address."
                  value={f.email} error={errors.email} onChange={set("email")} />

                <div>
                  <Field id="password" label="Password" icon={Lock} type={show.pw ? "text" : "password"}
                    autoComplete="new-password" placeholder="Create a password"
                    value={f.password} error={errors.password} onChange={set("password")}
                    right={<EyeToggle shown={show.pw} onToggle={() => setShow((s) => ({ ...s, pw: !s.pw }))} />} />
                  <p className="mt-2 text-xs text-slate-500">Password must be at least 8 characters.</p>
                </div>

                <Field id="confirm" label="Confirm Password" icon={Lock} type={show.cf ? "text" : "password"}
                  autoComplete="new-password" placeholder="Re-enter your password"
                  value={f.confirm} error={errors.confirm} onChange={set("confirm")}
                  right={<EyeToggle shown={show.cf} onToggle={() => setShow((s) => ({ ...s, cf: !s.cf }))} />} />

                <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ShieldCheck size={18} style={link} /> Verify Your AdNU Account
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    A verification code will be sent to your official AdNU email address to confirm your identity.
                  </p>
                  <div className="mt-3">
                    <Check2 checked={enrolled} onChange={setEnrolled}>
                      {R.confirm}
                    </Check2>
                  </div>
                </section>

                <button type="submit" disabled={!ready || loading} style={{ background: NAVY_LIGHT }} className={primaryBtn}>
                  {loading ? (<><Loader2 size={18} className="animate-spin" /> Sending Code…</>) : "Create Account"}
                </button>
              </form>
            ) : (
              <form onSubmit={verify} noValidate className="mt-7">
                <p className="text-center text-sm text-slate-500">
                  We sent a 6-digit code to <span className="font-medium text-slate-800">{f.email.trim()}</span>.
                </p>
                {codeError && (
                  <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" /> {codeError}
                  </div>
                )}
                <label htmlFor="code" className="mb-1.5 mt-5 block text-sm font-medium text-slate-700">Verification code</label>
                <input id="code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" placeholder="000000"
                  value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setCodeError(""); }}
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white text-center text-2xl tracking-[0.5em] text-slate-900 outline-none transition placeholder:text-slate-300 hover:border-slate-300 focus:border-[#2b47a3] focus:ring-4 focus:ring-[#2b47a3]/15" />
                <button type="submit" disabled={loading || code.length !== 6} style={{ background: NAVY_LIGHT }} className={`${primaryBtn} mt-5`}>
                  {loading ? (<><Loader2 size={18} className="animate-spin" /> Verifying…</>) : "Verify and Finish"}
                </button>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <button type="button" onClick={() => { setStep("form"); setCode(""); setCodeError(""); }} className="text-slate-500 hover:underline">Edit details</button>
                  <button type="button" onClick={resend} className="font-medium hover:underline" style={link}>
                    {resent ? "Code sent again" : "Resend code"}
                  </button>
                </div>
              </form>
            )}

            <p className="mt-7 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <button type="button" onClick={onSwitchToLogin} className="font-semibold hover:underline" style={link}>
                Sign in
              </button>
            </p>
          </>
        )}
      </main>
    </div>
  );
}