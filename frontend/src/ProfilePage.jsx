import { useEffect, useState } from 'react';
import { Plus, Bookmark } from 'lucide-react';
import { Navbar, BottomNav, ProductGrid, EmptyState } from './market/components.jsx';
import { store } from './market/store.js';
import {
  ProfileHeader, StatCards, StudentInformation, ProfileTabs, ListingCard, listingGrid,
  TransactionsTable, TxCard, SettingsPanel, ConfirmModal, EditProfileModal, ListingModal, ChangePasswordModal,
} from './profile/components.jsx';
import { apiRequest, setProfileStoreFromUser, toProfileView } from './profile/data.js';

const go = (hash) => { window.location.hash = hash; };
const H2 = ({ children, action }) => <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">{children}</h2>{action}</div>;

const formatProduct = (product) => ({
  ...product,
  name: product.title || 'Untitled listing',
  desc: product.description || '',
  price: Number(product.price || 0),
  images: Array.isArray(product.images) ? product.images : [],
  createdAt: product.createdAt || null,
  transactionCount: product._count?.transactions || 0,
});

const formatTransaction = (transaction, userId) => {
  const isPurchase = transaction.buyerId === userId;
  const product = transaction.product || {};
  const otherParty = isPurchase ? transaction.seller : transaction.buyer;
  return {
    ...transaction,
    raw: transaction,
    name: product.title || 'Product no longer available',
    category: product.category || 'Others',
    condition: product.condition || '—',
    price: Number(transaction.totalPrice || product.price || 0),
    type: isPurchase ? 'Purchase' : 'Sale',
    who: otherParty?.fullName || 'AdNU member',
    date: transaction.createdAt ? new Date(transaction.createdAt) : null,
  };
};

export default function ProfilePage() {
  const [p, setP] = useState(null);
  const [tab, setTab] = useState('overview');
  const [listings, setListings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [savedProducts, setSavedProducts] = useState([]);
  const [favs, setFavs] = useState(() => store.favs instanceof Set ? store.favs : new Set());
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [favoritesError, setFavoritesError] = useState('');
  const [modal, setModal] = useState(null);
  const [navQ, setNavQ] = useState('');

  const loadData = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setPageError('');
    try {
      const [profileData, productData, transactionData] = await Promise.all([
        apiRequest('/api/profile/me'),
        apiRequest('/api/products/my-listings'),
        apiRequest('/api/transactions'),
      ]);
      const user = toProfileView(profileData.user);
      setP(user);
      setProfileStoreFromUser(profileData.user);
      setListings((Array.isArray(productData) ? productData : []).map(formatProduct));
      setTransactions((Array.isArray(transactionData) ? transactionData : []).map((tx) => formatTransaction(tx, user.id)));

      try {
        const favoriteData = await apiRequest('/api/profile/favorites');
        const products = (Array.isArray(favoriteData) ? favoriteData : []).map(formatProduct);
        setSavedProducts(products);
        const nextFavs = new Set(products.map((product) => product.id));
        setFavs(nextFavs);
        store.favs = nextFavs;
        setFavoritesError('');
      } catch (error) {
        setFavoritesError(`${error.message} If this is the first run after the profile update, apply the Prisma database update described in the setup guide.`);
      }
    } catch (error) {
      setPageError(error.message || 'Could not load your account information.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const nav = (value) => {
    if (value === 'messages') go('#/messages');
    else if (value === 'notifications') go('#/notifications');
    else if (value === 'profile') setTab('overview');
    else if (['saved', 'listings'].includes(value)) setTab(value);
    else go('#/home');
  };

  const toggleFav = async (productId) => {
    const wasSaved = favs.has(productId);
    const oldFavs = favs;
    const nextFavs = new Set(favs);
    if (wasSaved) nextFavs.delete(productId); else nextFavs.add(productId);
    setFavs(nextFavs);
    store.favs = nextFavs;
    if (wasSaved) setSavedProducts((items) => items.filter((item) => item.id !== productId));
    try {
      await apiRequest(`/api/profile/favorites/${productId}`, { method: wasSaved ? 'DELETE' : 'POST' });
      if (!wasSaved) await loadData({ quiet: true });
    } catch (error) {
      setFavs(oldFavs);
      store.favs = oldFavs;
      if (wasSaved) {
        const removed = savedProducts.find((item) => item.id === productId);
        if (removed) setSavedProducts((items) => [removed, ...items]);
      }
      setFavoritesError(error.message);
    }
  };

  const openItem = (item) => { store.open = item; go('#/home'); };

  const openTx = (tx) => {
    const raw = tx.raw || tx;
    store.tx = raw.product ? { ...raw.product, seller: raw.seller } : null;
    store.txId = raw.id;
    store.txStatus = raw.status;
    store.txBuyer = raw.buyer || null;
    localStorage.setItem('adnu_active_txId', raw.id);
    if (raw.product) localStorage.setItem('adnu_active_item', JSON.stringify(raw.product));
    go('#/transaction');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('rememberedEmail');
    sessionStorage.removeItem('token');
    localStorage.removeItem('role');
    setModal(null);
    go('#/');
  };

  const saveProfile = async ({ fullName }) => {
    const result = await apiRequest('/api/profile/me', { method: 'PATCH', body: JSON.stringify({ fullName }) });
    // Keep the token in the same storage used by the current login session.
    const tokenStorage = localStorage.getItem('token') ? localStorage : sessionStorage;
    tokenStorage.setItem('token', result.token);
    setP(toProfileView(result.user));
    setProfileStoreFromUser(result.user);
    setModal(null);
  };

  const saveListing = async (formData) => {
    const body = JSON.stringify({
      title: formData.name,
      description: formData.desc || '',
      price: formData.price,
      category: formData.category,
      condition: formData.condition,
    });
    const editing = Boolean(modal?.item?.id);
    const path = editing ? `/api/products/${modal.item.id}` : '/api/products';
    await apiRequest(path, { method: editing ? 'PUT' : 'POST', body });
    setModal(null);
    await loadData({ quiet: true });
  };

  const updateListingStatus = async (productId, action) => {
    try {
      await apiRequest(`/api/products/${productId}/status`, { method: 'PATCH', body: JSON.stringify({ action }) });
      await loadData({ quiet: true });
    } catch (error) {
      setPageError(error.message);
    }
  };

  const deleteListing = async () => {
    try {
      await apiRequest(`/api/products/${modal.item.id}`, { method: 'DELETE' });
      setModal(null);
      await loadData({ quiet: true });
    } catch (error) {
      setPageError(error.message);
      setModal(null);
    }
  };

  const handlePasswordChange = async ({ currentPassword, newPassword }) => {
    await apiRequest('/api/profile/me/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  };

  const purchases = transactions.filter((tx) => tx.type === 'Purchase');
  const sales = transactions.filter((tx) => tx.type === 'Sale' && String(tx.status || '').trim().toLowerCase() === 'completed');
  const recentTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);
  const recentListings = [...listings].slice(0, 4);
  const stats = [
    { label: 'Listings', value: listings.length, tab: 'listings' },
    { label: 'Active Listings', value: listings.filter((listing) => listing.status === 'approved').length, tab: 'listings' },
    { label: 'Purchases', value: purchases.length, tab: 'purchases' },
    { label: 'Sales', value: sales.length, tab: 'sales' },
  ];

  const actionsFor = (listing) => ({
    edit: () => setModal({ type: 'listing', item: { id: listing.id, name: listing.name, price: String(listing.price), category: listing.category, condition: listing.condition, desc: listing.desc } }),
    sold: () => updateListingStatus(listing.id, 'sold'),
    pause: () => updateListingStatus(listing.id, listing.status === 'paused' ? 'resume' : 'pause'),
    del: () => setModal({ type: 'delete', item: listing }),
  });

  const newButton = <button onClick={() => setModal({ type: 'listing' })} style={{ background: '#2b47a3' }} className="flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-md shadow-[#2b47a3]/25 transition duration-200 hover:-translate-y-0.5 hover:brightness-110"><Plus size={18} /> Create New Listing</button>;
  const link = (label, destination) => <button onClick={() => setTab(destination)} className="text-sm font-medium hover:underline" style={{ color: '#2b47a3' }}>{label}</button>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar query={navQ} setQuery={setNavQ} onNav={nav} profileActive />
      <main className="mx-auto max-w-[1250px] space-y-5 px-4 pb-28 pt-8 sm:px-8 lg:pb-12">
        {loading && !p ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading your account…</div> : null}
        {pageError && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{pageError}</span><button onClick={() => loadData()} className="shrink-0 font-semibold underline">Retry</button></div>}
        {p && <>
          <ProfileHeader p={p} onEdit={() => setModal({ type: 'edit' })} onSettings={() => setTab('settings')} />
          <StatCards stats={stats} onGo={setTab} />
          <ProfileTabs tab={tab} setTab={setTab} />

          {tab === 'overview' && <div className="space-y-8">
            <StudentInformation p={p} />
            <section><H2 action={link('View All Listings', 'listings')}>Recent Listings</H2>
              {recentListings.length ? <div className={listingGrid}>{recentListings.map((listing) => <ListingCard key={listing.id} l={listing} actions={actionsFor(listing)} />)}</div> : <EmptyState title="No listings yet" text="Products you submit for review will appear here." action="Create New Listing" onAction={() => setModal({ type: 'listing' })} />}
            </section>
            <section><H2>Recent Transactions</H2><TransactionsTable txs={recentTransactions} onOpen={openTx} /></section>
          </div>}

          {tab === 'listings' && <section><H2 action={newButton}>My Listings</H2>
            {listings.length ? <div className={listingGrid}>{listings.map((listing) => <ListingCard key={listing.id} l={listing} actions={actionsFor(listing)} />)}</div> : <EmptyState title="No listings yet" text="Submit your first item to start selling to fellow AdNU members." action="Create New Listing" onAction={() => setModal({ type: 'listing' })} />}
          </section>}

          {(tab === 'purchases' || tab === 'sales') && <section><H2>{tab === 'purchases' ? 'Purchases' : 'Sales'}</H2>
            {(tab === 'purchases' ? purchases : sales).length ? <div className="space-y-3">{(tab === 'purchases' ? purchases : sales).map((tx) => <TxCard key={tx.id} tx={tx} onOpen={openTx} />)}</div> : <EmptyState title={tab === 'purchases' ? 'No purchases yet' : 'No completed sales yet'} text={tab === 'purchases' ? 'Your purchases will appear here.' : 'Only completed sales appear here. Once a transaction is completed, it will show up here.'} />}
          </section>}

          {tab === 'saved' && <section><H2>Saved Items</H2>
            {favoritesError && <p role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{favoritesError}</p>}
            {savedProducts.length ? <ProductGrid items={savedProducts} favs={favs} onFav={toggleFav} onOpen={openItem} /> : <EmptyState icon={Bookmark} title="No Saved Items" text="Products you save from the marketplace will appear here." action="Browse Marketplace" onAction={() => go('#/home')} />}
          </section>}

          {tab === 'settings' && <section><H2>Settings</H2><SettingsPanel p={p} onEditInfo={() => setModal({ type: 'edit' })} onChangePw={() => setModal({ type: 'pw' })} onLogout={() => setModal({ type: 'logout' })} /></section>}
        </>}
      </main>
      <BottomNav view="profile" onNav={nav} />

      {modal?.type === 'edit' && <EditProfileModal p={p} onClose={() => setModal(null)} onSave={saveProfile} />}
      {modal?.type === 'listing' && <ListingModal initial={modal.item} onClose={() => setModal(null)} onSave={saveListing} />}
      {modal?.type === 'delete' && <ConfirmModal danger title="Delete Listing?" text={`“${modal.item.name}” will be permanently removed.`} confirmLabel="Delete Listing" onClose={() => setModal(null)} onConfirm={deleteListing} />}
      {modal?.type === 'pw' && <ChangePasswordModal onClose={() => setModal(null)} onSubmit={handlePasswordChange} />}
      {modal?.type === 'logout' && <ConfirmModal title="Log Out?" text="Are you sure you want to log out of ADNU TRADE?" confirmLabel="Log Out" onClose={() => setModal(null)} onConfirm={handleLogout} />}
    </div>
  );
}
