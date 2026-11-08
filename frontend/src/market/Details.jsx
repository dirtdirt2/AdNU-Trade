import { useEffect, useRef, useState, useCallback } from "react";
import { X, Star, MessageCircle, HandCoins, ArrowLeft, Send, GraduationCap, ShoppingBag } from "lucide-react";
import { NAVY, NAVY_LIGHT } from "../ui.jsx";
import { CatIcon } from "./components.jsx";
import { CATEGORIES, CONDITIONS, peso, postedOn } from "./data.js";

const btn = "flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition duration-200 hover:-translate-y-0.5";
const primary = `${btn} text-white shadow-md shadow-[#2b47a3]/25 hover:brightness-110`;
const outline = `${btn} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-sm`;
const input = "w-full rounded-xl border border-slate-300 bg-slate-200 px-4 text-[15px] outline-none transition hover:bg-slate-300/70 focus:bg-white focus:border-[#2b47a3] focus:ring-4 focus:ring-[#2b47a3]/15";

const LabelField = ({ t, children }) => (
  <label className="block text-sm font-medium text-slate-700">
    {t}
    <div className="mt-1.5 font-normal">{children}</div>
  </label>
);

export function Modal({ onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        className={`relative max-h-[92vh] w-full min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${wide ? "max-w-3xl" : "max-w-md"}`}>
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm hover:bg-slate-100"><X size={18} /></button>
        {children}
      </div>
    </div>
  );
}

const Info = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 px-3.5 py-2.5"><p className="text-xs text-slate-400">{label}</p><p className="text-sm font-medium text-slate-800">{value}</p></div>
);

export function ProductDetails({ item: initialItem, onMessage, onBuy, onClose }) {
  const [item, setItem] = useState(initialItem);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const images = Array.isArray(item.images) ? item.images : (item.image ? [item.image] : []);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Fetch fresh product details on mount to guarantee we have createdAt and latest info
  useEffect(() => {
    let isMounted = true;
    async function fetchFreshItemDetails() {
      if (!initialItem?.id) return;
      try {
        setLoadingDetails(true);
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch(`${apiBaseUrl}/api/products/${initialItem.id}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const freshData = await res.json();
          if (isMounted && freshData) {
            setItem(freshData);
          }
        }
      } catch (err) {
        console.error("Failed to fetch fresh product details:", err);
      } finally {
        if (isMounted) setLoadingDetails(false);
      }
    }
    fetchFreshItemDetails();
    return () => { isMounted = false; };
  }, [initialItem?.id]);

  let isMyProduct = false;
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      const base64Payload = token.split('.')[1];
      const payload = JSON.parse(atob(base64Payload));
      const currentUserId = payload.userId || payload.id;
      const currentUserEmail = payload.email;
      const currentUserName = payload.fullName || payload.name;

      const sellerId = item.sellerId || item.userId || item.seller?.id;
      const sellerEmail = item.seller?.email;
      const sellerName = typeof item.seller === 'string' ? item.seller : item.seller?.fullName;

      if (
        (sellerId && currentUserId && String(sellerId) === String(currentUserId)) ||
        (sellerEmail && currentUserEmail && sellerEmail === currentUserEmail) ||
        (sellerName && currentUserName && sellerName.trim().toLowerCase() === currentUserName.trim().toLowerCase())
      ) {
        isMyProduct = true;
      }
    }
  } catch (err) {
    console.error("Error checking self-product ownership:", err);
  }

  const handleBuyClick = () => {
    if (item.status && item.status !== 'approved') {
      alert("This product is pending admin approval and cannot be purchased yet.");
      return;
    }

    if (isMyProduct) {
      alert("You cannot purchase your own product listing.");
      return;
    }

    onBuy(item);
  };

  const formatDatePosted = (dateInput) => {
    if (!dateInput) {
      return item?.days ? postedOn(item.days) : "Recently posted";
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return item?.days ? postedOn(item.days) : "Recently posted";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const sellerDisplayName = typeof item.seller === 'object' ? item.seller?.fullName : item.seller;

  return (
    <Modal onClose={onClose} wide>
      <div className="grid min-w-0 gap-6 p-5 sm:p-7 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex aspect-square items-center justify-center rounded-2xl bg-[#eef1fa] overflow-hidden border border-slate-200">
            {images.length > 0 ? (
              <img
                src={images[activeImageIndex] || images[0]}
                alt={item.name || item.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <CatIcon category={item.category} size={88} />
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`h-16 w-16 rounded-xl overflow-hidden border-2 shrink-0 bg-slate-100 transition ${
                    activeImageIndex === idx ? 'border-[#2b47a3] ring-2 ring-[#2b47a3]/20' : 'border-slate-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col">
          <h2 className="break-words pr-10 text-2xl font-semibold tracking-tight text-slate-900 [overflow-wrap:anywhere]">{item.name || item.title}</h2>
          <p className="mt-1 text-3xl font-bold" style={{ color: NAVY }}>{peso(item.price)}</p>
          <div className="mt-3 min-w-0 max-w-full text-sm leading-relaxed text-slate-600">
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.description ?? item.desc ?? "No description provided."}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Info label="Condition" value={item.condition} />
            <Info label="Category" value={item.category} />
            <Info label="Date posted" value={formatDatePosted(item.createdAt || item.datePosted || item.postedAt)} />
          </div>

          {sellerDisplayName && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 p-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full text-base font-semibold" style={{ color: NAVY_LIGHT, background: "#2b47a314" }}>
                {sellerDisplayName[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{sellerDisplayName}</p>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {isMyProduct ? (
              <div className="sm:col-span-2 rounded-xl bg-slate-100 p-3.5 text-center text-sm font-medium text-slate-600">
                This is your listing. You cannot message or buy your own item.
              </div>
            ) : (
              <>
                <button onClick={handleBuyClick} style={{ background: NAVY_LIGHT }} className={`${primary} sm:col-span-2`}><ShoppingBag size={18} /> Buy Now</button>
                <button onClick={() => onMessage(item, "msg")} className={`${outline} sm:col-span-2`}><MessageCircle size={18} /> Message Seller</button>
                <button onClick={() => onMessage(item, "offer")} className={`${outline} sm:col-span-2`}><HandCoins size={18} /> Make an Offer</button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

const apiBaseUrl = "http://localhost:5000";

const parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

export function MessageSeller({ item, mode, onBack, onClose }) {
  const itemName = item?.name || item?.title || "item";
  const itemPrice = Number(item?.price || 0);

  const [receiverId, setReceiverId] = useState(item?.sellerId || item?.userId || item?.seller?.id);

  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const decoded = token ? parseJwt(token) : null;
  const currentUserId = decoded?.userId || decoded?.id;

  // Keep regular seller messages blank; only prefill a suggested amount for offers.
  const initialDraft = mode === "offer"
    ? `Hi! Would you accept ${peso(Math.round((itemPrice * 0.9) / 10) * 10)} for the ${itemName.toLowerCase()}?`
    : "";

  const [thread, setThread] = useState([]);
  const [draft, setDraft] = useState(initialDraft);
  const [loading, setLoading] = useState(true);
  const end = useRef(null);

  useEffect(() => {
    async function resolveReceiver() {
      if (receiverId) return;
      try {
        const res = await fetch(`${apiBaseUrl}/api/products/${item.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const prodData = await res.json();
          if (prodData.userId || prodData.sellerId) {
            setReceiverId(prodData.userId || prodData.sellerId);
          }
        }
      } catch (err) {
        console.error("Could not resolve receiver ID:", err);
      }
    }
    resolveReceiver();
  }, [item?.id, receiverId, token]);

  const fetchMessages = useCallback(async () => {
    if (!item?.id) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/messages/${item.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setThread(data);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  }, [item?.id, token]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    if (end.current) {
      end.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [thread]);

  const send = async (e) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;

    if (!receiverId) {
      alert("Unable to send message: Seller ID is still loading or missing for this listing.");
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId: item.id,
          receiverId,
          content
        })
      });

      if (res.ok) {
        setDraft("");
        fetchMessages();
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to send message.");
      }
    } catch (err) {
      console.error("Error sending message:", err);
      alert("An error occurred while sending the message.");
    }
  };

  if (!item) return null;

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center gap-3 border-b border-slate-100 p-4 pr-16">
        <button onClick={onBack} aria-label="Back to item" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><ArrowLeft size={18} /></button>
        <div>
          <h2 className="font-semibold text-slate-900">Message {typeof item.seller === 'object' ? item.seller?.fullName : item.seller || "Seller"}</h2>
          <p className="text-xs text-slate-500">{itemName} · {peso(itemPrice)}</p>
        </div>
      </div>
      <div className="flex h-72 flex-col gap-2 overflow-y-auto bg-slate-50 p-4" aria-live="polite">
        {loading && <p className="m-auto text-center text-sm text-slate-400">Loading conversation...</p>}
        {!loading && thread.length === 0 && <p className="m-auto text-center text-sm text-slate-400">No messages yet. Send a message to start chatting!</p>}
        {thread.map((m) => {
          const isMe = m.senderId === currentUserId;
          return (
            <div key={m.id || Math.random()} className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${isMe ? "ml-auto text-white" : "bg-white text-slate-700 shadow-sm"}`} style={isMe ? { background: NAVY_LIGHT } : undefined}>
              {m.content}
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex gap-2 p-4">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Message" className={`${input} h-11`} />
        <button type="submit" disabled={!draft.trim()} style={{ background: NAVY_LIGHT }} className={`${primary} disabled:opacity-50 disabled:hover:translate-y-0`}><Send size={16} /> Send</button>
      </form>
    </Modal>
  );
}

export function SellModal({ onClose, onAdd }) {
  const [f, setF] = useState({ name: "", price: "", category: CATEGORIES[0], condition: "Good", desc: "", imageFiles: [], previews: [] });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const numericPrice = Number(f.price);
  const validWholePrice = Number.isSafeInteger(numericPrice) && numericPrice >= 1 && numericPrice <= 99999999;
  const ok = f.name.trim() && validWholePrice && f.imageFiles.length >= 1 && f.imageFiles.length <= 3;

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const MAX_SIZE_MB = 5;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    const validFiles = [];
    const newPreviews = [];

    for (const file of files) {
      const isImageType = file.type && file.type.startsWith('image/');
      const hasImageExtension = /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(file.name);

      if (!isImageType && !hasImageExtension) {
        alert(`"${file.name}" is not a valid image file. Only image formats (PNG, JPG, JPEG, WEBP, etc.) are allowed.`);
        continue;
      }

      if (file.size > MAX_SIZE_BYTES) {
        alert(`"${file.name}" exceeds the 5 MB size limit and was not added.`);
        continue;
      }
      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    const currentTotal = f.imageFiles.length;
    const availableSlots = 3 - currentTotal;

    if (validFiles.length > availableSlots) {
      alert(`You can upload a maximum of 3 images total. Only the first ${availableSlots} added image(s) were included.`);
    }

    const filesToKeep = validFiles.slice(0, availableSlots);
    const previewsToKeep = newPreviews.slice(0, availableSlots);

    if (filesToKeep.length > 0) {
      setF(prev => ({
        ...prev,
        imageFiles: [...prev.imageFiles, ...filesToKeep],
        previews: [...prev.previews, ...previewsToKeep]
      }));
    }

    e.target.value = "";
  };

  const removeImage = (index) => {
    setF(prev => ({
      ...prev,
      imageFiles: prev.imageFiles.filter((_, i) => i !== index),
      previews: prev.previews.filter((_, i) => i !== index)
    }));
  };

  const submit = (e) => {
    e.preventDefault();
    if (ok) {
      const formData = new FormData();
      formData.append('title', f.name.trim());
      formData.append('price', Number(f.price));
      formData.append('category', f.category);
      formData.append('condition', f.condition);
      formData.append('description', f.desc.trim() || "No description provided.");

      f.imageFiles.forEach(file => {
        formData.append('images', file);
      });

      onAdd(formData);
    }
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-6 sm:p-7">
        <h2 className="text-xl font-semibold text-slate-900">Sell an Item</h2>
        <LabelField t="Item name">
          <input value={f.name} onChange={set("name")} className={`${input} h-11`} />
        </LabelField>

        <LabelField t="Price (₱)">
          <input value={f.price} onChange={set("price")} type="number" min="1" max="99999999" step="1" required inputMode="numeric" className={`${input} h-11`} />
          <p className="mt-1 text-xs text-slate-500">Enter a whole-number price only (₱1–₱99,999,999). Decimals are not allowed.</p>
        </LabelField>
        <p className="rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-3 text-xs leading-relaxed text-blue-900">
          After you submit this listing, an administrator will review it and propose a listing fee. You can accept the fee or negotiate it before making a payment.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <LabelField t="Category">
            <select value={f.category} onChange={set("category")} className={`${input} h-11`}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </LabelField>
          <LabelField t="Condition">
            <select value={f.condition} onChange={set("condition")} className={`${input} h-11`}>
              {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </LabelField>
        </div>

        <LabelField t="Description">
          <textarea value={f.desc} onChange={set("desc")} rows={3} className={`${input} py-3`} />
        </LabelField>

        <LabelField t="Product Images (1 to 3 images, max 5 MB each)">
          <div className="space-y-2">
            {f.imageFiles.length < 3 && (
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-[#2b47a3] hover:file:bg-blue-100 cursor-pointer"
              />
            )}
            {f.previews.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {f.previews.map((imgUrl, index) => (
                  <div key={index} className="relative h-16 w-16 rounded-xl overflow-hidden border border-slate-200">
                    <img src={imgUrl} alt={`Upload preview ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900 text-xs"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400">{f.imageFiles.length}/3 images attached (minimum 1 required)</p>
          </div>
        </LabelField>

        <button type="submit" disabled={!ok} style={{ background: NAVY_LIGHT }} className={`${primary} w-full disabled:opacity-50 disabled:hover:translate-y-0`}>
          Post Listing
        </button>
      </form>
    </Modal>
  );
}