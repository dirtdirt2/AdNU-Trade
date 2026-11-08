import { useEffect, useState } from "react";
import {
  Search, MessageCircle, Bell, ChevronDown, Heart, Home, Store, ClipboardList, Bookmark, User,
  SlidersHorizontal, GraduationCap, Cpu, BookOpen, Shirt, Pencil, Package, PackageSearch, MapPin, LogOut, X, RotateCcw,
  Trash2, CheckCircle2, LayoutDashboard
} from "lucide-react";
import { NAVY, NAVY_LIGHT } from "../ui.jsx";
import logo from "../assets/logo-crop.png";
import { CATEGORIES, CONDITIONS, PRICES, SORTS, peso } from "./data.js";
import { profileStore, readTokenPayload } from "../profile/data.js";

export const NAV = [
  { id: "home", label: "Home", icon: Home },
  { id: "listings", label: "My Listings", icon: ClipboardList },
  { id: "transactions", label: "Transactions", icon: Package },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "saved", label: "Saved", icon: Bookmark },
  { id: "profile", label: "Profile", icon: User },
];

const CAT_ICON = { Electronics: Cpu, Books: BookOpen, Clothes: Shirt, "School Supplies": Pencil, Others: Package };
export const CatIcon = ({ category, size = 44 }) => {
  const I = CAT_ICON[category] || Package;
  return <I size={size} strokeWidth={1.4} style={{ color: NAVY_LIGHT, opacity: 0.45 }} />;
};

const soft = { color: NAVY_LIGHT, background: "#2b47a30f" };
const ring = "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2b47a3]/20";

export function BrandMark() {
  return (
    <a href="#/home" className="flex items-center gap-2.5" aria-label="ADNU Trade">
      <img src={logo} alt="ADNU Trade" className="h-12 w-auto select-none object-contain sm:h-16" draggable="false" />
    </a>
  );
}

export function SearchBar({ query, setQuery }) {
  return (
    <div className="relative mx-auto min-w-0 max-w-xl flex-1">
      <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="search" aria-label="Search items" placeholder="Search items..." value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-[15px] outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#2b47a3] focus:bg-white focus:ring-4 focus:ring-[#2b47a3]/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function Navbar({ query, setQuery, onNav, profileActive = false, msgActive = false, notificationActive = false }) {
  const [menu, setMenu] = useState(false);
  const [messageUnread, setMessageUnread] = useState(0);
  const [notificationUnread, setNotificationUnread] = useState(0);

  // Badges are driven by the authenticated user's actual unread records.
  // Counts refresh periodically and immediately after private inbox changes.
  useEffect(() => {
    let active = true;
    const refreshUnreadCounts = async () => {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) {
        if (active) { setMessageUnread(0); setNotificationUnread(0); }
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      const [messageResult, notificationResult] = await Promise.allSettled([
        fetch("http://localhost:5000/api/messages/unread-count", { headers, cache: "no-store" }),
        fetch("http://localhost:5000/api/notifications/unread-count", { headers, cache: "no-store" }),
      ]);
      if (!active) return;
      if (messageResult.status === "fulfilled" && messageResult.value.ok) {
        const data = await messageResult.value.json().catch(() => ({}));
        setMessageUnread(Number.isFinite(Number(data.count)) ? Number(data.count) : 0);
      } else {
        setMessageUnread(0);
      }
      if (notificationResult.status === "fulfilled" && notificationResult.value.ok) {
        const data = await notificationResult.value.json().catch(() => ({}));
        setNotificationUnread(Number.isFinite(Number(data.count)) ? Number(data.count) : 0);
      } else {
        setNotificationUnread(0);
      }
    };

    refreshUnreadCounts();
    const interval = window.setInterval(refreshUnreadCounts, 15000);
    const refreshOnFocus = () => refreshUnreadCounts();
    const refreshOnVisibility = () => { if (document.visibilityState === "visible") refreshUnreadCounts(); };
    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("adnu-unread-counts-changed", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("adnu-unread-counts-changed", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, []);

  // Resolve account role and display name from the signed-in session.
  const tokenPayload = readTokenPayload() || {};
  const isAdmin = tokenPayload.role === "admin";
  const tokenName = (tokenPayload.fullName || tokenPayload.name || "").trim();
  const displayName = tokenName.split(/\s+/)[0] || profileStore.first || "Account";

  const Icon = ({ icon: I, label, count = 0, active, onClick }) => (
    <button onClick={onClick} aria-label={count ? `${label}, ${count} unread` : label} aria-current={active ? "page" : undefined}
      className={`relative hidden h-10 w-10 items-center justify-center rounded-xl transition sm:flex ${active ? "" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"} ${ring}`}
      style={active ? soft : undefined}>
      <I size={20} />
      {count > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">{count > 99 ? "99+" : count}</span>}
    </button>
  );
  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50";
  return (
    <header className="sticky top-0 z-30 w-full shrink-0 border-b border-slate-200/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1500px] sm:h-20 items-center gap-3 px-4 sm:px-6">
        <div className="shrink-0 lg:w-52"><BrandMark /></div>
        <SearchBar query={query} setQuery={setQuery} />
        <div className="ml-auto flex items-center gap-1">
          <Icon icon={MessageCircle} label="Messages" count={messageUnread} active={msgActive} onClick={() => onNav("messages")} />
          <Icon icon={Bell} label="Notifications" count={notificationUnread} active={notificationActive} onClick={() => onNav("notifications")} />
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} style={profileActive ? soft : undefined} className={`flex items-center gap-2 rounded-xl p-1.5 pr-2 transition hover:bg-slate-100 ${ring}`}>
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-sm font-semibold" style={soft}>{displayName[0]?.toUpperCase() || 'A'}</span>
              <span className="hidden text-sm font-medium text-slate-700 md:block">{displayName}</span>
              <ChevronDown size={16} className={`text-slate-400 transition ${menu ? "rotate-180" : ""}`} />
            </button>
            {menu && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_10px_40px_-12px_rgba(22,41,107,0.25)]" onClick={() => setMenu(false)}>
                <button className={item} onClick={() => onNav("profile")}><User size={16} /> Profile</button>
                {isAdmin && (
                  <button className={item} onClick={() => { window.location.hash = "#/admin"; }}>
                    <LayoutDashboard size={16} /> Switch to Admin Dashboard
                  </button>
                )}
                <a href="#/" className={item} onClick={() => { localStorage.removeItem('token'); sessionStorage.removeItem('token'); }}><LogOut size={16} /> Sign out</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function Sidebar({ view, onNav }) {
  return (
    <aside className="sticky top-20 hidden h-[calc(100vh-5rem)] w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white/60 p-4 lg:flex">
      <nav className="space-y-1" aria-label="Main">
        {NAV.map(({ id, label, icon: I }) => {
          const on = view === id;
          return (
            <button key={id} onClick={() => onNav(id)} aria-current={on ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${on ? "font-semibold" : "text-slate-600 hover:bg-slate-100"} ${ring}`}
              style={on ? soft : undefined}>
              <I size={19} /> {label}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto rounded-2xl border border-slate-200 bg-white p-3.5">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={soft}>
          <GraduationCap size={13} /> AdNU Students
        </span>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">Ateneo de Naga University Student Marketplace</p>
      </div>
    </aside>
  );
}

export function BottomNav({ view, onNav }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Main">
      {NAV.map(({ id, label, icon: I }) => {
        const on = view === id;
        return (
          <button key={id} onClick={() => onNav(id)} aria-current={on ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${on ? "font-semibold" : "text-slate-500"}`} style={on ? { color: NAVY_LIGHT } : undefined}>
            <I size={20} /> {label.replace("My ", "")}
          </button>
        );
      })}
    </nav>
  );
}

export function CategoryFilter({ category, setCategory }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
      {["All", ...CATEGORIES].map((c) => {
        const on = category === c;
        return (
          <button key={c} role="tab" aria-selected={on} onClick={() => setCategory(c)}
            style={on ? { background: NAVY_LIGHT } : undefined}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition duration-200 hover:-translate-y-0.5 ${ring} ${on ? "border-transparent text-white shadow-md shadow-[#2b47a3]/25" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:shadow-sm"}`}>
            {c}
          </button>
        );
      })}
    </div>
  );
}

const Chip = ({ on, children, ...p }) => (
  <button {...p} aria-pressed={on} style={on ? { background: NAVY_LIGHT } : undefined}
    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? "border-transparent text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
    {children}
  </button>
);

export function FilterPanel({ category, setCategory, filters, setFilters, onClose }) {
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const Group = ({ title, children }) => (
    <div><p className="mb-2 text-xs font-semibold text-slate-500">{title}</p><div className="flex flex-wrap gap-1.5">{children}</div></div>
  );
  return (
    <div className="absolute right-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_40px_-12px_rgba(22,41,107,0.25)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Filters</h3>
        <button onClick={() => { setCategory("All"); setFilters({ price: "any", condition: "Any", sort: "newest" }); }} className="flex items-center gap-1 text-xs text-slate-500 hover:underline"><RotateCcw size={12} /> Reset</button>
      </div>
      <Group title="Category">{["All", ...CATEGORIES].map((c) => <Chip key={c} on={category === c} onClick={() => setCategory(c)}>{c}</Chip>)}</Group>
      <Group title="Price">{PRICES.map((p) => <Chip key={p.id} on={filters.price === p.id} onClick={() => set("price", p.id)}>{p.label}</Chip>)}</Group>
      <Group title="Condition">{["Any", ...CONDITIONS].map((c) => <Chip key={c} on={filters.condition === c} onClick={() => set("condition", c)}>{c}</Chip>)}</Group>
      <Group title="Sort by">{SORTS.map((s) => <Chip key={s.id} on={filters.sort === s.id} onClick={() => set("sort", s.id)}>{s.label}</Chip>)}</Group>
      <button onClick={onClose} style={{ background: NAVY_LIGHT }} className="h-10 w-full rounded-xl text-sm font-semibold text-white transition hover:brightness-110">Show results</button>
    </div>
  );
}

export function ProductGrid({ items, favs, onFav, onOpen, onDelete, onAcceptCounter, onCounter, onPayListing }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => {
        const isFav = favs?.has(item.id);

        const sortedFees = item.listingFees && item.listingFees.length > 0
          ? [...item.listingFees].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
          : [];

        const latestFee = sortedFees.length > 0 ? sortedFees[sortedFees.length - 1] : null;
        const isAdminCounter = (item.status === 'fee_proposed' || item.status === 'negotiating') && latestFee && latestFee.status === 'pending' && latestFee.proposedBy !== 'You';
        const isSellerCounter = item.mine && item.status === 'negotiating' && latestFee && latestFee.status === 'pending' && latestFee.proposedBy === 'You';
        const isAwaitingPayment = item.mine && item.status === 'awaiting_payment';
        const isPaymentSubmitted = item.mine && item.status === 'payment_submitted';
        const isSoldOrCompleted = item.status === 'sold' || item.status === 'completed' || item.isCompleted;

        return (
          <div
            key={item.id}
            className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:shadow-md ${isSoldOrCompleted ? "opacity-85 bg-slate-50/50" : ""}`}
          >
            <div
              onClick={() => onOpen(item)}
              className="aspect-square cursor-pointer overflow-hidden bg-slate-100 relative"
            >
              {item.images && item.images.length > 0 ? (
                <img src={item.images[0]} alt={item.name} className={`h-full w-full object-cover transition group-hover:scale-105 ${isSoldOrCompleted ? "grayscale-[25%]" : ""}`} />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400 text-xs">No image</div>
              )}

              {item.mine && item.status && (
                <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
                  {isSoldOrCompleted && (
                    <span className="flex items-center gap-1 rounded-full bg-slate-900/90 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur">
                      <CheckCircle2 size={12} className="text-emerald-400" /> Completed / Sold
                    </span>
                  )}
                  {!isSoldOrCompleted && item.status === 'pending_review' && (
                    <span className="rounded-full bg-amber-500/90 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur">
                      {item.listingFeeWaived ? 'Pending Review · Fee Waived' : 'Pending Review'}
                    </span>
                  )}
                  {!isSoldOrCompleted && isAdminCounter && (
                    <span className="rounded-full bg-blue-600/90 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur">
                      Admin Offer: ₱{parseFloat(latestFee.proposedFee).toFixed(2)}
                    </span>
                  )}
                  {!isSoldOrCompleted && isSellerCounter && (
                    <span className="rounded-full bg-violet-600/90 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur">
                      Your Counter · Waiting for Admin
                    </span>
                  )}
                  {!isSoldOrCompleted && isAwaitingPayment && (
                    <span className="rounded-full bg-orange-500/90 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur">
                      Fee Accepted · Payment Required
                    </span>
                  )}
                  {!isSoldOrCompleted && isPaymentSubmitted && (
                    <span className="rounded-full bg-sky-600/90 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur">
                      Payment Under Verification
                    </span>
                  )}
                  {!isSoldOrCompleted && item.status === 'approved' && (
                    <span className="rounded-full bg-emerald-600/90 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur">
                      Approved & Live
                    </span>
                  )}
                  {!isSoldOrCompleted && item.status === 'rejected' && (
                    <span className="rounded-full bg-rose-600/90 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur">
                      Rejected
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col justify-between p-4">
              <div onClick={() => onOpen(item)} className="cursor-pointer">
                <span className="text-xs font-medium text-slate-400">{item.category}</span>
                <h3 className="mt-1 font-semibold text-slate-900 line-clamp-1">{item.name}</h3>
                <p className="mt-1 text-lg font-bold text-blue-900">₱{item.price.toFixed(2)}</p>
              </div>

              {item.mine && isAdminCounter && !isSoldOrCompleted && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 border border-slate-200">
                  <p className="text-xs text-slate-600 mb-2">
                    Admin proposed a fee of <strong className="text-slate-900">₱{parseFloat(latestFee.proposedFee).toFixed(2)}</strong>.
                  </p>
                  {latestFee.message && <p className="mb-2 text-xs text-slate-500">“{latestFee.message}”</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onAcceptCounter) onAcceptCounter(item.id, latestFee.id);
                      }}
                      className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                    >
                      Accept Fee
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onCounter) onCounter(item, latestFee);
                      }}
                      className="flex-1 rounded-lg border border-slate-300 bg-white py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      Counter
                    </button>
                  </div>
                </div>
              )}

              {item.mine && item.status === 'rejected' && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <p className="text-xs font-bold text-rose-900">Listing closed</p>
                  {item.rejectionReason ? (
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-rose-800">Reason from AdNU Trade Administration: {item.rejectionReason}</p>
                  ) : (
                    <p className="mt-1 text-xs leading-relaxed text-rose-800">This listing was closed after the listing-fee offer was declined.</p>
                  )}
                </div>
              )}

              {item.mine && sortedFees.length > 0 && (
                <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">Fee negotiation messages ({sortedFees.length})</summary>
                  <div className="mt-3 space-y-2">
                    {sortedFees.map((fee) => (
                      <div key={fee.id} className="rounded-lg bg-slate-50 p-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <strong>{fee.proposedBy === 'You' ? 'You' : 'Admin'}</strong>
                          <strong>₱{Number(fee.proposedFee).toFixed(2)}</strong>
                        </div>
                        <p className="mt-0.5 text-[10px] capitalize text-slate-400">{fee.status}</p>
                        {fee.message && <p className="mt-1 text-slate-600">{fee.message}</p>}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {isAwaitingPayment && (
                <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <p className="text-xs text-orange-900">Your fee was accepted at <strong>₱{Number(latestFee?.proposedFee || 0).toFixed(2)}</strong>. Submit your e-wallet transfer proof; the product will only go public after verification.</p>
                  {item.paymentReviewNote && item.paymentStatus === 'rejected' && <p className="mt-2 text-xs text-red-700">Admin note: {item.paymentReviewNote}</p>}
                  <button onClick={(e) => { e.stopPropagation(); onPayListing?.(item); }} className="mt-2 w-full rounded-lg bg-blue-900 py-2 text-xs font-semibold text-white hover:bg-blue-800">Pay Listing Fee</button>
                </div>
              )}

              {isPaymentSubmitted && (
                <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
                  <p className="text-xs text-sky-900">Your transfer proof has been submitted. The listing will be published once an administrator verifies the payment.</p>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">{item.condition}</span>

                {item.mine && onDelete ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 p-1.5 rounded-lg hover:bg-red-50 transition"
                    title="Delete listing"
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFav(item.id);
                    }}
                    className={`text-xs font-medium ${isFav ? "text-rose-500" : "text-slate-400"} hover:text-rose-500`}
                  >
                    {isFav ? "Saved" : "Save"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label="Loading items">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          <div className="aspect-[4/3] bg-slate-100" />
          <div className="space-y-2.5 p-4"><div className="h-4 w-3/4 rounded bg-slate-100" /><div className="h-6 w-1/3 rounded bg-slate-100" /><div className="h-3 w-1/2 rounded bg-slate-100" /></div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, text, action, onAction, icon: I = PackageSearch }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={soft}><I size={26} /></span>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>
      {action && <button onClick={onAction} style={{ background: NAVY_LIGHT }} className="mt-6 h-11 rounded-xl px-6 text-sm font-semibold text-white shadow-md shadow-[#2b47a3]/25 transition hover:-translate-y-0.5 hover:brightness-110">{action}</button>}
    </div>
  );
}