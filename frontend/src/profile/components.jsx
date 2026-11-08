import { useState } from 'react';
import { Pencil, Settings, BadgeCheck, Lock, MoreHorizontal, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
import { NAVY, NAVY_LIGHT } from '../ui.jsx';
import { Modal } from '../market/Details.jsx';
import { CatIcon } from '../market/components.jsx';
import { CATEGORIES, CONDITIONS, peso } from '../market/data.js';
import { Card, primary, outline, field } from '../transaction/components.jsx';
import { maskId, roleLabel } from './data.js';

const soft = { color: NAVY_LIGHT, background: '#2b47a30f' };
const ring = 'focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2b47a3]/20';
export const shortDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
export const longDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const TRANSACTION_STATUS = {
  placed: ['Order Placed', '#0ea5e9'],
  pending: ['Pending', '#f59e0b'],
  confirmed: ['Confirmed', NAVY_LIGHT],
  ready: ['Ready for Meetup', '#8b5cf6'],
  completed: ['Completed', '#10b981'],
  cancelled: ['Cancelled', '#ef4444'],
};
const Dot = ({ status }) => {
  const [label, color] = TRANSACTION_STATUS[status] || [String(status || 'Unknown').replace(/_/g, ' '), '#64748b'];
  return <span className="inline-flex items-center gap-1.5 text-sm capitalize text-slate-700"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>;
};

export function Photo({ p, size }) {
  const initial = (p?.first || p?.fullName || 'A').trim()[0]?.toUpperCase() || 'A';
  return (
    <span className="flex items-center justify-center overflow-hidden rounded-full font-semibold" style={{ width: size, height: size, color: NAVY_LIGHT, background: '#2b47a314', fontSize: size * 0.38 }}>
      {initial}
    </span>
  );
}

export function VerifiedBadge({ className = '', isVerified = false }) {
  if (!isVerified) {
    return <span className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ${className}`}><AlertCircle size={14} /> Verification pending</span>;
  }
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${className}`} style={soft}><BadgeCheck size={14} /> Verified AdNU Account</span>;
}

export function ProfileHeader({ p, onEdit, onSettings }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-5 sm:flex-nowrap">
        <div className="shrink-0"><Photo p={p} size={96} /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{p.fullName || 'AdNU Account'}</h1>
          <p className="text-sm text-slate-500">{roleLabel(p.role)}</p>
          <p className="mt-0.5 break-all text-sm text-slate-500">{p.email || 'No email on record'}</p>
          <p className="text-sm text-slate-500">Ateneo de Naga University</p>
          <VerifiedBadge isVerified={p.isVerified} className="mt-2.5" />
        </div>
        <div className="flex w-full gap-2.5 sm:w-auto">
          <button onClick={onEdit} style={{ background: NAVY_LIGHT }} className={`${primary} sm:!w-auto`}><Pencil size={16} /> Edit Profile</button>
          <button onClick={onSettings} aria-label="Settings" className={`${outline} !w-11 shrink-0 !px-0`}><Settings size={18} /></button>
        </div>
      </div>
    </Card>
  );
}

export function StatCards({ stats, onGo }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map(({ label, value, tab }) => (
        <button key={label} onClick={() => onGo(tab)} className={`rounded-2xl border border-slate-200/80 bg-white p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_rgba(22,41,107,0.25)] ${ring}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-3xl font-semibold" style={{ color: NAVY }}>{value}</p>
        </button>
      ))}
    </div>
  );
}

export function StudentInformation({ p }) {
  const items = [
    ['Full Name', p.fullName || 'Not available'],
    ['University ID', maskId(p.studentId)],
    ['AdNU Email', p.email || 'Not available'],
    ['Account Type', roleLabel(p.role)],
    ['Member Since', p.createdAt ? longDate(p.createdAt) : 'Not available'],
  ];
  return (
    <Card title="Account Information">
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {items.map(([label, value]) => <div key={label}><dt className="text-xs text-slate-400">{label}</dt><dd className="break-words text-sm font-medium text-slate-800">{value}</dd></div>)}
      </dl>
    </Card>
  );
}

export const TABS = [['overview', 'Overview'], ['listings', 'My Listings'], ['purchases', 'Purchases'], ['sales', 'Sales'], ['saved', 'Saved Items'], ['settings', 'Settings']];
export function ProfileTabs({ tab, setTab }) {
  return (
    <nav className="flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-2" role="tablist" aria-label="Profile sections">
      {TABS.map(([id, label]) => {
        const on = tab === id;
        return <button key={id} role="tab" aria-selected={on} onClick={() => setTab(id)} style={on ? { background: NAVY_LIGHT } : undefined} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition duration-200 ${ring} ${on ? 'text-white shadow-md shadow-[#2b47a3]/25' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>;
      })}
    </nav>
  );
}

/* ---------- Live listings ---------- */
const LISTING_STATUS = {
  pending_review: ['Pending Review', 'bg-amber-50 text-amber-700'],
  fee_proposed: ['Fee Proposed', 'bg-orange-50 text-orange-700'],
  negotiating: ['Negotiating', 'bg-violet-50 text-violet-700'],
  awaiting_payment: ['Awaiting Payment', 'bg-sky-50 text-sky-700'],
  payment_submitted: ['Payment Verification', 'bg-blue-50 text-blue-700'],
  approved: ['Active', 'bg-emerald-50 text-emerald-700'],
  paused: ['Paused', 'bg-slate-100 text-slate-600'],
  reserved: ['Reserved', 'bg-amber-50 text-amber-700'],
  sold: ['Sold', 'bg-slate-100 text-slate-600'],
  rejected: ['Rejected', 'bg-rose-50 text-rose-700'],
};

export function ListingCard({ l, actions }) {
  const [open, setOpen] = useState(false);
  const itemStatus = LISTING_STATUS[l.status] || [String(l.status || 'Unknown').replace(/_/g, ' '), 'bg-slate-100 text-slate-600'];
  const canMarkSold = ['approved', 'paused'].includes(l.status);
  const canPause = ['approved', 'paused'].includes(l.status);
  const canDelete = !['payment_submitted', 'reserved'].includes(l.status) && (l.transactionCount || 0) === 0;
  const images = Array.isArray(l.images) ? l.images : [];
  const menuItem = 'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';
  const run = (fn) => () => { setOpen(false); fn(); };
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white transition hover:shadow-[0_12px_30px_-12px_rgba(22,41,107,0.2)]">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-t-2xl bg-[#eef1fa]">
        {images[0] ? <img src={images[0]} alt={l.name} className="h-full w-full object-cover" /> : <CatIcon category={l.category} />}
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium ${itemStatus[1]}`}>{itemStatus[0]}</span>
        <div className="absolute right-3 top-3">
          <button onClick={() => setOpen((value) => !value)} aria-label={`Options for ${l.name}`} aria-expanded={open} className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-500 shadow-sm hover:text-slate-800 ${ring}`}><MoreHorizontal size={18} /></button>
          {open && <>
            <button className="fixed inset-0 z-10 cursor-default" aria-label="Close menu" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_10px_40px_-12px_rgba(22,41,107,0.25)]">
              <button className={menuItem} onClick={run(actions.edit)}>Edit Listing</button>
              <button className={menuItem} disabled={!canMarkSold} onClick={run(actions.sold)}>Mark as Sold</button>
              <button className={menuItem} disabled={!canPause} onClick={run(actions.pause)}>{l.status === 'paused' ? 'Resume Listing' : 'Pause Listing'}</button>
              <div className="my-1 h-px bg-slate-100" />
              <button className={`${menuItem} !text-red-600`} disabled={!canDelete} onClick={run(actions.del)}>Delete Listing</button>
            </div>
          </>}
        </div>
      </div>
      <div className="space-y-1.5 p-4">
        <h3 className="truncate font-medium text-slate-900">{l.name}</h3>
        <p className="text-xl font-bold" style={{ color: NAVY }}>{peso(l.price)}</p>
        <p className="text-sm text-slate-500">{l.category} · {l.condition}</p>
        <p className="pt-1 text-xs text-slate-400">Listed {l.createdAt ? shortDate(l.createdAt) : 'date unavailable'}</p>
      </div>
    </article>
  );
}
export const listingGrid = 'grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 sm:gap-5';

/* ---------- Live transactions ---------- */
export function TransactionsTable({ txs, onOpen }) {
  return (
    <Card className="!p-2 sm:!p-3">
      {txs.length ? <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead><tr className="text-xs text-slate-400">{['Item', 'Type', 'Price', 'Status', 'Date'].map((heading, index) => <th key={heading} className={`px-3 py-2 font-medium ${index === 2 ? 'text-right' : ''}`}>{heading}</th>)}</tr></thead>
          <tbody>{txs.map((tx) => <tr key={tx.id} tabIndex={0} role="link" onClick={() => onOpen(tx)} onKeyDown={(event) => event.key === 'Enter' && onOpen(tx)} className={`cursor-pointer border-t border-slate-100 transition hover:bg-slate-50 ${ring}`}>
            <td className="px-3 py-3 font-medium text-slate-900">{tx.name}</td>
            <td className="px-3 py-3 text-slate-600">{tx.type}</td>
            <td className="px-3 py-3 text-right font-semibold" style={{ color: NAVY }}>{peso(tx.price)}</td>
            <td className="px-3 py-3"><Dot status={tx.status} /></td>
            <td className="px-3 py-3 text-slate-500">{shortDate(tx.date)}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="px-4 py-8 text-center text-sm text-slate-400">No transactions yet.</p>}
    </Card>
  );
}

export function TxCard({ tx, onOpen }) {
  const sale = tx.type === 'Sale';
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:shadow-[0_12px_30px_-12px_rgba(22,41,107,0.2)] sm:flex-nowrap">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#eef1fa]"><CatIcon category={tx.category} size={28} /></span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-medium text-slate-900">{tx.name}</h3>
        <p className="text-sm text-slate-500">{sale ? 'Buyer' : 'Seller'}: {tx.who}</p>
        <p className="mt-0.5 text-xs text-slate-400">{sale ? 'Date sold' : 'Purchased'} {longDate(tx.date)}</p>
      </div>
      <div className="flex flex-col items-start gap-1 sm:items-end"><p className="text-lg font-bold" style={{ color: NAVY }}>{peso(tx.price)}</p><Dot status={tx.status} /></div>
      <button onClick={() => onOpen(tx)} className={`${outline} !w-full sm:!w-auto`}>View Transaction</button>
    </div>
  );
}

/* ---------- Settings backed by persisted account data ---------- */
const SRow = ({ title, desc, children }) => (
  <div className="flex items-center justify-between gap-4 border-t border-slate-100 py-3.5 first:border-t-0 first:pt-0 last:pb-0">
    <div className="min-w-0"><p className="text-sm font-medium text-slate-800">{title}</p>{desc && <p className="text-xs text-slate-400">{desc}</p>}</div>
    {children}
  </div>
);
const smallBtn = `${outline} !h-9 !w-auto shrink-0 !px-4`;

export function SettingsPanel({ p, onEditInfo, onChangePw, onLogout }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Account">
        <SRow title="Personal Information" desc="Update the name displayed across AdNU Trade"><button onClick={onEditInfo} className={smallBtn}>Edit</button></SRow>
        <SRow title="Password" desc="Change your account password"><button onClick={onChangePw} className={smallBtn}>Change</button></SRow>
        <SRow title="AdNU Email" desc={p.email || 'No email on record'}>
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${p.isVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {p.isVerified ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}{p.isVerified ? 'Verified' : 'Pending'}
          </span>
        </SRow>
      </Card>
      <Card title="Account Details">
        <SRow title="Account Type" desc="Your registered AdNU account category"><span className="text-sm font-semibold text-slate-700">{roleLabel(p.role)}</span></SRow>
        <SRow title="University ID" desc="This verified identifier cannot be changed here"><span className="text-sm font-semibold text-slate-700">{maskId(p.studentId)}</span></SRow>
        <SRow title="Member Since" desc="Account creation date"><span className="text-sm font-semibold text-slate-700">{p.createdAt ? longDate(p.createdAt) : '—'}</span></SRow>
      </Card>
      <div className="lg:col-span-2"><button onClick={onLogout} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 hover:shadow-sm"><LogOut size={17} /> Log Out</button></div>
    </div>
  );
}

/* ---------- Modals ---------- */
export function ConfirmModal({ title, text, confirmLabel, danger, onConfirm, onClose }) {
  return <Modal onClose={onClose}><div className="p-6 sm:p-7">
    <h2 className="pr-8 text-xl font-semibold text-slate-900">{title}</h2><p className="mt-2 text-sm text-slate-600">{text}</p>
    <div className="mt-6 grid grid-cols-2 gap-2.5"><button onClick={onClose} className={outline}>Cancel</button>
      {danger ? <button onClick={onConfirm} className="flex h-11 w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700 transition hover:bg-red-100">{confirmLabel}</button> : <button onClick={onConfirm} style={{ background: NAVY_LIGHT }} className={primary}>{confirmLabel}</button>}
    </div>
  </div></Modal>;
}

const Label = ({ t, children }) => <label className="block text-sm font-medium text-slate-700">{t}<div className="mt-1.5 font-normal">{children}</div></label>;

export function EditProfileModal({ p, onSave, onClose }) {
  const [d, setD] = useState({ first: p.first || '', last: p.last || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (event) => setD((old) => ({ ...old, [key]: event.target.value }));
  const ok = d.first.trim().length > 0 && d.last.trim().length > 0;
  const locked = (value) => <div className="relative"><input disabled value={value} className={`${field} cursor-not-allowed bg-slate-50 pr-10 text-slate-500`} /><Lock size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" /></div>;
  const submit = async (event) => {
    event.preventDefault();
    if (!ok || saving) return;
    setSaving(true); setError('');
    try { await onSave({ fullName: `${d.first.trim()} ${d.last.trim()}`.replace(/\s+/g, ' ') }); }
    catch (err) { setError(err.message || 'Could not save your profile.'); }
    finally { setSaving(false); }
  };
  return <Modal onClose={onClose}><form onSubmit={submit} className="space-y-4 p-6 sm:p-7">
    <h2 className="text-xl font-semibold text-slate-900">Edit Profile</h2>
    <div className="grid grid-cols-2 gap-3"><Label t="First Name"><input required maxLength={60} value={d.first} onChange={set('first')} className={field} /></Label><Label t="Last Name"><input required maxLength={60} value={d.last} onChange={set('last')} className={field} /></Label></div>
    <div className="space-y-3 rounded-2xl bg-slate-50 p-4"><p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: NAVY_LIGHT }}><BadgeCheck size={14} /> Verified account information</p><Label t="University ID">{locked(maskId(p.studentId))}</Label><Label t="AdNU Email">{locked(p.email || 'Not available')}</Label></div>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    <div className="grid grid-cols-2 gap-2.5 pt-1"><button type="button" onClick={onClose} className={outline}>Cancel</button><button type="submit" disabled={!ok || saving} style={{ background: NAVY_LIGHT }} className={`${primary} disabled:opacity-50`}>{saving ? 'Saving…' : 'Save Changes'}</button></div>
  </form></Modal>;
}

export function ListingModal({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: '', price: '', category: CATEGORIES[0], condition: 'Good', desc: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (event) => setF((old) => ({ ...old, [key]: event.target.value }));
  const numericPrice = Number(f.price);
  const validWholePrice = Number.isSafeInteger(numericPrice) && numericPrice >= 1 && numericPrice <= 99999999;
  const ok = f.name.trim() && validWholePrice;
  const submit = async (event) => {
    event.preventDefault();
    if (!ok || saving) return;
    setSaving(true); setError('');
    try { await onSave({ ...f, name: f.name.trim(), price: numericPrice }); }
    catch (err) { setError(err.message || 'Could not save the listing.'); }
    finally { setSaving(false); }
  };
  return <Modal onClose={onClose}><form onSubmit={submit} className="space-y-4 p-6 sm:p-7">
    <h2 className="text-xl font-semibold text-slate-900">{initial ? 'Edit Listing' : 'Create New Listing'}</h2>
    <Label t="Item name"><input value={f.name} onChange={set('name')} placeholder="e.g. Physics textbook" className={field} /></Label>
    <Label t="Price (₱)"><input type="number" min="1" max="99999999" step="1" inputMode="numeric" required value={f.price} onChange={set('price')} className={field} /><span className="mt-1 block text-xs text-slate-500">Whole numbers only (₱1–₱99,999,999).</span></Label>
    <div className="grid grid-cols-2 gap-3"><Label t="Category"><select value={f.category} onChange={set('category')} className={field}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></Label><Label t="Condition"><select value={f.condition} onChange={set('condition')} className={field}>{CONDITIONS.map((condition) => <option key={condition}>{condition}</option>)}</select></Label></div>
    <Label t="Description"><textarea rows={3} value={f.desc} onChange={set('desc')} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-[15px] outline-none transition hover:border-slate-300 focus:border-[#2b47a3] focus:ring-4 focus:ring-[#2b47a3]/15" /></Label>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    <button type="submit" disabled={!ok || saving} style={{ background: NAVY_LIGHT }} className={`${primary} disabled:opacity-50`}>{saving ? 'Saving…' : initial ? 'Save Changes' : 'Submit for Review'}</button>
  </form></Modal>;
}

export function ChangePasswordModal({ onClose, onSubmit }) {
  const [f, setF] = useState({ cur: '', nw: '', cf: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const set = (key) => (event) => { setF((old) => ({ ...old, [key]: event.target.value })); setErr(''); };
  const submit = async (event) => {
    event.preventDefault();
    if (!f.cur) return setErr('Enter your current password.');
    if (f.nw.length < 8 || !/[A-Z]/.test(f.nw) || !/\d/.test(f.nw) || !/[^A-Za-z0-9]/.test(f.nw)) return setErr('New password needs 8+ characters, an uppercase letter, a number and a special character.');
    if (f.nw !== f.cf) return setErr("New passwords don't match.");
    setLoading(true); setErr('');
    try { await onSubmit({ currentPassword: f.cur, newPassword: f.nw }); setDone(true); }
    catch (error) { setErr(error.message || 'Could not change your password.'); }
    finally { setLoading(false); }
  };
  return <Modal onClose={onClose}>{done ? <div className="p-8 text-center"><CheckCircle2 size={44} className="mx-auto text-emerald-500" /><h2 className="mt-3 text-lg font-semibold text-slate-900">Password updated</h2><button onClick={onClose} style={{ background: NAVY_LIGHT }} className={`${primary} mt-6`}>Done</button></div> : <form onSubmit={submit} className="space-y-4 p-6 sm:p-7">
    <h2 className="text-xl font-semibold text-slate-900">Change Password</h2>
    <Label t="Current Password"><input type="password" autoComplete="current-password" value={f.cur} onChange={set('cur')} className={field} /></Label>
    <Label t="New Password"><input type="password" autoComplete="new-password" value={f.nw} onChange={set('nw')} className={field} /></Label>
    <Label t="Confirm New Password"><input type="password" autoComplete="new-password" value={f.cf} onChange={set('cf')} className={field} /></Label>
    {err && <p role="alert" className="text-sm text-rose-600">{err}</p>}
    <div className="grid grid-cols-2 gap-2.5"><button type="button" onClick={onClose} className={outline}>Cancel</button><button disabled={loading} type="submit" style={{ background: NAVY_LIGHT }} className={`${primary} disabled:opacity-50`}>{loading ? 'Updating…' : 'Update Password'}</button></div>
  </form>}</Modal>;
}
