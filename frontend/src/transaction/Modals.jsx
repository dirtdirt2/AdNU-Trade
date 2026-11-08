import { useState } from "react";
import { Modal } from "../market/Details.jsx";
import { NAVY_LIGHT } from "../ui.jsx";
import { Row, primary, outline, field } from "./components.jsx";
import { peso } from "../market/data.js";

const REASONS = ["Changed my mind", "Seller is unavailable", "Found another item", "Incorrect listing", "Other"];

export function ConfirmationModal({ item, total, onClose, onConfirm }) {
  // Product records may expose the listing name as either `name` or `title`.
  const itemName = item?.name || item?.title || item?.productName || "Untitled item";

  // Extract seller name safely whether item.seller is a string, object, or missing
  const sellerName = typeof item?.seller === 'object' && item.seller !== null
    ? (item.seller.fullName || item.seller.name || "AdNU Student")
    : (item?.seller || "AdNU Student");

  return (
    <Modal onClose={onClose}>
      <div className="p-6 sm:p-7">
        <h2 className="pr-8 text-xl font-semibold text-slate-900">Confirm Your Purchase?</h2>
        <p className="mt-2 text-sm text-slate-600">You are about to purchase <b className="font-semibold text-slate-900">{itemName}</b> for <b className="font-semibold text-slate-900">{peso(total)}</b>.</p>
        <div className="mt-4 divide-y divide-slate-100 rounded-xl bg-slate-50 px-4 py-2">
          <Row k="Item" v={itemName} />
          <Row k="Seller" v={sellerName} /> {/* 👈 Use sellerName string here */}
          <Row k="Total price" v={peso(total)} bold />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <button onClick={onClose} className={outline}>Cancel</button>
          <button onClick={onConfirm} style={{ background: NAVY_LIGHT }} className={primary}>Confirm Purchase</button>
        </div>
      </div>
    </Modal>
  );
}

export function CancellationModal({ onKeep, onConfirm }) {
  const [reason, setReason] = useState("");
  return (
    <Modal onClose={onKeep}>
      <div className="p-6 sm:p-7">
        <h2 className="pr-8 text-xl font-semibold text-slate-900">Cancel Transaction?</h2>
        <p className="mt-2 text-sm text-slate-600">Are you sure you want to cancel this transaction?</p>
        <label className="mt-4 block text-sm font-medium text-slate-700">Reason for cancellation (optional)
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} mt-1.5 font-normal`}>
            <option value="">Select a reason</option>
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <button onClick={onKeep} style={{ background: NAVY_LIGHT }} className={primary}>Keep Transaction</button>
          <button onClick={() => onConfirm(reason)} className="flex h-11 w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-100">Cancel Transaction</button>
        </div>
      </div>
    </Modal>
  );
}
