import logo from "./assets/logo.png";

/* Brand colors — navy from the logo, plus a slightly lighter shade for UI accents */
export const NAVY = "#16296b";
export const NAVY_LIGHT = "#2b47a3";

/* ---------- Logo (your original image) ---------- */
export function Logo() {
  return (
    <div className="flex justify-center">
      <img src={logo} alt="ADNU Trade" className="h-36 w-auto select-none object-contain" draggable="false" />
    </div>
  );
}

/* ---------- Reusable field ---------- */
export function Field({ id, label, icon: Icon, error, hint, right, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <Icon
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className={`h-12 w-full rounded-xl border bg-white pl-11 ${
            right ? "pr-12" : "pr-4"
          } text-[15px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-4 ${
            error
              ? "border-red-400 focus:ring-red-100"
              : "border-slate-200 hover:border-slate-300 focus:border-[#2b47a3] focus:ring-[#2b47a3]/15"
          }`}
          {...props}
        />
        {right}
      </div>
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>
      )}
    </div>
  );
}


/* Same subtle background as the login page */
export function Background() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute -left-24 top-16 h-48 w-[28rem] -skew-y-[18deg] rounded-3xl opacity-[0.045]" style={{ background: NAVY }} />
      <div className="absolute -right-32 bottom-20 h-40 w-[26rem] -skew-y-[18deg] rounded-3xl opacity-[0.045]" style={{ background: NAVY_LIGHT }} />
    </div>
  );
}
