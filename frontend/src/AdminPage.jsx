import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Clock,
  Bell,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  AlertCircle,
  ChevronRight,
  DollarSign,
  Image as ImageIcon,
  Tag,
  User,
  Users,
  LogOut,
  Maximize2,
  X
} from 'lucide-react';

export default function AdminPage({ onLogout }) {
  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'admins'

  // Product state
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxImage, setLightboxImage] = useState(null); // Full-screen lightbox state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pending Admin state
  const [pendingAdmins, setPendingAdmins] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentProofs, setPaymentProofs] = useState({});
  const [freeListingsEnabled, setFreeListingsEnabled] = useState(false);
  const [isSavingFreeListings, setIsSavingFreeListings] = useState(false);

  // Shared state
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Review modal input states
  const [reviewAction, setReviewAction] = useState('propose'); // propose | accept | counter | reject
  const [proposedFee, setProposedFee] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  const apiBaseUrl = 'http://localhost:5000';

  // Admins use a custom dashboard header, so load the same private unread
  // counts used by the shared navigation bar.
  useEffect(() => {
    let active = true;
    const refreshUnreadCounts = async () => {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        if (active) {
          setUnreadMessageCount(0);
          setUnreadNotificationCount(0);
        }
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      const [messagesResult, notificationsResult] = await Promise.allSettled([
        fetch(`${apiBaseUrl}/api/messages/unread-count`, { headers, cache: 'no-store' }),
        fetch(`${apiBaseUrl}/api/notifications/unread-count`, { headers, cache: 'no-store' }),
      ]);
      if (!active) return;

      if (messagesResult.status === 'fulfilled' && messagesResult.value.ok) {
        const data = await messagesResult.value.json().catch(() => ({}));
        setUnreadMessageCount(Math.max(0, Number(data.count) || 0));
      } else {
        setUnreadMessageCount(0);
      }
      if (notificationsResult.status === 'fulfilled' && notificationsResult.value.ok) {
        const data = await notificationsResult.value.json().catch(() => ({}));
        setUnreadNotificationCount(Math.max(0, Number(data.count) || 0));
      } else {
        setUnreadNotificationCount(0);
      }
    };

    refreshUnreadCounts();
    const interval = window.setInterval(refreshUnreadCounts, 15000);
    const handleRefresh = () => refreshUnreadCounts();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshUnreadCounts();
    };
    window.addEventListener('focus', handleRefresh);
    window.addEventListener('adnu-unread-counts-changed', handleRefresh);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('adnu-unread-counts-changed', handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const openActivityPage = (page) => {
    window.location.hash = `#/${page}`;
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    if (onLogout) {
      onLogout();
    } else {
      window.location.reload(); // Fallback reload if prop isn't passed
    }
  };

  // Fetch pending products from backend API
  const fetchPendingProducts = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`${apiBaseUrl}/api/admin/products/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned status ${res.status}`);
      }

      const data = await res.json();
      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch (err) {
      setApiError(err.message || 'Failed to fetch pending products from backend.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch pending admin accounts from backend API
  const fetchPendingAdmins = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`${apiBaseUrl}/api/admin/pending-admins`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned status ${res.status}`);
      }

      const data = await res.json();
      setPendingAdmins(Array.isArray(data) ? data : []);
    } catch (err) {
      setApiError(err.message || 'Failed to fetch pending admin accounts.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingPayments = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`${apiBaseUrl}/api/admin/listing-payments/pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned status ${res.status}`);
      }
      const data = await res.json();
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      setApiError(err.message || 'Failed to fetch payment submissions.');
    }
  };

  const fetchListingFeeSettings = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`${apiBaseUrl}/api/admin/settings/free-listings`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load listing fee settings.');
      setFreeListingsEnabled(Boolean(data.freeListingsEnabled));
    } catch (err) {
      setApiError(err.message || 'Could not load listing fee settings.');
    }
  };

  const handleToggleFreeListings = async () => {
    const nextEnabled = !freeListingsEnabled;
    const confirmed = window.confirm(nextEnabled
      ? 'Enable fee-free listings? All listings that have not been approved yet will become fee-free. Listings already negotiating a fee or awaiting payment will return to the admin review queue. Sellers will not need to pay, but an admin must still approve each listing before it becomes public.'
      : 'Disable fee-free listings? Listings submitted while fee-free mode was ON keep their fee waiver. New listings will use the standard fee proposal and e-wallet payment process.');
    if (!confirmed) return;

    setIsSavingFreeListings(true);
    setApiError(null);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`${apiBaseUrl}/api/admin/settings/free-listings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update listing fee settings.');
      setFreeListingsEnabled(Boolean(data.freeListingsEnabled));
      if (selectedProduct) {
        setReviewAction(data.freeListingsEnabled ? 'approve_free' : 'propose');
        setSelectedProduct(null);
      }
      await Promise.all([fetchPendingProducts(), fetchPendingPayments()]);
      setApiError(null);
    } catch (err) {
      setApiError(err.message || 'Could not update listing fee settings.');
    } finally {
      setIsSavingFreeListings(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];
    const loadProofs = async () => {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const entries = await Promise.all(payments.map(async (payment) => {
        try {
          const res = await fetch(`${apiBaseUrl}/api/admin/listing-payments/${payment.id}/proof`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) return [payment.id, null];
          const url = URL.createObjectURL(await res.blob());
          objectUrls.push(url);
          return [payment.id, url];
        } catch {
          return [payment.id, null];
        }
      }));
      if (!cancelled) setPaymentProofs(Object.fromEntries(entries));
    };
    if (payments.length) loadProofs();
    else setPaymentProofs({});
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [payments]);

  const handleReviewPayment = async (paymentId, action) => {
    const reviewNote = action === 'reject' ? (window.prompt('Why is this payment being rejected?') || '') : '';
    if (action === 'reject' && !reviewNote.trim()) return;
    if (!window.confirm(action === 'verify' ? 'Verify this transfer and publish the listing?' : 'Reject this transfer proof?')) return;
    setIsLoading(true);
    setApiError(null);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`${apiBaseUrl}/api/admin/listing-payments/${paymentId}/review`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewNote })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not review payment.');
      await fetchPendingPayments();
      await fetchPendingProducts();
    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingProducts();
    fetchPendingAdmins();
    fetchPendingPayments();
    fetchListingFeeSettings();
  }, []);

  // Submit product review directly to backend API
  const handleSubmitReview = async () => {
    if (!selectedProduct) return;
    if (reviewAction === 'reject' && !adminNotes.trim()) {
      setApiError('Please enter a rejection reason so the seller knows why the listing was rejected.');
      return;
    }
    if (['propose', 'counter'].includes(reviewAction) && freeListingsEnabled) {
      setApiError('Fee negotiation is disabled while fee-free mode is enabled.');
      return;
    }
    if (['propose', 'counter'].includes(reviewAction)) {
      const fee = Number(proposedFee);
      if (!Number.isSafeInteger(fee) || fee < 1 || fee > 99999999) {
        setApiError('Enter a whole-number listing fee from ₱1 to ₱99,999,999. Decimals, zero, and negative amounts are not allowed.');
        return;
      }
    }

    setIsLoading(true);
    setApiError(null);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const payload = {
        action: reviewAction.toLowerCase(),
        proposedFee: ['propose', 'counter'].includes(reviewAction) ? Number(proposedFee) : undefined,
        message: adminNotes
      };

      const res = await fetch(`${apiBaseUrl}/api/admin/products/${selectedProduct.id}/review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to submit review. Server error ${res.status}`);
      }

      await fetchPendingProducts();
      setSelectedProduct(null);
      resetReviewForm();
    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Approve a pending administrator account
  const handleApproveAdmin = async (adminId) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`${apiBaseUrl}/api/admin/approve-admin/${adminId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to approve admin account.');
      }

      await fetchPendingAdmins();
    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetReviewForm = () => {
    setReviewAction(freeListingsEnabled ? 'approve_free' : 'propose');
    setProposedFee('');
    setAdminNotes('');
    setActiveImageIndex(0);
  };

  // Filter products based on search and category/status drop-downs
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.seller?.name || p.seller?.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.seller?.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="min-w-[320px] min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Top Navigation Header */}
      <header className="bg-blue-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-yellow-500 p-2 rounded-lg text-blue-950 font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">AdNU Trade Admin Dashboard</h1>
              <p className="text-xs text-blue-200">Ateneo de Naga University Student Marketplace</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 flex-wrap">
            <div className="bg-blue-950/60 p-1 rounded-xl border border-blue-800 flex space-x-1">
              <button
                onClick={() => setActiveTab('products')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'products' ? 'bg-yellow-500 text-blue-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Product Queue ({products.length})
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'payments' ? 'bg-yellow-500 text-blue-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Listing Payments ({payments.length})
              </button>
              <button
                onClick={() => setActiveTab('admins')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'admins' ? 'bg-yellow-500 text-blue-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Pending Admins ({pendingAdmins.length})
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => openActivityPage('messages')}
                aria-label={unreadMessageCount ? `Messages, ${unreadMessageCount} unread` : 'Messages'}
                title="Messages"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white/90 transition hover:bg-white/10"
              >
                <MessageCircle className="h-[18px] w-[18px]" />
                {unreadMessageCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => openActivityPage('notifications')}
                aria-label={unreadNotificationCount ? `Notifications, ${unreadNotificationCount} unread` : 'Notifications'}
                title="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white/90 transition hover:bg-white/10"
              >
                <Bell className="h-[18px] w-[18px]" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={() => { fetchPendingProducts(); fetchPendingAdmins(); fetchPendingPayments(); }}
              className="bg-yellow-500 hover:bg-yellow-400 text-blue-950 text-xs px-3.5 py-2 rounded-xl font-bold transition shadow-sm"
            >
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>

            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white text-xs px-3.5 py-2 rounded-xl font-bold transition shadow-sm flex items-center space-x-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Error Alert Banner */}
        {apiError && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{apiError}</span>
            </div>
            <button
              onClick={() => setApiError(null)}
              className="text-red-500 hover:text-red-700 text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Global listing-fee policy switch */}
        <section className="mb-6 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-3 rounded-xl ${freeListingsEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h2 className="text-sm font-extrabold text-slate-900">Listing fee policy</h2>
                <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-full ${freeListingsEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {freeListingsEnabled ? 'Fee-free mode ON' : 'Standard fees ON'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                {freeListingsEnabled
                  ? 'Sellers pay no listing fee. Admin approval is still required before a listing becomes public.'
                  : 'Approved listings follow the normal fee negotiation and e-wallet payment process.'}
              </p>
              {freeListingsEnabled && <p className="text-[11px] text-emerald-700 mt-1">Listings submitted while this is ON keep their fee waiver, even if the switch is later turned OFF.</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 self-end md:self-auto">
            <span className="text-xs font-bold text-slate-600">{freeListingsEnabled ? 'Free listings' : 'Charge listing fees'}</span>
            <button
              type="button"
              role="switch"
              aria-checked={freeListingsEnabled}
              aria-label="Enable fee-free listings"
              disabled={isSavingFreeListings}
              onClick={handleToggleFreeListings}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${freeListingsEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${freeListingsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            {isSavingFreeListings && <span className="text-[11px] text-slate-500">Saving...</span>}
          </div>
        </section>

        {/* TAB 1: PRODUCT REVIEW QUEUE */}
        {activeTab === 'products' && (
          <>
            {/* Quick Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Pending Review</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">
                    {products.filter(p => p.status === 'pending_review').length}
                  </h3>
                </div>
                <div className="bg-amber-50 p-3 rounded-xl text-amber-600">
                  <Clock className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">In Negotiation</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">
                    {products.filter(p => p.status === 'negotiating' || p.status === 'fee_proposed').length}
                  </h3>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Total Queue Items</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">
                    {products.length}
                  </h3>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search product title or student email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center space-x-3 w-full md:w-auto">
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500">
                  <Filter className="w-4 h-4" />
                  <span>Filters:</span>
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Books">Books & Textbooks</option>
                  <option value="Uniforms">Uniforms & Apparel</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Other">Other</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="negotiating">Negotiating</option>
                  <option value="fee_proposed">Fee Proposed</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Product Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => {
                const latestFee = product.listingFees?.[0]?.proposedFee || product.listingFee || 0;
                const sellerName = product.seller?.fullName || product.seller?.name || 'AdNU Student';
                const sellerEmail = product.seller?.email || 'student@adnu.edu.ph';

                return (
                  <div
                    key={product.id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Product Thumbnail / Click to View Fullscale */}
                      <div className="relative h-48 bg-slate-100 border-b border-slate-100 overflow-hidden group">
                        {product.images && product.images.length > 0 ? (
                          <>
                            <img
                              src={product.images[0]}
                              alt={product.title}
                              className="w-full h-full object-cover cursor-pointer transition group-hover:scale-105"
                              onClick={() => {
                                setSelectedProduct(product);
                                setActiveImageIndex(0);
                                const latest = product.listingFees?.[0]?.proposedFee || product.listingFee || '';
                                setProposedFee(String(latest));
                                setReviewAction((freeListingsEnabled || product.listingFeeWaived) && product.status === 'pending_review' ? 'approve_free' : product.status === 'pending_review' ? 'propose' : 'accept');
                                setAdminNotes('');
                              }}
                            />
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setActiveImageIndex(0);
                                const latest = product.listingFees?.[0]?.proposedFee || product.listingFee || '';
                                setProposedFee(String(latest));
                                setReviewAction((freeListingsEnabled || product.listingFeeWaived) && product.status === 'pending_review' ? 'approve_free' : product.status === 'pending_review' ? 'propose' : 'accept');
                                setAdminNotes('');
                              }}
                              className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white font-medium text-xs gap-1.5"
                            >
                              <Maximize2 className="w-4 h-4" /> View Images ({product.images.length})
                            </button>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                            <ImageIcon className="w-8 h-8 mb-1" />
                            <span className="text-xs">No image provided</span>
                          </div>
                        )}

                        <span className="absolute top-3 right-3 bg-blue-900/95 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-full shadow pointer-events-none">
                          ₱{product.price}
                        </span>
                      </div>

                      {/* Card Content */}
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                            {product.category}
                          </span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            product.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                            product.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            product.status === 'negotiating' ? 'bg-purple-100 text-purple-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {product.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-800 text-base line-clamp-1 mb-1">
                          {product.title}
                        </h4>
                        <p className="text-xs text-slate-500 whitespace-pre-wrap break-words [overflow-wrap:anywhere] mb-4">
                          {product.description || 'No description provided.'}
                        </p>

                        <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs text-slate-600">
                          <div className="flex items-center space-x-2">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-medium text-slate-700">{sellerName}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Tag className="w-3.5 h-3.5 text-slate-400" />
                            <span>{sellerEmail}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Footer Button */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-slate-400">Current Fee: </span>
                        <span className="font-bold text-slate-700">{freeListingsEnabled || product.listingFeeWaived ? 'Waived' : `₱${latestFee}`}</span>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setActiveImageIndex(0);
                          setProposedFee(String(latestFee));
                          setReviewAction((freeListingsEnabled || product.listingFeeWaived) && product.status === 'pending_review' ? 'approve_free' : product.status === 'pending_review' ? 'propose' : 'accept');
                          setAdminNotes('');
                        }}
                        className="bg-blue-900 hover:bg-blue-800 text-white text-xs px-3.5 py-1.5 rounded-xl font-bold flex items-center space-x-1 transition"
                      >
                        <span>Review Listing</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {!isLoading && filteredProducts.length === 0 && (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 mt-6 shadow-sm">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium">No pending product listings found in the queue.</p>
              </div>
            )}
          </>
        )}

        {/* TAB 2: LISTING PAYMENT VERIFICATION */}
        {activeTab === 'payments' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800">E-wallet Transfer Verification</h3>
              <p className="mt-1 text-sm text-slate-500">Verify the reference number and receipt before a product becomes public.</p>
            </div>
            {payments.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                <CheckCircle2 className="mx-auto mb-2 h-9 w-9 text-slate-300" />
                <p className="font-medium">No listing payments are waiting for verification.</p>
              </div>
            ) : payments.map((payment) => (
              <article key={payment.id} className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[180px_1fr_auto]">
                <a href={paymentProofs[payment.id] || undefined} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl bg-slate-100">
                  {payment.proofImage?.toLowerCase().endsWith('.pdf') ? (
                    <div className="flex h-40 items-center justify-center text-sm font-semibold text-blue-800">Open PDF Receipt</div>
                  ) : paymentProofs[payment.id] ? (
                    <img src={paymentProofs[payment.id]} alt="Seller's e-wallet transfer proof" className="h-40 w-full object-cover" />
                  ) : (
                    <div className="flex h-40 items-center justify-center text-xs text-slate-400">Loading payment proof…</div>
                  )}
                </a>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-slate-900">{payment.product?.title || 'Listing'}</h4>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">Awaiting verification</span>
                  </div>
                  <p className="text-sm text-slate-600">Seller: <strong>{payment.seller?.fullName}</strong> · {payment.seller?.email}</p>
                  <div className="grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                    <p>Agreed fee: <strong className="text-slate-900">₱{Number(payment.amount).toFixed(2)}</strong></p>
                    <p>E-wallet: <strong className="text-slate-900">{payment.walletProvider}</strong></p>
                    <p>Sender: <strong className="text-slate-900">{payment.senderName || 'Not provided'}</strong></p>
                    <p>Reference: <strong className="text-slate-900">{payment.referenceNumber}</strong></p>
                  </div>
                  <p className="text-xs text-slate-400">Submitted {new Date(payment.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-row gap-2 md:flex-col md:justify-center">
                  <button onClick={() => handleReviewPayment(payment.id, 'verify')} disabled={isLoading} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">Verify & Publish</button>
                  <button onClick={() => handleReviewPayment(payment.id, 'reject')} disabled={isLoading} className="rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">Reject Proof</button>
                </div>
              </article>
            ))}
          </section>
        )}

        {/* TAB 3: PENDING ADMIN ACCOUNTS */}
        {activeTab === 'admins' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-800">Pending Administrator Accounts</h3>
                <p className="text-xs text-slate-500 mt-0.5">New admin accounts requiring manual approval before login is permitted.</p>
              </div>
              <div className="bg-blue-50 text-blue-900 px-3 py-1 rounded-xl text-xs font-bold">
                {pendingAdmins.length} Pending
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {pendingAdmins.map((admin) => (
                <div key={admin.id} className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/60 transition">
                  <div className="flex items-center space-x-4">
                    <div className="bg-slate-100 p-3 rounded-2xl text-slate-600">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{admin.fullName}</h4>
                      <p className="text-xs text-slate-500">{admin.email} {admin.idNumber ? `• ID: ${admin.idNumber}` : ''}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Registered: {new Date(admin.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleApproveAdmin(admin.id)}
                    disabled={isLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded-xl font-bold shadow-sm transition disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Admin</span>
                  </button>
                </div>
              ))}

              {!isLoading && pendingAdmins.length === 0 && (
                <div className="p-12 text-center text-slate-400">
                  <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">No pending administrator accounts awaiting approval.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Decision Review Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden shadow-2xl border border-slate-100">

            {/* Modal Title Header */}
            <div className="bg-blue-900 text-white p-5 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-base">Review Product Listing</h3>
                <p className="text-xs text-blue-200">ID: {selectedProduct.id}</p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-blue-200 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">

              {/* Full-Size Image Preview Section with Lightbox Trigger */}
              {selectedProduct.images && selectedProduct.images.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-600 block">Product Image Preview ({activeImageIndex + 1}/{selectedProduct.images.length})</label>
                    <button
                      type="button"
                      onClick={() => setLightboxImage(selectedProduct.images[activeImageIndex])}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <Maximize2 className="w-3.5 h-3.5" /> Fullscreen Lightbox
                    </button>
                  </div>
                  <div
                    className="relative w-full h-64 bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center cursor-pointer group"
                    onClick={() => setLightboxImage(selectedProduct.images[activeImageIndex])}
                  >
                    <img
                      src={selectedProduct.images[activeImageIndex]}
                      alt={selectedProduct.title}
                      className="w-full h-full object-contain transition group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-medium gap-1">
                      <Maximize2 className="w-4 h-4" /> Click to view full scale
                    </div>
                  </div>
                  {selectedProduct.images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pt-1 pb-1">
                      {selectedProduct.images.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveImageIndex(idx)}
                          className={`h-16 w-16 rounded-xl overflow-hidden border-2 shrink-0 bg-slate-100 transition ${
                            activeImageIndex === idx ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-200 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img src={img} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-32 bg-slate-100 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-slate-400">
                  <ImageIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs font-medium">No image provided for this listing</span>
                </div>
              )}

              {/* Product Quick Info Summary */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 min-w-0">
                <h4 className="font-bold text-slate-800 text-sm break-words [overflow-wrap:anywhere]">{selectedProduct.title}</h4>
                <div className="min-w-0">
                  <h5 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Description</h5>
                  <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{selectedProduct.description || 'No description provided.'}</p>
                </div>
                <div className="pt-2 flex flex-wrap justify-between gap-2 text-xs font-semibold text-slate-700">
                  <span>Price: ₱{selectedProduct.price}</span>
                  <span>Seller Fee: {freeListingsEnabled || selectedProduct.listingFeeWaived ? 'Waived' : `₱${selectedProduct.listingFees?.[0]?.proposedFee || selectedProduct.listingFee || 0}`}</span>
                </div>
              </div>

              {selectedProduct.listingFees?.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-slate-200 p-3">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Fee negotiation history</h4>
                  {[...selectedProduct.listingFees].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map((fee) => (
                    <div key={fee.id} className="rounded-xl bg-slate-50 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <strong>{fee.proposedBy === 'admin' ? 'Admin offer' : 'Seller counter-offer'}</strong>
                        <strong>₱{Number(fee.proposedFee).toFixed(2)}</strong>
                      </div>
                      <p className="mt-1 text-slate-500">{fee.status} · {new Date(fee.createdAt).toLocaleString()}</p>
                      {fee.message && <p className="mt-1 text-slate-700 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">“{fee.message}”</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Action Selector Buttons */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 block">Select Decision Action</label>
                <div className="grid grid-cols-2 gap-2">
                  {freeListingsEnabled || selectedProduct.listingFeeWaived ? (
                    selectedProduct.status === 'pending_review' && (
                      <button type="button" onClick={() => setReviewAction('approve_free')} className={`rounded-xl border px-3 py-2 text-xs font-bold ${reviewAction === 'approve_free' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>Approve Listing (Free)</button>
                    )
                  ) : selectedProduct.status === 'pending_review' ? (
                    <button type="button" onClick={() => setReviewAction('propose')} className={`rounded-xl border px-3 py-2 text-xs font-bold ${reviewAction === 'propose' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>Propose Fee</button>
                  ) : (
                    <>
                      <button type="button" onClick={() => setReviewAction('accept')} className={`rounded-xl border px-3 py-2 text-xs font-bold ${reviewAction === 'accept' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>Accept Seller Fee</button>
                      <button type="button" onClick={() => setReviewAction('counter')} className={`rounded-xl border px-3 py-2 text-xs font-bold ${reviewAction === 'counter' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>Counter Fee</button>
                    </>
                  )}
                  <button type="button" onClick={() => setReviewAction('reject')} className={`rounded-xl border px-3 py-2 text-xs font-bold ${reviewAction === 'reject' ? 'border-red-600 bg-red-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>Reject Listing</button>
                </div>
              </div>

              {/* Counter Offer Input Field */}
              {['propose', 'counter'].includes(reviewAction) && (
                <div className="space-y-1 bg-blue-50/50 p-3 rounded-2xl border border-blue-100">
                  <label className="text-xs font-bold text-blue-900 block">{reviewAction === 'propose' ? 'Proposed Listing Fee (₱)' : 'Admin Counter-Offer (₱)'}</label>
                  <input
                    type="number"
                    min="1"
                    max="99999999"
                    step="1"
                    inputMode="numeric"
                    required
                    value={proposedFee}
                    onChange={(e) => setProposedFee(e.target.value)}
                    placeholder="Enter new fee amount..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <p className="text-[11px] text-slate-500">Whole numbers only (₱1–₱99,999,999). Zero, negative values, and decimals are not accepted.</p>
                </div>
              )}

              {/* Admin Note Box */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">{reviewAction === 'reject' ? 'Rejection Reason (required)' : 'Message to Seller (optional)'}</label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder={reviewAction === 'reject' ? 'Explain why this listing is being rejected...' : reviewAction === 'approve_free' ? 'Add an optional message to the seller...' : 'Add context for your proposed fee or counter-offer...'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200/60 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={isLoading}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white shadow-md transition disabled:opacity-50"
              >
                {isLoading ? 'Submitting...' : reviewAction === 'approve_free' ? 'Approve Listing (Free)' : reviewAction === 'accept' ? 'Accept Seller Fee' : reviewAction === 'propose' ? 'Send Fee Proposal' : reviewAction === 'counter' ? 'Send Counter-Offer' : 'Reject Listing'}
              </button>
            </div>

          </div>
        </div>
      )}

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

    </div>
  );
}