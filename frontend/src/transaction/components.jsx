import { apiUrl, API_BASE_URL } from "../api.js";
import { useState } from "react";
import {
  Copy, Check, ArrowLeft, Star, MessageCircle, ShieldCheck, Flag, Pencil, Users,
  Banknote, Eye, CheckCircle2,
} from "lucide-react";
import { NAVY, NAVY_LIGHT } from "../ui.jsx";
import { Package } from "lucide-react";
import { peso } from "../market/data.js";
import { CatIcon } from "../market/components.jsx";

const apiBaseUrl = API_BASE_URL;

const soft = { color: NAVY_LIGHT, background: "#2b47a30f" };
const ring = "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2b47a3]/20";
export const btnBase = "flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition duration-200 hover:-translate-y-0.5";
export const primary = `${btnBase} text-white shadow-md shadow-[#2b47a3]/25 hover:shadow-lg hover:brightness-110 ${ring}`;
export const outline = `${btnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-sm ${ring}`;
export const field = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[15px] outline-none transition hover:border-slate-300 focus:border-[#2b47a3] focus:ring-4 focus:ring-[#2b47a3]/15";

export const Card = ({ title, action, children, className = "" }) => (
  <section className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_24px_-14px_rgba(22,41,107,0.18)] sm:p-6 ${className}`}>
    {title && (
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
    )}
    {children}
  </section>
);

export const Row = ({ k, v, bold }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
    <span className="shrink-0 text-slate-500">{k}</span>
    <span className={`min-w-0 break-words text-right ${bold ? "font-bold" : "text-slate-800"}`} style={bold ? { color: NAVY } : undefined}>{v}</span>
  </div>
);

const Info = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 px-3.5 py-2.5"><p className="text-xs text-slate-400">{label}</p><p className="text-sm font-medium text-slate-800">{value}</p></div>
);

const fmt = (d) =>
  `${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} — ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

/* ---------- Header ---------- */
export function TransactionHeader({ id, onRefresh }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(id).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <a href="#/home" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={15} /> Back to Marketplace</a>
        {onRefresh && (
          <button onClick={onRefresh} className="text-xs font-medium text-blue-900 hover:underline flex items-center gap-1">
            Refresh Status
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Transaction Details</h1>
          <p className="mt-1.5 text-sm text-slate-500">Review and manage your transaction.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm">
          <span className="text-slate-500">Transaction ID:</span>
          <span className="font-semibold text-slate-900">{id}</span>
          <button onClick={copy} aria-label="Copy transaction ID" className={`flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 ${ring}`}>
            {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Status ---------- */
export const STATUS = {
  placed: { done: 0, title: "Awaiting Order", text: "Review the campus meetup details below and submit your purchase order." },
  pending: { done: 1, title: "Awaiting Seller Approval", text: "Your campus meetup details have been submitted. Waiting for the seller to approve." },
  confirmed: { done: 2, title: "Meetup Agreed", text: "Seller agreed to the campus meetup! Meet on campus at the scheduled time to exchange the item for cash." },
  ready: { done: 3, title: "Ready for Meetup", text: "The seller has marked the item ready. Meet on campus to inspect, pay cash, and complete the trade." },
  completed: { done: 4, title: "Completed", text: "This transaction is complete. Thanks for trading on ADNU TRADE." },
  cancelled: { done: -1, title: "Cancelled", text: "This transaction was cancelled. No further action is needed." },
};
const STEPS = ["Order Placed", "Meetup Agreed", "Item Ready", "Completed"];

export function TransactionStatus({ status }) {
  const s = STATUS[status] || STATUS.placed;
  return (
    <Card>
      <ol className="flex" aria-label="Transaction progress">
        {STEPS.map((label, i) => {
          const done = i < s.done, cur = i === s.done;
          return (
            <li key={label} className="relative flex-1 text-center" aria-current={cur ? "step" : undefined}>
              {i > 0 && <span className="absolute left-[-50%] right-1/2 top-4 h-0.5 -translate-y-1/2" style={{ background: i <= s.done ? NAVY_LIGHT : "#e2e8f0" }} />}
              <span className="relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2 text-white transition"
                style={{ borderColor: done || cur ? NAVY_LIGHT : "#e2e8f0", background: done ? NAVY_LIGHT : "#fff" }}>
                {done ? <Check size={16} /> : cur ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: NAVY_LIGHT }} /> : null}
              </span>
              <p className={`mt-2 px-1 text-xs sm:text-sm ${done || cur ? "font-medium text-slate-900" : "text-slate-400"}`}>{label}</p>
            </li>
          );
        })}
      </ol>
      <div className="mt-6 rounded-xl p-4 sm:p-5" style={status === "cancelled" ? { background: "#f1f5f9" } : soft} aria-live="polite">
        <p className="text-xs font-medium text-slate-500">Current Status</p>
        <p className="mt-0.5 text-xl font-semibold text-slate-900">{s.title}</p>
        <p className="mt-1 text-sm text-slate-600">{s.text}</p>
      </div>
    </Card>
  );
}

/* ---------- Item + Payment summary ---------- */
export function ProductSummary({ item, qty, onView }) {
  const sellerName = typeof item.seller === 'object' && item.seller !== null
    ? (item.seller.fullName || item.seller.name || "AdNU Student")
    : (item.seller || "AdNU Student");

  const imageUrl = item?.images?.[0] || item?.image;

  return (
    <Card title="Item Details" className="lg:col-span-2">
      <div className="grid gap-6 sm:grid-cols-[14rem_1fr]">
        <div className="flex aspect-square items-center justify-center rounded-2xl bg-[#eef1fa] overflow-hidden border border-slate-200">
          {imageUrl ? (
            <img src={imageUrl} alt={item.name || item.title} className="h-full w-full object-cover" />
          ) : (
            <CatIcon category={item.category} size={80} />
          )}
        </div>
        <div className="flex flex-col">
          <h3 className="text-xl font-semibold text-slate-900">{item.name || item.title}</h3>
          <div className="mt-3 divide-y divide-slate-100">
            <Row k="Category" v={item.category} />
            <Row k="Condition" v={item.condition} />
            <Row k="Quantity" v={qty} />
            <Row k="Seller" v={sellerName} />
            <Row k="Price" v={peso(item.price)} bold />
          </div>
          <button onClick={onView} className={`${outline} mt-5 sm:w-auto sm:self-start`}><Eye size={17} /> View Item</button>
        </div>
      </div>
    </Card>
  );
}

export function PaymentSummary({ price, qty, fee = 0, children }) {
  const sub = price * qty;
  return (
    <Card title="Payment Summary" className="self-start">
      <Row k="Item Price" v={peso(price)} />
      <Row k="Quantity" v={qty} />
      <Row k="Subtotal" v={peso(sub)} />
      <div className="my-3 h-px bg-slate-100" />
      <div className="flex items-baseline justify-between">
        <span className="font-semibold text-slate-900">Total</span>
        <span className="text-3xl font-bold" style={{ color: NAVY }}>{peso(sub)}</span>
      </div>
      <div className="mt-5 space-y-2.5">{children}</div>
    </Card>
  );
}

/* ---------- Action Buttons Component ---------- */
export function TransactionActions({ status, on, isSeller, meetupStatus }) {
  const P = (label, fn) => <button key={label} onClick={fn} style={{ background: NAVY_LIGHT }} className={primary}>{label}</button>;
  const msg = !isSeller ? <button key="m" onClick={on.message} className={outline}><MessageCircle size={17} /> Message Seller</button> : null;
  const cancel = <button key="c" onClick={on.cancel} className={`${btnBase} text-slate-500 hover:bg-slate-50 hover:text-slate-700 ${ring}`}>Cancel Transaction</button>;

  const isAgreed = meetupStatus === 'agreed' || status === 'confirmed' || status === 'ready';

  let pendingActions = [];
  if (isSeller) {
    if (isAgreed) {
      pendingActions = [P("Mark Item As Ready", on.meet), cancel];
    } else {
      pendingActions = [
        <div key="w" className="flex h-11 items-center justify-center rounded-xl bg-amber-50 text-xs font-semibold text-amber-800">Review Meetup Details</div>,
        cancel
      ];
    }
  } else {
    if (isAgreed) {
      pendingActions = [
        <div key="w" className="flex h-11 items-center justify-center rounded-xl bg-blue-50 text-xs font-semibold text-blue-900">Awaiting Seller to Mark Item As Ready</div>,
        msg, cancel
      ];
    } else {
      pendingActions = [
        <div key="w" className="flex h-11 items-center justify-center rounded-xl bg-slate-100 text-xs font-medium text-slate-600">Awaiting Seller Meetup Approval</div>,
        msg, cancel
      ];
    }
  }

  const map = {
    placed: isSeller
      ? [<div key="wait" className="flex h-11 items-center justify-center rounded-xl bg-slate-100 text-xs font-medium text-slate-600">Waiting for Buyer Order</div>]
      : [P("Confirm Purchase", on.buy), msg, cancel].filter(Boolean),
    pending: pendingActions.filter(Boolean),
    confirmed: isSeller
      ? [P("Mark Item As Ready", on.meet), cancel].filter(Boolean)
      : [
          <div key="w" className="flex h-11 items-center justify-center rounded-xl bg-blue-50 text-xs font-semibold text-blue-900">Awaiting Seller to Mark Item As Ready</div>,
          msg, cancel
        ].filter(Boolean),
    ready: isSeller
      ? [<div key="r" className="flex h-11 items-center justify-center rounded-xl bg-blue-50 text-xs font-semibold text-blue-900">Awaiting Buyer Item Receipt</div>, cancel]
      : [P("Confirm Item Received & Paid", on.complete), msg, cancel].filter(Boolean),
    completed: isSeller ? [
      <div key="d" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700"><CheckCircle2 size={18} /> Transaction Completed</div>
    ] : [
      <div key="d" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700"><CheckCircle2 size={18} /> Transaction Completed</div>,
      <button key="r" onClick={on.rate} className={outline}><Star size={17} /> Rate Seller</button>,
    ].filter(Boolean),
    cancelled: [<div key="x" className="flex h-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-medium text-slate-500">Transaction Cancelled</div>],
  };

  return <>{map[status] || map.placed}</>;
}

/* ---------- Buyer / Seller (Name Only) ---------- */
function PartyCard({ title, p, children }) {
  console.log(`[PartyCard - ${title}] received prop p:`, p);

  const resolvedName =
    (typeof p === 'string' ? p : null) ||
    p?.name ||
    p?.fullName ||
    p?.user?.fullName ||
    p?.user?.name ||
    "AdNU Student";

  const initial = resolvedName !== "AdNU Student" ? resolvedName.charAt(0).toUpperCase() : "A";

  return (
    <Card title={title}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full text-base font-semibold" style={{ color: NAVY_LIGHT, background: "#2b47a314" }}>
          {initial}
        </span>
        <p className="font-medium text-slate-900">{resolvedName}</p>
      </div>
      {children}
    </Card>
  );
}

export const BuyerInfo = ({ p }) => <PartyCard title="Buyer Information" p={p} />;

export const SellerInfo = ({ p, onMessage, isSeller }) => (
  <PartyCard title="Seller Information" p={p}>
    {!isSeller && (
      <button onClick={onMessage} className={`${outline} mt-4`}><MessageCircle size={17} /> Message Seller</button>
    )}
  </PartyCard>
);

/* ---------- Campus Meetup Details ---------- */
const MEETUP_LOCS = ["4 Pillars", "Alingal Building", "Arrupe Building", "Bonoan Building", "Burns Building", "Church", "Coco Cafe", "Covered Court", "Gymnasium", "James O’Brien Library", "Main Gate", "Phelan Building", "Xavier Hall"];

export function MeetupDetails({ m, onChange, locked, txId, isSeller, status }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState(m);
  const [loading, setLoading] = useState(false);
  const when = new Date(`${m.date}T${m.time}`);

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHours}:${currentMinutes}`;
  const minTime = d.date === today ? currentTime : undefined;

  const handleSellerResponse = async (action) => {
    if (!txId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const cleanTxId = String(txId).replace(/^#/, '').trim();

      const res = await fetch(`${apiBaseUrl}/api/transactions/${cleanTxId}/meetup-response`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit meetup response");

      alert(data.message);
      if (data.transaction) {
        onChange({
          ...m,
          meetupStatus: data.transaction.meetupStatus
        }, action === 'agree' ? "Seller agreed to campus meetup terms" : "Seller requested changes");
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const lab = "block text-sm font-medium text-slate-700";
  return (
    <Card title="Campus Meetup Details" className="lg:col-span-2"
      action={!locked && !edit && !isSeller && status !== 'cancelled' && (
        <button onClick={() => { setD(m); setEdit(true); }} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium hover:bg-slate-50 ${ring}`} style={{ color: NAVY_LIGHT }}>
          <Pencil size={14} /> Edit Meetup Details
        </button>
      )}>
      <div className="flex items-center gap-3 rounded-xl border p-4 text-left transition duration-200"
        style={{ borderColor: NAVY_LIGHT, background: "#2b47a30a" }}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={soft}><Users size={19} /></span>
        <span><span className="block text-sm font-semibold text-slate-900">Campus Meetup</span><span className="text-xs text-slate-500">Free, meet on Ateneo de Naga campus</span></span>
      </div>

      {edit ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className={lab}>Meetup Location
            <select value={d.meetupLoc || ""} onChange={(e) => setD({ ...d, meetupLoc: e.target.value })} className={`${field} mt-1.5 font-normal`}>
              <option value="" disabled>Select location...</option>
              {MEETUP_LOCS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className={lab}>Date
            <input
              type="date"
              min={today}
              value={d.date || ""}
              onChange={(e) => setD({ ...d, date: e.target.value })}
              className={`${field} mt-1.5 font-normal`}
            />
          </label>
          <label className={lab}>Time
            <input
              type="time"
              min={minTime}
              value={d.time || ""}
              onChange={(e) => setD({ ...d, time: e.target.value })}
              className={`${field} mt-1.5 font-normal`}
            />
          </label>
          <div className="flex gap-2.5 sm:col-span-3 sm:max-w-sm">
            <button
              disabled={!d.date || !d.time || !d.meetupLoc || loading}
              onClick={async () => {
                if (!txId || txId.includes('PENDING')) {
                  onChange({ ...m, meetupLoc: d.meetupLoc, date: d.date, time: d.time }, "Campus meetup details updated");
                  setEdit(false);
                  return;
                }

                setLoading(true);
                try {
                  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                  const res = await fetch(`${apiBaseUrl}/api/transactions/${txId}/meetup`, {
                    method: 'PUT',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      fulfillmentMethod: 'meetup',
                      location: d.meetupLoc,
                      meetupDate: d.date,
                      meetupTime: d.time
                    })
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Failed to update meetup details");

                  onChange({ ...m, meetupLoc: d.meetupLoc, date: d.date, time: d.time, meetupStatus: 'pending_agreement' }, "Campus meetup details updated & submitted for seller review");
                  setEdit(false);
                } catch (err) {
                  alert(err.message);
                } finally {
                  setLoading(false);
                }
              }}
              style={{ background: NAVY_LIGHT }}
              className={`${primary} disabled:opacity-50 disabled:hover:translate-y-0`}
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
            <button onClick={() => setEdit(false)} className={outline}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Info label="Meetup Location" value={m.meetupLoc ? `${m.meetupLoc}, AdNU Main Campus` : "Not selected"} />
            <Info label="Meetup Date" value={isNaN(when) ? "Not set" : when.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} />
            <Info label="Meetup Time" value={isNaN(when) ? "Not set" : when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} />
          </div>

          {/* Agreement Status Indicator & Seller Controls */}
          <div className="mt-4 flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 text-xs gap-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Agreement Status:</span>
              <span className={`font-semibold px-2.5 py-1 rounded-full ${
                status === 'cancelled' ? 'bg-slate-100 text-slate-500' :
                m?.meetupStatus === 'agreed' ? 'bg-emerald-50 text-emerald-700' :
                m?.meetupStatus === 'renegotiating' ? 'bg-amber-50 text-amber-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {status === 'cancelled' ? 'Cancelled' :
                 m?.meetupStatus === 'agreed' ? 'Agreed by Seller' :
                 m?.meetupStatus === 'renegotiating' ? 'Renegotiation Requested' :
                 'Pending Seller Approval'}
              </span>
            </div>

            {/* Render ONLY for the Seller when transaction is active and not yet agreed */}
            {isSeller && status !== 'cancelled' && m?.meetupStatus !== 'agreed' && (
              <div className="flex gap-2">
                <button
                  disabled={loading}
                  onClick={() => handleSellerResponse('agree')}
                  className="px-3 py-1.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition"
                >
                  Agree to Terms
                </button>
                <button
                  disabled={loading}
                  onClick={() => handleSellerResponse('renegotiate')}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
                >
                  Request Changes
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

/* ---------- Payment Method ---------- */
export function PaymentMethod({ pay, setPay, locked, status, total }) {
  const paid = status === "completed";
  const chip = paid ? ["Paid in Cash", "bg-emerald-50 text-emerald-700"] : ["Cash on Pickup", "bg-amber-50 text-amber-700"];

  return (
    <Card title="Payment Method" action={<span className={`rounded-full px-2.5 py-1 text-xs font-medium ${chip[1]}`}>{chip[0]}</span>}>
      <div className="space-y-2">
        <div
          className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium text-slate-900 shadow-sm"
          style={{ borderColor: NAVY_LIGHT, background: "#2b47a30a" }}
        >
          <Banknote size={18} style={{ color: NAVY_LIGHT }} /> Cash on Campus Meetup
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
        <p>Pay {peso(total)} in cash when you meet the seller on campus to receive your item.</p>
      </div>
    </Card>
  );
}

/* ---------- Timeline ---------- */
export function TransactionTimeline({ events }) {
  return (
    <Card title="Transaction History" className="lg:col-span-2">
      <ol className="relative ml-2 space-y-5 border-l-2 border-slate-100 pl-6">
        {events.map((e, i) => {
          const last = i === events.length - 1;
          return (
            <li key={i} className="relative">
              <span className="absolute -left-[35px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: last ? "#fff" : NAVY_LIGHT, border: `2px solid ${NAVY_LIGHT}` }}>
                {last ? <span className="h-2 w-2 rounded-full" style={{ background: NAVY_LIGHT }} /> : <Check size={11} />}
              </span>
              <p className="text-xs text-slate-400">{fmt(e.at)}</p>
              <p className={`text-sm ${last ? "font-semibold text-slate-900" : "text-slate-700"}`}>{e.text}</p>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ---------- Safety ---------- */
export function SafetyNotice() {
  const [reported, setReported] = useState(false);
  return (
    <section className="self-start rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900"><ShieldCheck size={18} style={{ color: NAVY_LIGHT }} /> Stay Safe</h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {["Meet in a safe public area on campus.", "Verify and check the item before completing the transaction.", "Do not share your account credentials.", "Do not click or share any links.", "Keep communication inside AdNU Trade as much as possible possible.", "Report suspicious transactions."].map((t) => (
          <li key={t} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-slate-400" /> {t}</li>
        ))}
      </ul>
      <button onClick={() => setReported(true)} disabled={reported} className="mt-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:underline disabled:no-underline">
        <Flag size={14} /> {reported ? "Report received. We'll review it." : "Report Transaction"}
      </button>
    </section>
  );
}

/* ---------- Rating ---------- */
export function RatingForm({ seller }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [state, setState] = useState("form");
  if (state !== "form")
    return (
      <Card className="text-center">
        <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
        <h2 className="mt-3 text-lg font-semibold text-slate-900">{state === "sent" ? "Thanks for your review" : "Review skipped"}</h2>
        <p className="mt-1 text-sm text-slate-500">{state === "sent" ? `Your ${stars}-star rating for ${seller} has been submitted.` : "You can rate this seller later from your transaction history."}</p>
      </Card>
    );
  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">How was your transaction?</h2>
      <p className="mt-1 text-sm text-slate-500">Rate {seller} to help other AdNU students trade with confidence.</p>
      <div className="mt-4 flex gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setStars(n)} onMouseEnter={() => setHover(n)}
            className={`rounded-lg p-1 transition hover:scale-110 ${ring}`}>
            <Star size={32} className={n <= (hover || stars) ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm font-medium text-slate-700">Leave a review
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Share your experience..."
          className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-[15px] font-normal outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#2b47a3] focus:ring-4 focus:ring-[#2b47a3]/15" />
      </label>
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:max-w-md">
        <button disabled={!stars} onClick={() => setState("sent")} style={{ background: NAVY_LIGHT }} className={`${primary} disabled:opacity-50 disabled:hover:translate-y-0`}>Submit Review</button>
        <button onClick={() => setState("skipped")} className={outline}>Skip for now</button>
      </div>
    </Card>
  );
}