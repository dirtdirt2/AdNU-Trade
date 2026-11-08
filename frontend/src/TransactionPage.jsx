import { useMemo, useState, useEffect, useCallback } from "react";
import { Navbar, BottomNav } from "./market/components.jsx";
import { MessageSeller } from "./market/Details.jsx";
import { store } from "./market/store.js";
import {
  TransactionHeader, TransactionStatus, ProductSummary, PaymentSummary, TransactionActions,
  BuyerInfo, SellerInfo, MeetupDetails, PaymentMethod, TransactionTimeline, SafetyNotice, RatingForm,
} from "./transaction/components.jsx";
import { ConfirmationModal, CancellationModal } from "./transaction/Modals.jsx";
import { Maximize2, X, User } from "lucide-react";

function ActionConfirmationModal({ title, message, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-600">{message}</p>
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-xl shadow-sm"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TransactionPage() {
  const savedTxId = localStorage.getItem('adnu_active_txId') || store.txId;

  const [item, setItem] = useState(() => {
    if (store.tx) return store.tx;
    const saved = localStorage.getItem('adnu_active_item');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [txRecord, setTxRecord] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [txId, setTxId] = useState(savedTxId || `#ADT-${new Date().getFullYear()}-PENDING`);
  const [displayCode, setDisplayCode] = useState(savedTxId || store.txId || "");
  const [status, setStatus] = useState(store.txStatus || "placed");
  const [events, setEvents] = useState([]);

  // Image gallery and lightbox state for all attached images
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxImage, setLightboxImage] = useState(null);

  const [m, setM] = useState({
    meetupLoc: "",
    date: "",
    time: "",
    meetupStatus: "pending_agreement"
  });

  const [pay, setPay] = useState("cash");
  const [modal, setModal] = useState(null);
  const [chat, setChat] = useState(false);
  const [query, setQuery] = useState("");

  const apiBaseUrl = 'http://localhost:5000';

  const parseJwt = (token) => {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
      return null;
    }
  };

  const fetchTransactionDetails = useCallback(async () => {
    const activeTxId = localStorage.getItem('adnu_active_txId') || store.txId || txId;
    if (!activeTxId || activeTxId.includes('PENDING')) return;

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`${apiBaseUrl}/api/transactions/${activeTxId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setTxRecord(data);
        if (data.product) {
          setItem(data.product);
        }

        if (data.id) {
          setTxId(data.id);
          store.txId = data.id;
          localStorage.setItem('adnu_active_txId', data.id);
        }
        if (data.trackingCode) {
          setDisplayCode(data.trackingCode);
        }
        if (data.status) {
          setStatus(data.status);
        }

        setM({
          meetupLoc: data.location || data.meetupLoc || "",
          date: data.meetupDate || data.date || "",
          time: data.meetupTime || data.time || "",
          meetupStatus: data.meetupStatus === 'agreed' || ['confirmed', 'ready', 'completed'].includes(data.status)
            ? 'agreed'
            : (data.meetupStatus || 'pending_agreement')
        });
      }
    } catch (err) {
      console.error("Failed to fetch transaction details:", err);
    }
  }, [txId]);

  useEffect(() => {
    const initializeUserAndTransaction = async () => {
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        let userIdFromToken = null;
        let decodedToken = null;
        if (token) {
          decodedToken = parseJwt(token);
          userIdFromToken = decodedToken?.userId || decodedToken?.id || decodedToken?.sub;
        }

        const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
        let parsedUser = savedUser ? JSON.parse(savedUser) : null;

        const resolvedFullName =
          parsedUser?.fullName ||
          parsedUser?.name ||
          parsedUser?.full_name ||
          parsedUser?.fullname ||
          parsedUser?.user?.fullName ||
          parsedUser?.user?.name ||
          decodedToken?.fullName ||
          decodedToken?.name ||
          decodedToken?.full_name ||
          decodedToken?.fullname;

        let initialUser = {
          id: userIdFromToken || parsedUser?.id || parsedUser?.userId || parsedUser?.user?.id,
          fullName: resolvedFullName,
          ...parsedUser
        };

        setCurrentUser(initialUser);

        const activeTxId = localStorage.getItem('adnu_active_txId') || store.txId || txId;
        if (activeTxId && !activeTxId.includes('PENDING')) {
          await fetchTransactionDetails();
        } else if (store.tx) {
          setItem(store.tx);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeUserAndTransaction();

    return () => {
      store.tx = null;
      store.txStatus = null;
    };
  }, [fetchTransactionDetails]);

  useEffect(() => {
    const activeTxId = localStorage.getItem('adnu_active_txId') || store.txId || txId;
    if (!activeTxId || activeTxId.includes('PENDING')) return;

    const interval = setInterval(fetchTransactionDetails, 4000);

    const handleFocus = () => fetchTransactionDetails();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchTransactionDetails();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [txId, fetchTransactionDetails]);

  const [initializedEvents, setInitializedEvents] = useState(false);

  useEffect(() => {
    if (txRecord && !initializedEvents) {
      const history = [{ at: new Date(txRecord.createdAt), text: "Order placed" }];

      if (txRecord.agreedAt) {
        history.push({ at: new Date(txRecord.agreedAt), text: "Meetup agreed" });
      }
      if (txRecord.readyAt) {
        history.push({ at: new Date(txRecord.readyAt), text: "Item marked ready for meetup" });
      }
      if (txRecord.completedAt) {
        history.push({ at: new Date(txRecord.completedAt), text: "Item received and cash paid, transaction completed" });
      }
      if (txRecord.cancelledAt) {
        history.push({ at: new Date(txRecord.cancelledAt), text: "Transaction cancelled" });
      }

      setEvents(history);
      setInitializedEvents(true);
    }
  }, [txRecord, initializedEvents]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-600">
        <p className="text-sm font-semibold animate-pulse">Loading transaction details...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-slate-800">
        <h2 className="text-lg font-bold mb-2">No active transaction found</h2>
        <p className="text-xs text-slate-500 mb-4">Please select a product from the marketplace to start a transaction.</p>
        <button
          onClick={() => { window.location.hash = "#/home"; }}
          className="bg-blue-900 text-white text-xs px-4 py-2 rounded-xl font-bold"
        >
          Return to Marketplace
        </button>
      </div>
    );
  }

  // Safely resolve local storage user profile data
  const localSavedUser = (() => {
    try {
      const saved = localStorage.getItem('user') || sessionStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  })();

  // Robust seller name resolution (strictly isolated from buyer)
  const sellerName =
    txRecord?.seller?.fullName ||
    txRecord?.seller?.name ||
    txRecord?.seller?.user?.fullName ||
    item?.user?.fullName ||
    item?.user?.name ||
    item?.seller?.fullName ||
    item?.seller?.name ||
    item?.sellerFullName ||
    "AdNU Student";

  // Comprehensive buyer name resolution checking both transaction buyer and local user objects
  const buyerName =
    txRecord?.buyer?.fullName ||
    txRecord?.buyer?.name ||
    txRecord?.buyer?.user?.fullName ||
    currentUser?.fullName ||
    currentUser?.name ||
    currentUser?.full_name ||
    currentUser?.fullname ||
    currentUser?.user?.fullName ||
    currentUser?.user?.name ||
    localSavedUser?.fullName ||
    localSavedUser?.name ||
    localSavedUser?.full_name ||
    localSavedUser?.fullname ||
    localSavedUser?.user?.fullName ||
    localSavedUser?.user?.name ||
    "AdNU Student";

  const currentUserId = String(currentUser?.id || currentUser?.userId || currentUser?.user?.id || "");
  const sellerId = String(txRecord?.sellerId || txRecord?.product?.sellerId || item?.sellerId || item?.seller?.id || item?.userId || "");
  const isSeller = Boolean(currentUserId && sellerId && currentUserId === sellerId);

  const qty = 1;
  const total = Number(item.price) * qty;
  const locked = ["confirmed", "ready", "completed", "cancelled"].includes(status);
  const log = (text) => setEvents((e) => [...e, { at: new Date(), text }]);

  const syncStatusToBackend = async (newStatus, logText, extraPayload = {}) => {
    const activeTxId = localStorage.getItem('adnu_active_txId') || txId;

    // Preserve the local preview-only behavior for an order that has not yet
    // received a persisted transaction ID. Real transactions always sync first.
    if (!activeTxId || activeTxId.includes('PENDING')) {
      setStatus(newStatus);
      log(logText);
      return true;
    }

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(`${apiBaseUrl}/api/transactions/${activeTxId}/status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newStatus, ...extraPayload })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'The transaction could not be updated.');
      }

      if (data.transaction) {
        setTxRecord(data.transaction);
        setStatus(data.transaction.status);
      } else {
        setStatus(newStatus);
      }
      log(logText);
      return true;
    } catch (err) {
      console.error("Failed to sync transaction status to backend:", err);
      alert(err.message || 'The transaction could not be updated. Please refresh and try again.');
      await fetchTransactionDetails();
      return false;
    }
  };

  const go = (s, text, extraPayload) => syncStatusToBackend(s, text, extraPayload);
  const home = (v) => { window.location.hash = `#/${v}`; };

  const isFormComplete = Boolean(
    m.meetupLoc && m.meetupLoc.trim() !== "" &&
    m.date && m.date.trim() !== "" &&
    m.time && m.time.trim() !== ""
  );

  const on = {
    buy: () => {
      if (!isFormComplete) {
        alert("Please complete all required campus meetup details before proceeding.");
        return;
      }
      setModal("buy");
    },
    meet: () => setModal("meet"),
    complete: () => setModal("complete"),
    message: () => setChat(true),
    cancel: () => setModal("cancel"),
    rate: () => document.getElementById("rating")?.scrollIntoView({ behavior: "smooth", block: "center" }),
  };

  // Resolve all attached images for the item (handles arrays, single strings, or fallbacks)
  const productImages = Array.isArray(item.images) && item.images.length > 0
    ? item.images
    : (item.image ? [item.image] : []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar query={query} setQuery={setQuery} onNav={home} />
      <main className="mx-auto max-w-[1250px] space-y-5 px-4 pb-28 pt-8 sm:px-8 lg:pb-12">
        {/* Temporary Debug Box */}
        <div className="bg-slate-900 text-emerald-400 p-3 rounded-xl text-xs font-mono space-y-1 shadow-md">
          <p>Logged-in User ID: {currentUserId || "None"}</p>
          <p>Resolved Buyer Name: <span className="text-white font-bold">{buyerName}</span></p>
          <p>Transaction Seller ID: {sellerId || "None"}</p>
          <p>Is Seller? <span className={isSeller ? "text-emerald-300 font-bold" : "text-red-400 font-bold"}>{String(isSeller)}</span></p>
          <p>Meetup Status: {m.meetupStatus}</p>
        </div>

        <TransactionHeader id={displayCode || txId} onRefresh={fetchTransactionDetails} />
        <TransactionStatus status={status} />

        {errorMsg && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 text-xs text-red-700 rounded-r-lg">
            {errorMsg}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          <MeetupDetails
            m={m}
            locked={locked}
            txId={txRecord?.id || store.txId || txId}
            isSeller={isSeller}
            status={status}
            onChange={(next, note) => { setM(next); log(note); }}
          />
          <PaymentMethod pay={pay} setPay={setPay} locked={locked} status={status} total={total} />
        </div>

        {/* Custom Product Summary Card with Multi-Image Viewer & Lightbox */}
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 lg:col-span-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Product Details</h3>

            {/* Active Image Preview with Lightbox Trigger */}
            <div className="relative aspect-square rounded-2xl bg-slate-900 overflow-hidden border border-slate-200 group flex items-center justify-center">
              {productImages.length > 0 ? (
                <>
                  <img
                    src={productImages[activeImageIndex] || productImages[0]}
                    alt={item.title || item.name}
                    className="w-full h-full object-cover cursor-pointer transition group-hover:scale-105"
                    onClick={() => setLightboxImage(productImages[activeImageIndex] || productImages[0])}
                  />
                  <button
                    type="button"
                    onClick={() => setLightboxImage(productImages[activeImageIndex] || productImages[0])}
                    className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-medium gap-1.5"
                  >
                    <Maximize2 className="w-4 h-4" /> Click to view full scale
                  </button>
                </>
              ) : (
                <div className="text-slate-400 text-xs">No image provided</div>
              )}
            </div>

            {/* Thumbnails for all attached images (up to 3) */}
            {productImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {productImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`h-16 w-16 rounded-xl overflow-hidden border-2 shrink-0 bg-slate-100 transition ${
                      activeImageIndex === idx ? 'border-blue-900 ring-2 ring-blue-900/20' : 'border-slate-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div>
              <h4 className="font-bold text-slate-900 text-base">{item.title || item.name}</h4>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description || item.desc}</p>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400">Price:</span>
                <span className="font-bold text-slate-800">₱{item.price}</span>
              </div>
            </div>
          </div>

          <PaymentSummary price={Number(item.price)} qty={qty} fee={0}>
            <TransactionActions status={status} on={on} isSeller={isSeller} meetupStatus={m.meetupStatus} />
          </PaymentSummary>
        </div>

        {/* Buyer & Seller Information Cards using BuyerInfo and SellerInfo */}
        <div className="grid gap-5 md:grid-cols-2">
          {/* Buyer Card */}
          <BuyerInfo p={{ name: buyerName }} />

          {/* Seller Card */}
          {!isSeller && (
            <SellerInfo p={{ name: sellerName }} onMessage={on.message} isSeller={isSeller} />
          )}
        </div>

        {status === "completed" && !isSeller && (
          <div id="rating">
            <RatingForm seller={sellerName} />
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          <TransactionTimeline events={events} />
          <SafetyNotice />
        </div>
      </main>
      <BottomNav view="none" onNav={home} />

      {/* Full-Scale Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            aria-label="Close Lightbox"
            className="absolute top-6 right-6 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <X size={24} />
          </button>
          <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center p-2" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxImage}
              alt="Fullscreen Product Preview"
              className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}

      {modal === "buy" && (
        <ConfirmationModal item={item} total={total} onClose={() => setModal(null)}
          onConfirm={async () => {
            try {
              const token = localStorage.getItem('token') || sessionStorage.getItem('token');

              const res = await fetch(`${apiBaseUrl}/api/products/${item.id}/buy`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  fulfillmentMethod: 'meetup',
                  location: m.meetupLoc,
                  meetupDate: m.date,
                  meetupTime: m.time
                })
              });

              const data = await res.json();
              if (!res.ok) {
                alert(data.error || "Failed to process purchase.");
                setModal(null);
                return;
              }

              if (data.transaction) {
                setTxRecord(data.transaction);
              }

              const newTxId = data.transaction?.id || data.transactionId;
              const newTrackingCode = data.transaction?.trackingCode;
              if (newTxId) {
                setTxId(newTxId);
                store.txId = newTxId;
                localStorage.setItem('adnu_active_txId', newTxId);
              }
              if (newTrackingCode) {
                setDisplayCode(newTrackingCode);
              }

              setModal(null);
              // The checkout endpoint already created the transaction as pending
              // and reserved the product atomically. Do not send a second status
              // request for the same pending state.
              setStatus("pending");
              log("Purchase confirmed, awaiting seller agreement on campus meetup terms");
            } catch (err) {
              console.error(err);
              alert("An error occurred during checkout.");
              setModal(null);
            }
          }} />
      )}
      {modal === "cancel" && (
        <CancellationModal onKeep={() => setModal(null)}
          onConfirm={(r) => { setModal(null); go("cancelled", `Transaction cancelled${r ? ` (${r})` : ""}`, { cancelReason: r || '' }); }} />
      )}

      {modal === "meet" && (
        <ActionConfirmationModal
          title="Confirm Item Ready"
          message="Are you ready to mark this item ready for pickup at the agreed campus meetup?"
          onConfirm={() => { setModal(null); go("ready", "Item marked ready for meetup"); }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "complete" && (
        <ActionConfirmationModal
          title="Confirm Item Receipt & Cash Paid"
          message="Are you sure you have received the item and handed over the cash payment? This will complete the transaction."
          onConfirm={() => { setModal(null); go("completed", "Item received and cash paid, transaction completed"); }}
          onClose={() => setModal(null)}
        />
      )}

      {chat && (
        <MessageSeller
          item={item}
          mode="msg"
          onBack={() => setChat(false)}
          onClose={() => setChat(false)}
        />
      )}
    </div>
  );
}