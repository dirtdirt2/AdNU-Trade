import { useRef, useState } from "react";
import {
  Search, ArrowLeft, MoreHorizontal, Smile, Send, X, Copy, Reply, Pencil, Trash2, Check,
  User, Eye, Receipt, Flag, Ban, CheckCircle2,
} from "lucide-react";
import { NAVY, NAVY_LIGHT } from "../ui.jsx";
import { CatIcon } from "../market/components.jsx";
import { Modal } from "../market/Details.jsx";
import { primary, outline, field } from "../transaction/components.jsx";
import { peso } from "../market/data.js";
import { clock, rel } from "./data.js";

const ring = "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2b47a3]/20";
const soft = { color: NAVY_LIGHT, background: "#2b47a314" };
export const TX_LABEL = { placed: "Awaiting Purchase", pending: "Payment Pending", confirmed: "Payment Confirmed", ready: "Ready for Meetup", completed: "Completed" };

export function Avatar({ name, online, size = 44 }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span className="flex h-full w-full items-center justify-center rounded-full font-semibold" style={{ ...soft, fontSize: size * 0.38 }}>{name[0]}</span>
      {online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" aria-label="Online" />}
    </span>
  );
}

/* ---------- Sidebar ---------- */
export function ConversationItem({ c, active, onSelect }) {
  const last = c.messages[c.messages.length - 1];
  const preview = !last ? "" : last.deleted ? "Message deleted" : `${last.me ? "You: " : ""}${last.text || "Photo"}`;
  return (
    <button onClick={onSelect} aria-current={active ? "true" : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${ring} ${active ? "" : "hover:bg-slate-50"}`}
      style={active ? { background: "#2b47a30f" } : undefined}>
      <Avatar name={c.name} online={c.online} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-sm ${c.unread ? "font-semibold text-slate-900" : "font-medium text-slate-800"}`}>{c.name}</span>
          {last && <span className="shrink-0 text-xs text-slate-400">{rel(last.at)}</span>}
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className={`truncate text-sm ${c.unread ? "font-medium text-slate-700" : "text-slate-500"}`}>{preview}</span>
          {c.unread > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-white" style={{ background: NAVY_LIGHT }}>{c.unread}</span>}
        </span>
        <span className="block truncate text-xs text-slate-400">{c.item.name}</span>
      </span>
    </button>
  );
}

export function ConversationSidebar({ convs, activeId, onSelect, q, setQ, unread, className = "" }) {
  return (
    <aside className={`w-full shrink-0 flex-col border-r border-slate-200/70 bg-white md:w-[300px] lg:w-[360px] ${className}`}>
      <div className="p-4 pb-3">
        <div className="relative">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations..." aria-label="Search conversations"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#2b47a3] focus:bg-white focus:ring-4 focus:ring-[#2b47a3]/15" />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {convs.length ? convs.map((c) => <ConversationItem key={c.id} c={c} active={c.id === activeId} onSelect={() => onSelect(c.id)} />)
          : <p className="px-4 py-10 text-center text-sm text-slate-400">No conversations found</p>}
      </div>
    </aside>
  );
}

/* ---------- Header + menu ---------- */
export function ConversationMenu({ c, actions }) {
  const [open, setOpen] = useState(false);
  const it = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50";
  const run = (fn) => () => { setOpen(false); fn(); };
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Conversation options" aria-expanded={open} className={`flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 ${ring}`}><MoreHorizontal size={20} /></button>
      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_10px_40px_-12px_rgba(22,41,107,0.25)]">
            <button className={it} onClick={run(actions.profile)}><User size={16} /> View Profile</button>
            <button className={it} onClick={run(actions.item)}><Eye size={16} /> View Item</button>
            {c.tx && <button className={it} onClick={run(actions.tx)}><Receipt size={16} /> View Transaction</button>}
            <div className="my-1 h-px bg-slate-100" />
            <button className={it} onClick={run(actions.report)}><Flag size={16} /> Report User</button>
            <button className={it} onClick={run(actions.block)}><Ban size={16} /> {c.blocked ? "Unblock User" : "Block User"}</button>
          </div>
        </>
      )}
    </div>
  );
}

export function ChatHeader({ c, onBack, actions }) {
  return (
    <header className="flex items-center gap-3 border-b border-slate-200/70 bg-white px-3 py-3 sm:px-5">
      <button onClick={onBack} aria-label="Back to messages" className={`flex items-center gap-1 rounded-lg py-1.5 pr-2 text-sm font-medium md:hidden ${ring}`} style={{ color: NAVY_LIGHT }}><ArrowLeft size={18} /> Messages</button>
      <Avatar name={c.name} online={c.online} />
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-semibold text-slate-900">{c.name}</h2>
        {/* Status indicator removed to eliminate hardcoded values */}
        <button onClick={actions.item} className="mt-0.5 block max-w-full truncate text-left text-xs hover:underline" style={{ color: NAVY_LIGHT }}>{c.item.name} • {peso(c.item.price)}</button>
      </div>
      <ConversationMenu c={c} actions={actions} />
    </header>
  );
}

export function MarketplaceContextCard({ item, onView }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 pr-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#eef1fa]"><CatIcon category={item.category} size={26} /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
        <p className="text-sm"><span className="font-bold" style={{ color: NAVY }}>{peso(item.price)}</span> <span className="text-xs text-slate-400">· {item.condition} Condition</span></p>
      </div>
      <button onClick={onView} className={`rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:shadow-sm ${ring}`}>View Item</button>
    </div>
  );
}

export function TransactionCard({ c, onView }) {
  return (
    <div className="mx-auto my-2 flex max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={soft}><Receipt size={18} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400">Transaction</p>
        <p className="truncate text-sm font-medium text-slate-900">{c.item.name} · {peso(c.item.price)}</p>
        <p className="flex items-center gap-1.5 text-xs text-slate-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {TX_LABEL[c.tx]}</p>
      </div>
      <button onClick={onView} style={{ background: NAVY_LIGHT }} className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 ${ring}`}>View Transaction</button>
    </div>
  );
}

/* ---------- Message bubble ---------- */
export function MessageBubble({ m, onReply, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const mine = m.me;
  if (m.deleted)
    return <div className={`flex ${mine ? "justify-end" : ""}`}><p className="rounded-2xl border border-dashed border-slate-200 px-3.5 py-2 text-xs italic text-slate-400">This message was deleted</p></div>;
  const copy = () => { navigator.clipboard?.writeText(m.text || "").catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1200); };
  const save = () => { const t = draft.trim(); if (t) onEdit(m.id, t); setEditing(false); };
  const tool = `flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${ring}`;
  const status = m.status === "sent" ? "Sent" : "Delivered";
  return (
    <div className={`group flex w-full min-w-0 items-start gap-2 ${mine ? "flex-row-reverse" : ""}`}>
      <div className={`flex min-w-0 max-w-[80%] flex-col ${mine ? "items-end" : "items-start"}`}>
        <div className={`min-w-0 max-w-full rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${mine ? "rounded-br-md text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800"}`}
          style={mine ? { background: NAVY_LIGHT } : undefined}>
          {m.replyTo && (
            <div className={`mb-1.5 min-w-0 max-w-full rounded-lg border-l-2 px-2.5 py-1 text-xs ${mine ? "bg-white/15" : "bg-slate-100"}`} style={{ borderColor: mine ? "rgba(255,255,255,.6)" : NAVY_LIGHT }}>
              <b className="font-semibold">{m.replyTo.name}</b> <span className="whitespace-pre-wrap opacity-80 [overflow-wrap:anywhere]">{m.replyTo.text}</span>
            </div>
          )}
          {m.image && <img src={m.image} alt="Attachment" className="mb-1 max-h-60 rounded-xl object-cover" />}
          {editing ? (
            <div className="w-64 max-w-full">
              <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === "Escape") setEditing(false); }}
                className="min-w-0 w-full max-w-full rounded-lg bg-white p-2 text-sm text-slate-900 outline-none" />
              <div className="mt-1.5 flex justify-end gap-2 text-xs font-medium">
                <button onClick={() => setEditing(false)} className="opacity-80 hover:underline">Cancel</button>
                <button onClick={save} className="hover:underline">Save</button>
              </div>
            </div>
          ) : m.text && <p className="min-w-0 max-w-full whitespace-pre-wrap [overflow-wrap:anywhere]">{m.text}</p>}
        </div>
        <p className="mt-1 px-1 text-[11px] text-slate-400">{clock(m.at)}{m.edited && " · edited"}{mine && ` · ${status}`}</p>
      </div>
      {!editing && (
        <div className="mb-5 flex items-center rounded-xl border border-slate-200 bg-white p-0.5 opacity-0 shadow-sm transition focus-within:opacity-100 group-hover:opacity-100">
          {m.text && <button className={tool} onClick={copy} aria-label="Copy">{copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}</button>}
          {!mine && <button className={tool} onClick={() => onReply(m)} aria-label="Reply"><Reply size={14} /></button>}
          {mine && m.text && <button className={tool} onClick={() => { setDraft(m.text); setEditing(true); }} aria-label="Edit"><Pencil size={14} /></button>}
          <button className={tool} onClick={() => onDelete(m.id)} aria-label="Delete"><Trash2 size={14} /></button>
        </div>
      )}
    </div>
  );
}

/* ---------- Composer ---------- */
const EMOJIS = ["😊", "😂", "👍", "🙏", "🎉", "❤️", "👌", "😅", "🤝", "📚", "💸", "✅"];

export function MessageComposer({ onSend, replyTo, onCancelReply, blocked, onUnblock, name }) {
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState(false);
  const taRef = useRef(null);
  if (blocked)
    return <div className="border-t border-slate-200/70 bg-white p-4 text-center text-sm text-slate-500">You blocked {name}. <button onClick={onUnblock} className="font-medium hover:underline" style={{ color: NAVY_LIGHT }}>Unblock</button> to send messages.</div>;

  // File attachments are temporarily disabled. Text and emoji messages remain available.
  const can = Boolean(text.trim());
  const send = () => {
    if (!can) return;
    onSend(text.trim());
    setText("");
    setEmoji(false);
    if (taRef.current) taRef.current.style.height = "auto";
  };
  const icon = `flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 ${ring}`;
  return (
    <div className="relative border-t border-slate-200/70 bg-white p-3 sm:p-4">
      {replyTo && (
        <div className="mb-2.5 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <span className="truncate">Replying to <b className="font-semibold text-slate-700">{replyTo.name}</b>: {replyTo.text}</span>
          <button onClick={onCancelReply} aria-label="Cancel reply" className="shrink-0 text-slate-400 hover:text-slate-700"><X size={15} /></button>
        </div>
      )}
      <div className="flex items-end gap-2.5">
        <div className="flex min-w-0 flex-1 items-end gap-1 rounded-2xl border border-slate-200 bg-white px-1.5 py-1.5 transition focus-within:border-[#2b47a3] focus-within:ring-4 focus-within:ring-[#2b47a3]/15 hover:border-slate-300">
          <textarea ref={taRef} value={text} rows={1} placeholder="Type a message..." aria-label="Message"
            onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="max-h-[120px] min-h-9 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2 text-[15px] outline-none placeholder:text-slate-400" />
          <button onClick={() => setEmoji((o) => !o)} aria-label="Emoji" aria-expanded={emoji} className={icon}><Smile size={19} /></button>
        </div>
        <button onClick={send} disabled={!can} style={can ? { background: NAVY_LIGHT } : undefined}
          className={`flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition duration-200 ${can ? "text-white shadow-md shadow-[#2b47a3]/25 hover:-translate-y-0.5 hover:brightness-110" : "cursor-not-allowed bg-slate-100 text-slate-400"} ${ring}`}>
          <Send size={16} /> <span className="hidden sm:inline">Send</span>
        </button>
      </div>
      {emoji && (
        <div className="absolute bottom-full right-20 mb-2 grid grid-cols-6 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-[0_10px_40px_-12px_rgba(22,41,107,0.25)]">
          {EMOJIS.map((e) => <button key={e} onClick={() => setText((t) => t + e)} className="h-9 w-9 rounded-lg text-xl hover:bg-slate-100">{e}</button>)}
        </div>
      )}
    </div>
  );
}

/* ---------- Modals ---------- */
const REASONS = ["Scam or suspicious behavior", "Harassment", "Inappropriate content", "Fake listing", "Other"];

export function ReportModal({ name, onClose }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <Modal onClose={onClose}>
      <div className="p-6 sm:p-7">
        {sent ? (
          <div className="py-4 text-center">
            <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
            <h2 className="mt-3 text-lg font-semibold text-slate-900">Report submitted</h2>
            <p className="mt-1 text-sm text-slate-500">Thanks for helping keep ADNU TRADE safe. Our team will review this conversation.</p>
            <button onClick={onClose} style={{ background: NAVY_LIGHT }} className={`${primary} mt-6`}>Done</button>
          </div>
        ) : (
          <>
            <h2 className="pr-8 text-xl font-semibold text-slate-900">Report Conversation</h2>
            <p className="mt-1 text-sm text-slate-500">Tell us what's wrong with your conversation with {name}.</p>
            <div className="mt-4 space-y-2" role="radiogroup" aria-label="Reason">
              {REASONS.map((r) => (
                <button key={r} role="radio" aria-checked={reason === r} onClick={() => setReason(r)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${ring} ${reason === r ? "text-slate-900" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                  style={reason === r ? { borderColor: NAVY_LIGHT, background: "#2b47a30a" } : undefined}>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border-2" style={{ borderColor: reason === r ? NAVY_LIGHT : "#cbd5e1" }}>{reason === r && <span className="h-1.5 w-1.5 rounded-full" style={{ background: NAVY_LIGHT }} />}</span>
                  {r}
                </button>
              ))}
            </div>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} placeholder="Add details (optional)"
              className="mt-3 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#2b47a3] focus:ring-4 focus:ring-[#2b47a3]/15" />
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button onClick={onClose} className={outline}>Cancel</button>
              <button disabled={!reason} onClick={() => setSent(true)} style={{ background: NAVY_LIGHT }} className={`${primary} disabled:opacity-50 disabled:hover:translate-y-0`}>Submit Report</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export function ProfileModal({ c, onClose }) {
  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col items-center p-8 text-center">
        <Avatar name={c.name} size={72} />
        <h2 className="mt-3 text-xl font-semibold text-slate-900">{c.name}</h2>
        <p className="mt-1 text-sm text-slate-500">AdNU Student</p>
        <button onClick={onClose} className={`${outline} mt-6`}>Close</button>
      </div>
    </Modal>
  );
}
