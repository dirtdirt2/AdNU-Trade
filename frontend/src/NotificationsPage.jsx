import { useCallback, useEffect, useState } from "react";
import {
  Bell, CheckCheck, Package, CheckCircle2, XCircle, Wallet, ShoppingBag,
  ArrowUpRight, Clock3, Info, Loader2,
} from "lucide-react";
import { Navbar } from "./market/components.jsx";

const API_BASE = "http://localhost:5000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");
const go = (hash) => { window.location.hash = hash; };

const notificationVisual = (type = "general") => {
  if (type.includes("rejected")) return { icon: XCircle, color: "text-rose-600", bg: "bg-rose-50" };
  if (type.includes("approved") || type.includes("verified") || type.includes("completed")) return { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" };
  if (type.includes("payment")) return { icon: Wallet, color: "text-amber-600", bg: "bg-amber-50" };
  if (type.includes("transaction") || type.includes("meetup")) return { icon: ShoppingBag, color: "text-blue-600", bg: "bg-blue-50" };
  if (type.includes("listing")) return { icon: Package, color: "text-indigo-600", bg: "bg-indigo-50" };
  return { icon: Info, color: "text-slate-600", bg: "bg-slate-100" };
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
};

export default function NotificationsPage() {
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchNotifications = useCallback(async () => {
    const token = getToken();
    if (!token) { go("#/"); return; }
    try {
      const response = await fetch(`${API_BASE}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load notifications.");
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unreadCount) || 0);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 20000);
    return () => window.clearInterval(interval);
  }, [fetchNotifications]);

  const markOneRead = async (notification) => {
    if (!notification || notification.readAt) return;
    const token = getToken();
    try {
      const response = await fetch(`${API_BASE}/api/notifications/${notification.id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Could not update this notification.");
      const now = new Date().toISOString();
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, readAt: now } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
      window.dispatchEvent(new Event("adnu-unread-counts-changed"));
    } catch (err) {
      setError(err.message);
    }
  };

  const markAllRead = async () => {
    if (!unreadCount || updating) return;
    setUpdating(true);
    try {
      const response = await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update notifications.");
      const now = new Date().toISOString();
      setNotifications((items) => items.map((item) => item.readAt ? item : { ...item, readAt: now }));
      setUnreadCount(0);
      window.dispatchEvent(new Event("adnu-unread-counts-changed"));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const visibleNotifications = notifications.filter((item) => {
    if (filter === "unread" && item.readAt) return false;
    if (filter === "read" && !item.readAt) return false;
    const term = query.trim().toLowerCase();
    return !term || `${item.title} ${item.body}`.toLowerCase().includes(term);
  });

  const openNotification = async (item) => {
    await markOneRead(item);
    if (item.link && item.link.startsWith("#/")) go(item.link);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar query={query} setQuery={setQuery} onNav={(value) => go(`#/${value}`)} notificationActive />
      <main className="mx-auto max-w-[1050px] px-4 pb-20 pt-8 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Notifications</h1>
              {unreadCount > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">{unreadCount} unread</span>}
            </div>
            <p className="mt-1.5 text-sm text-slate-500">Updates about your listings, payments, and transactions.</p>
          </div>
          <button type="button" onClick={markAllRead} disabled={!unreadCount || updating}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            {updating ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
            Mark all as read
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          {[{ id: "all", label: "All" }, { id: "unread", label: "Unread" }, { id: "read", label: "Read" }].map((option) => (
            <button key={option.id} onClick={() => setFilter(option.id)} aria-pressed={filter === option.id}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${filter === option.id ? "bg-[#2b47a3] text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>
              {option.label}
            </button>
          ))}
        </div>

        {error && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Notification list">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /> Loading notifications...</div>
          ) : visibleNotifications.length ? (
            <div className="divide-y divide-slate-100">
              {visibleNotifications.map((item) => {
                const visual = notificationVisual(item.type);
                const Icon = visual.icon;
                const unread = !item.readAt;
                return (
                  <button key={item.id} type="button" onClick={() => openNotification(item)}
                    className={`flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5 ${unread ? "bg-blue-50/40" : "bg-white"}`}>
                    <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${visual.bg} ${visual.color}`}><Icon size={19} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm ${unread ? "font-semibold text-slate-900" : "font-medium text-slate-800"}`}>{item.title}</span>
                        {unread && <span className="h-2 w-2 rounded-full bg-blue-600" aria-label="Unread" />}
                      </span>
                      <span className="mt-1 block whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{item.body}</span>
                      <span className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><Clock3 size={12} /> {formatDate(item.createdAt)}</span>
                    </span>
                    {item.link && <ArrowUpRight size={17} className="mt-1 shrink-0 text-slate-300" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Bell size={25} /></span>
              <h2 className="mt-4 text-base font-semibold text-slate-800">{filter === "unread" ? "You're all caught up" : filter === "read" ? "No read notifications" : "No notifications yet"}</h2>
              <p className="mt-1 max-w-sm text-sm text-slate-500">When something needs your attention, such as a listing review or transaction update, it will appear here.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
