import { useEffect, useMemo, useState } from "react";
import { Plus, SlidersHorizontal, ClipboardList, MessageCircle, User, Package } from "lucide-react";
import { NAVY_LIGHT } from "./ui.jsx";
import { Navbar, Sidebar, BottomNav, CategoryFilter, FilterPanel, ProductGrid, LoadingSkeleton, EmptyState } from "./market/components.jsx";
import { ProductDetails, MessageSeller, SellModal, Modal } from "./market/Details.jsx";
import { PRICES } from "./market/data.js";
import { store } from "./market/store.js";
import AdminPage from "./AdminPage";
import MessagesPage from "./MessagesPage.jsx";
import TransactionPage from "./TransactionPage.jsx";

const TITLES = {
  home: ["Discover Items", "Find textbooks, electronics, clothes, and more from fellow AdNU students."],
  listings: ["My Listings", "Items you're selling."],
  transactions: ["Transactions", "Manage your active campus meetup transactions."],
  messages: ["Messages", "Your conversations with buyers and sellers."],
  profile: ["Profile", "Your account details."],
  admin: ["Admin Portal", "Review pending listings and listing fee proposals."],
};
const DEFAULT_FILTERS = { price: "any", condition: "Any", sort: "newest" };

// Consistent status colors for buyer and seller transaction cards.
const TRANSACTION_STATUS_BADGES = {
  placed: "border-sky-200 bg-sky-50 text-sky-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  confirmed: "border-blue-200 bg-blue-50 text-blue-700",
  ready: "border-violet-200 bg-violet-50 text-violet-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};
const DEFAULT_TRANSACTION_STATUS_BADGE = "border-slate-200 bg-slate-100 text-slate-600";

// Resolve the signed-in user from the JWT issued by the backend.
// The JWT payload is base64url-encoded and may contain Unicode profile fields.
const getCurrentUserId = () => {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  if (!token) return null;

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;

    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(paddedBase64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));

    return payload.userId || payload.id || payload.sub || null;
  } catch (error) {
    console.error("Unable to read the signed-in user from the session token:", error);
    return null;
  }
};

export default function HomePage() {
  const [view, setView] = useState(() => {
    const hash = window.location.hash.replace(/^#\/?/, "");
    return ["home", "listings", "transactions", "transaction", "messages", "profile", "admin"].includes(hash) ? hash : "home";
  });
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFilter, setShowFilter] = useState(false);
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [favs, setFavs] = useState(() => store.favs instanceof Set ? store.favs : new Set());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(store.open);
  const [chat, setChat] = useState(null); // { item, mode }
  const [sell, setSell] = useState(false);
  const [counterListing, setCounterListing] = useState(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [paymentListing, setPaymentListing] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ walletProvider: "", senderName: "", referenceNumber: "", proof: null });
  const [paymentError, setPaymentError] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const currentUserId = getCurrentUserId();

  useEffect(() => { store.open = null; }, []);
  useEffect(() => { store.favs = favs; }, [favs]);

  // Saved items are account data now, so restore the user's favorites from MySQL.
  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return () => { active = false; };

    fetch('http://localhost:5000/api/profile/favorites', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => []);
        if (!response.ok) throw new Error(data.error || 'Could not load saved items.');
        if (active && Array.isArray(data)) {
          const next = new Set(data.map((product) => product.id));
          setFavs(next);
          store.favs = next;
        }
      })
      .catch((error) => console.error('Failed to load saved items:', error));

    return () => { active = false; };
  }, []);

  // Sync hash routing on load and changes
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, "");
      if (["home", "listings", "transactions", "transaction", "messages", "profile", "admin"].includes(hash)) {
        setView(hash);
      }
    };
    window.addEventListener("hashchange", handleHash);
    if (window.location.hash) handleHash();
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  // Fetch products or transactions based on view
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');

        if (view === 'transactions') {
          const res = await fetch('http://localhost:5000/api/transactions', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });
          if (res.ok) {
            const data = await res.json();
            setTransactions(data);
          }
        } else if (["home", "listings"].includes(view)) {
          let url = 'http://localhost:5000/api/products';
          if (view === 'listings') {
            url = 'http://localhost:5000/api/products/my-listings';
          }

          const res = await fetch(url, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });

          if (res.ok) {
            const data = await res.json();
            const formatted = data.map(p => ({
              id: p.id,
              name: p.title,
              desc: p.description,
              price: parseFloat(p.price),
              category: p.category,
              condition: p.condition || 'Good',
              images: Array.isArray(p.images) ? p.images : [],
              seller: p.seller, // Pass the whole seller object or name
              sellerId: p.sellerId || p.userId || p.seller?.id, // Explicitly map seller ID
              userId: p.userId,
              mine: view === 'listings' ? true : false,
              status: p.status,
              listingFeeWaived: Boolean(p.listingFeeWaived),
              isCompleted: p.status === 'sold' || p.status === 'completed',
              listingFees: p.listingFees || [],
              listingPayments: p.listingPayments || [],
              rejectionReason: p.rejectionReason || "",
              paymentStatus: p.listingPayments?.[0]?.status || null,
              paymentReviewNote: p.listingPayments?.[0]?.reviewNote || null,
              createdAt: p.createdAt
            }));
            setItems(formatted);
          }
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (["home", "listings", "transactions"].includes(view)) {
      fetchData();
    }
  }, [view, category]);

  const toggleFav = async (id) => {
    const wasSaved = favs.has(id);
    const previous = favs;
    const next = new Set(favs);
    if (wasSaved) next.delete(id); else next.add(id);
    setFavs(next);
    store.favs = next;

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/profile/favorites/${id}`, {
        method: wasSaved ? 'DELETE' : 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update saved items.');
    } catch (error) {
      setFavs(previous);
      store.favs = previous;
      alert(error.message);
    }
  };

  const handleDeleteListing = async (productId) => {
    if (!confirm("Are you sure you want to delete this listing?")) return;

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete listing.");

      setItems((prev) => prev.filter((item) => item.id !== productId));
    } catch (err) {
      alert(err.message);
    }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const price = PRICES.find((p) => p.id === filters.price);
    let list = items.filter((i) =>
      (view === "listings" ? i.mine : true) &&
      (category === "All" || i.category === category) &&
      price.test(i.price) &&
      (filters.condition === "Any" || i.condition === filters.condition) &&
      (!q || [i.name, i.desc, i.category, i.seller?.fullName, i.seller?.email].filter(Boolean).some((s) => s.toLowerCase().includes(q)))
    );
    if (filters.sort === "low") list = [...list].sort((a, b) => a.price - b.price);
    else if (filters.sort === "high") list = [...list].sort((a, b) => b.price - a.price);
    else list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(new Date(a.createdAt)));
    return list;
  }, [items, view, category, query, filters]);

  // Update URL hash when navigating tabs
  const go = (v) => {
    window.location.hash = `#/${v}`;
    setShowFilter(false);
  };

  const reset = () => { setCategory("All"); setQuery(""); setFilters(DEFAULT_FILTERS); };
  const isGrid = ["home", "listings"].includes(view);
  const [title, sub] = TITLES[view] || TITLES.home;

  const emptyFor = {
    listings: !items.length ? ["You haven't listed anything", "Post your first item to start selling to fellow students.", "+ Sell an Item", () => setSell(true)] : null,
    transactions: !transactions.length ? ["No transactions yet", "Active campus meetup purchases will appear here.", "Browse Marketplace", () => go("home")] : null,
  }[view] || ["No items found", "Try searching for something else or choose another category.", "Browse All Items", () => { reset(); go("home"); }];

  const handleAcceptCounter = async (productId) => {
    if (!confirm("Accept this listing fee? Your product will remain private until you submit payment and an admin verifies it.")) return;
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/products/${productId}/fee-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'accept' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept listing fee.");
      setItems((prev) => prev.map((item) => item.id === productId ? { ...item, status: 'awaiting_payment' } : item));
      alert("Fee accepted. You can now submit your e-wallet transfer proof.");
    } catch (err) {
      alert(err.message);
    }
  };

  const openCounterModal = (item, fee) => {
    setCounterListing({ ...item, currentFee: fee?.proposedFee });
    setCounterAmount(String(fee?.proposedFee ?? ""));
    setCounterMessage("");
    setPaymentError("");
  };

  const submitCounterOffer = async () => {
    const numericCounterAmount = Number(counterAmount);
    if (!counterListing || !Number.isSafeInteger(numericCounterAmount) || numericCounterAmount < 1 || numericCounterAmount > 99999999) {
      setPaymentError("Enter a whole-number counter-offer from ₱1 to ₱99,999,999. Decimals, zero, and negative amounts are not allowed.");
      return;
    }
    setPaymentLoading(true);
    setPaymentError("");
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/products/${counterListing.id}/fee-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'counter', counterOfferAmount: Number(counterAmount), message: counterMessage })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send counter-offer.");
      setItems((prev) => prev.map((item) => item.id === counterListing.id ? {
        ...item, status: 'negotiating', listingFees: [
          { ...data.listingFee, proposedBy: 'You' }, ...(item.listingFees || [])
        ]
      } : item));
      setCounterListing(null);
    } catch (err) {
      setPaymentError(err.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const openPaymentModal = async (item) => {
    setPaymentListing(item);
    setPaymentInfo(null);
    setPaymentError("");
    setPaymentForm({ walletProvider: "", senderName: "", referenceNumber: "", proof: null });
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/listing-payments/${item.id}/instructions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load payment instructions.");
      setPaymentInfo(data);
      setPaymentForm((prev) => ({ ...prev, walletProvider: data.instructions?.provider || "" }));
    } catch (err) {
      setPaymentError(err.message);
    }
  };

  const submitListingPayment = async (event) => {
    event.preventDefault();
    if (!paymentListing || !paymentForm.proof || !paymentForm.referenceNumber.trim() || !paymentForm.walletProvider.trim()) {
      setPaymentError("Select your receipt and enter the e-wallet and reference details.");
      return;
    }
    setPaymentLoading(true);
    setPaymentError("");
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const body = new FormData();
      body.append('walletProvider', paymentForm.walletProvider);
      body.append('senderName', paymentForm.senderName);
      body.append('referenceNumber', paymentForm.referenceNumber);
      body.append('proof', paymentForm.proof);
      const res = await fetch(`http://localhost:5000/api/listing-payments/${paymentListing.id}`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit payment proof.");
      setItems((prev) => prev.map((item) => item.id === paymentListing.id ? { ...item, status: 'payment_submitted', paymentStatus: 'submitted' } : item));
      setPaymentListing(null);
      alert("Payment proof submitted. Your listing will become public after admin verification.");
    } catch (err) {
      setPaymentError(err.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  // If viewing messages, delegate directly to MessagesPage
  if (view === "messages") {
    return <MessagesPage />;
  }

  // If viewing transaction, delegate directly to TransactionPage
  if (view === "transaction") {
    return <TransactionPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar query={query} setQuery={setQuery} onNav={go} />
      <div className="mx-auto flex max-w-[1500px]">
        <Sidebar view={view} onNav={go} />
        <main className="min-w-0 flex-1 px-4 pb-28 pt-8 sm:px-8 lg:pb-12">
          <div className="mx-auto max-w-[1200px]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
                <p className="mt-1.5 text-sm text-slate-500">{sub}</p>
              </div>
              <button onClick={() => setSell(true)} style={{ background: NAVY_LIGHT }}
                className="flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-md shadow-[#2b47a3]/25 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2b47a3]/30">
                <Plus size={18} /> Sell an Item
              </button>
            </div>

            {isGrid ? (
              <>
                <div className="mt-7 flex items-start gap-3">
                  <div className="min-w-0 flex-1"><CategoryFilter category={category} setCategory={setCategory} /></div>
                  <div className="relative shrink-0">
                    <button onClick={() => setShowFilter((s) => !s)} aria-expanded={showFilter}
                      className="flex h-[38px] items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2b47a3]/20">
                      <SlidersHorizontal size={16} /> Filter
                      {(filters.price !== "any" || filters.condition !== "Any" || filters.sort !== "newest") && <span className="h-2 w-2 rounded-full" style={{ background: NAVY_LIGHT }} />}
                    </button>
                    {showFilter && <FilterPanel category={category} setCategory={setCategory} filters={filters} setFilters={setFilters} onClose={() => setShowFilter(false)} />}
                  </div>
                </div>
                <p className="mt-5 text-sm text-slate-400" aria-live="polite">{loading ? "Loading…" : `${shown.length} item${shown.length === 1 ? "" : "s"}${query ? ` for “${query}”` : ""}`}</p>
                <div className="mt-3">
                  {loading ? <LoadingSkeleton />
                    : shown.length ? <ProductGrid
                        items={shown}
                        favs={favs}
                        onFav={toggleFav}
                        onOpen={setSelected}
                        onDelete={handleDeleteListing}
                        onAcceptCounter={handleAcceptCounter}
                        onCounter={openCounterModal}
                        onPayListing={openPaymentModal}
                      />
                    : <EmptyState title={emptyFor[0]} text={emptyFor[1]} action={emptyFor[2]} onAction={emptyFor[3]} />}
                </div>
              </>
            ) : view === "transactions" ? (
              <div className="mt-8 space-y-4">
                {loading ? (
                  <p className="text-sm text-slate-500 animate-pulse">Loading transactions...</p>
                ) : transactions.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {transactions.map((tx) => {
                      const transactionStatus = String(tx.status || "placed").trim().toLowerCase();
                      const statusBadgeClass = TRANSACTION_STATUS_BADGES[transactionStatus] || DEFAULT_TRANSACTION_STATUS_BADGE;
                      const transactionSellerId = tx.sellerId || tx.seller?.id || tx.product?.sellerId || tx.product?.seller?.id;
                      const isSeller = Boolean(
                        currentUserId &&
                        transactionSellerId &&
                        String(currentUserId) === String(transactionSellerId)
                      );

                      return (
                      <div key={tx.id || tx.trackingCode} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-full">{tx.trackingCode}</span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClass}`}
                            aria-label={`Transaction status: ${transactionStatus}`}
                          >
                            {transactionStatus.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{tx.product?.title || "Marketplace Item"}</h3>
                          <p className="text-sm font-bold text-slate-800 mt-0.5">₱{parseFloat(tx.product?.price || 0).toFixed(2)}</p>
                        </div>
                        <p className="text-xs text-slate-500">Meetup: {tx.location || "AdNU Campus"} ({tx.meetupDate || "TBD"})</p>
                        <button
                          onClick={() => {
                            const activeId = tx.id || tx.trackingCode;
                            store.txId = activeId;
                            store.tx = tx.product;
                            store.txStatus = tx.status;
                            localStorage.setItem('adnu_active_txId', activeId);
                            window.location.hash = "#/transaction";
                          }}
                          style={{ background: NAVY_LIGHT }}
                          className="w-full mt-2 h-10 rounded-xl text-xs font-semibold text-white transition hover:brightness-110"
                        >
                          {isSeller ? "View Transaction & Approve" : "View Transaction"}
                        </button>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState icon={Package} title={emptyFor[0]} text={emptyFor[1]} action={emptyFor[2]} onAction={emptyFor[3]} />
                )}
              </div>
            ) : (
              <div className="mt-8">
                {view === "admin" ? (
                  <AdminPage />
                ) : (
                  <EmptyState icon={User} title="Profile coming soon" text="Your student profile page is the next screen to build." action="Back to Home" onAction={() => go("home")} />
                )}
              </div>
            )}
          </div>
        </main>
      </div>
      <BottomNav view={view} onNav={go} />

      {selected && !chat && (
        <ProductDetails
          item={selected}
          fav={favs.has(selected.id)}
          onFav={() => toggleFav(selected.id)}
          onMessage={(item, mode) => { setSelected(null); setChat({ item, mode }); }}
          onBuy={(i) => {
            localStorage.removeItem('adnu_active_txId');
            store.tx = i;
            store.txId = null;
            store.txStatus = "placed";
            localStorage.setItem('adnu_active_item', JSON.stringify(i));
            window.location.hash = "#/transaction";
          }}
          onClose={() => setSelected(null)}
        />
      )}
      {chat && <MessageSeller item={chat.item} mode={chat.mode} onBack={() => { setSelected(chat.item); setChat(null); }} onClose={() => setChat(null)} />}

      {sell && (
        <SellModal
          onClose={() => setSell(false)}
          onAdd={async (formData) => {
            try {
              const token = localStorage.getItem('token') || sessionStorage.getItem('token');
              const res = await fetch('http://localhost:5000/api/products', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`
                },
                body: formData
              });

              if (res.ok) {
                setSell(false);
                go("listings");
              } else {
                const errorData = await res.json();
                alert(errorData.error || 'Failed to submit listing.');
              }
            } catch (err) {
              console.error('Error submitting product:', err);
            }
          }}
        />
      )}

      {counterListing && (
        <Modal onClose={() => setCounterListing(null)}>
          <form onSubmit={(e) => { e.preventDefault(); submitCounterOffer(); }} className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900">Counter the listing fee</h2>
            <p className="text-sm text-slate-500">{counterListing.name} · Admin offer: ₱{Number(counterListing.currentFee || 0).toFixed(2)}</p>
            <label className="block text-sm font-medium text-slate-700">Your counter-offer (₱)
              <input type="number" min="1" max="99999999" step="1" inputMode="numeric" required value={counterAmount} onChange={(e) => setCounterAmount(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3" />
              <span className="mt-1 block text-xs text-slate-500">Whole numbers only (₱1–₱99,999,999).</span>
            </label>
            <label className="block text-sm font-medium text-slate-700">Message to admin (optional)
              <textarea rows={3} maxLength={1000} value={counterMessage} onChange={(e) => setCounterMessage(e.target.value)} placeholder="Explain your counter-offer..." className="mt-1.5 w-full rounded-xl border border-slate-300 p-3" />
            </label>
            {paymentError && <p className="text-sm text-red-600">{paymentError}</p>}
            <button disabled={paymentLoading} className="h-11 w-full rounded-xl bg-blue-900 font-semibold text-white disabled:opacity-50">{paymentLoading ? "Sending..." : "Send counter-offer"}</button>
          </form>
        </Modal>
      )}

      {paymentListing && (
        <Modal onClose={() => setPaymentListing(null)} wide>
          <form onSubmit={submitListingPayment} className="space-y-4 p-6 sm:p-7">
            <h2 className="text-lg font-semibold text-slate-900">Pay your listing fee</h2>
            <p className="text-sm text-slate-500">{paymentListing.name}</p>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Agreed listing fee</p>
              <p className="mt-1 text-2xl font-bold text-blue-950">₱{Number(paymentInfo?.amount ?? paymentListing.listingFees?.[0]?.proposedFee ?? 0).toFixed(2)}</p>
              <div className="mt-3 space-y-1 text-sm text-blue-950">
                <p><strong>E-wallet:</strong> {paymentInfo?.instructions?.provider || "Set by school admin"}</p>
                <p><strong>Account name:</strong> {paymentInfo?.instructions?.accountName || "Ask the administrator"}</p>
                <p><strong>Account number:</strong> {paymentInfo?.instructions?.accountNumber || "Not configured yet"}</p>
              </div>
              {!paymentInfo?.instructions?.accountNumber && <p className="mt-2 text-xs text-blue-800">The administrator has not configured the receiving e-wallet details. Please contact the admin before transferring.</p>}
            </div>
            <label className="block text-sm font-medium text-slate-700">E-wallet provider
              <input required value={paymentForm.walletProvider} onChange={(e) => setPaymentForm((p) => ({ ...p, walletProvider: e.target.value }))} placeholder="GCash, Maya, etc." className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Sender/account name (optional)
              <input value={paymentForm.senderName} onChange={(e) => setPaymentForm((p) => ({ ...p, senderName: e.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Transfer reference number
              <input required value={paymentForm.referenceNumber} onChange={(e) => setPaymentForm((p) => ({ ...p, referenceNumber: e.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Transfer receipt / screenshot (max 5 MB)
              <input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setPaymentForm((p) => ({ ...p, proof: e.target.files?.[0] || null }))} className="mt-1.5 block w-full text-sm" />
            </label>
            {paymentError && <p className="text-sm text-red-600">{paymentError}</p>}
            <p className="text-xs text-slate-500">Your listing stays private while an admin checks the reference number and transfer proof. Never upload your e-wallet password or OTP.</p>
            <button disabled={paymentLoading || !paymentInfo?.instructions?.accountNumber} className="h-11 w-full rounded-xl bg-blue-900 font-semibold text-white disabled:opacity-50">{paymentLoading ? "Submitting..." : "Submit payment proof"}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}