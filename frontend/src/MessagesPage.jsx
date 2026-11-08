import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MessageCircle } from "lucide-react";
import { Navbar, EmptyState } from "./market/components.jsx";
import {
  ConversationSidebar,
  ChatHeader,
  MarketplaceContextCard,
  TransactionCard,
  MessageBubble,
  MessageComposer,
  ReportModal,
  ProfileModal
} from "./messages/components.jsx";

const apiBaseUrl = "http://localhost:5000";

const parseJwt = (token) => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch (e) {
    console.error('Could not decode the current session token:', e);
    return null;
  }
};

const go = (hash) => { window.location.hash = hash; };

export default function MessagesPage() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const decoded = token ? parseJwt(token) : null;
  const currentUserId = decoded?.userId || decoded?.id;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeConvKey, setActiveConvKey] = useState(null);
  const [mobileChat, setMobileChat] = useState(false);
  const [q, setQ] = useState("");
  const [navQ, setNavQ] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [modal, setModal] = useState(null);
  const endRef = useRef(null);

  // Fetch all messages involving the user
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 3000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Transform database messages into the UI component data structure
  const conversations = useMemo(() => {
    const map = {};
    messages.forEach((m) => {
      const otherUser = m.senderId === currentUserId ? m.receiver : m.sender;
      const otherUserId = otherUser?.id || (m.senderId === currentUserId ? m.receiverId : m.senderId);
      const key = `${m.productId}_${otherUserId}`;

      if (!map[key]) {
        const rawName = otherUser?.role === "admin" ? "AdNU Trade Administration" : (otherUser?.fullName || "AdNU Student");
        const productTitle = m.product?.title ? ` (${m.product.title})` : "";

        map[key] = {
          id: key,
          productId: m.productId,
          name: `${rawName}${productTitle}`,
          item: {
            id: m.product?.id,
            name: m.product?.title || "Marketplace Item",
            price: parseFloat(m.product?.price || 0),
            category: m.product?.category || "General",
            condition: "Good"
          },
          otherUserId,
          messages: [],
          unread: 0,
        };
      }

      map[key].messages.push({
        id: m.id,
        text: m.content,
        at: new Date(m.createdAt),
        me: m.senderId === currentUserId,
        unreadForViewer: Boolean(m.unreadForViewer),
        status: "delivered",
        edited: false,
        deleted: false
      });
      if (m.unreadForViewer) map[key].unread += 1;
    });

    return Object.values(map).map(c => ({
      ...c,
      messages: c.messages.sort((a, b) => new Date(a.at) - new Date(b.at))
    }));
  }, [messages, currentUserId]);

  // Filter conversations by search query
  const filteredConvs = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter(c =>
      c.name.toLowerCase().includes(query) || c.item.name.toLowerCase().includes(query)
    );
  }, [conversations, q]);

  // Set initial active conversation
  useEffect(() => {
    if (!activeConvKey && filteredConvs.length > 0) {
      setActiveConvKey(filteredConvs[0].id);
    }
  }, [filteredConvs, activeConvKey]);

  const activeConv = filteredConvs.find((c) => c.id === activeConvKey) || filteredConvs[0];

  // Mark incoming messages as read only in the recipient's private inbox state.
  // The server never returns this state to the sender, so no public read receipts exist.
  useEffect(() => {
    if (!activeConv || activeConv.unread <= 0) return;
    const isConversationVisible = window.innerWidth >= 768 || mobileChat;
    if (!isConversationVisible) return;

    let cancelled = false;
    fetch(`${apiBaseUrl}/api/messages/read`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId: activeConv.productId, otherUserId: activeConv.otherUserId }),
    }).then((response) => {
      if (!response.ok || cancelled) return;
      setMessages((previous) => previous.map((message) => (
        message.productId === activeConv.productId &&
        message.senderId === activeConv.otherUserId &&
        message.receiverId === currentUserId
          ? { ...message, unreadForViewer: false }
          : message
      )));
      window.dispatchEvent(new Event('adnu-unread-counts-changed'));
    }).catch((error) => console.error('Could not mark conversation as read:', error));

    return () => { cancelled = true; };
  }, [activeConv?.id, activeConv?.unread, activeConv?.productId, activeConv?.otherUserId, mobileChat, token, currentUserId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages.length, mobileChat]);

  const handleSendMessage = async (text) => {
    if (!activeConv) return;

    try {
      const res = await fetch(`${apiBaseUrl}/api/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId: activeConv.productId,
          receiverId: activeConv.otherUserId,
          content: text
        })
      });

      if (res.ok) {
        setReplyTo(null);
        fetchConversations();
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleEditMessage = (id, newText) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content: newText } : m));
  };

  const handleDeleteMessage = (id) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-50 font-sans text-slate-900">
      <Navbar query={navQ} setQuery={setNavQ} onNav={(v) => go(`#/${v}`)} msgActive />

      {loading ? (
        <div className="m-auto text-sm text-slate-400">Loading messages...</div>
      ) : conversations.length === 0 ? (
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto mt-10 max-w-xl">
            <EmptyState icon={MessageCircle} title="No Messages Yet" text="Start a conversation with a seller or buyer to discuss an item." action="Browse Items" onAction={() => go("#/home")} />
          </div>
        </main>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className={`${mobileChat ? "hidden md:flex" : "flex"} w-full md:w-auto`}>
            <ConversationSidebar
              convs={filteredConvs}
              activeId={activeConvKey}
              onSelect={(id) => { setActiveConvKey(id); setMobileChat(true); }}
              q={q}
              setQ={setQ}
              unread={activeConv?.unread || 0}
            />
          </div>

          {/* Chat Section */}
          <section className={`${mobileChat ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col bg-slate-50`}>
            {activeConv ? (
              <>
                <ChatHeader
                  c={activeConv}
                  onBack={() => setMobileChat(false)}
                  actions={{
                    profile: () => setModal("profile"),
                    item: () => go(`#/home`),
                    report: () => setModal("report"),
                    block: () => alert("User blocked successfully.")
                  }}
                />

                <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
                  <MarketplaceContextCard item={activeConv.item} onView={() => go(`#/home`)} />

                  {activeConv.messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      m={m}
                      onReply={(msg) => setReplyTo(msg)}
                      onEdit={handleEditMessage}
                      onDelete={handleDeleteMessage}
                    />
                  ))}
                  <div ref={endRef} />
                </div>

                <MessageComposer
                  onSend={handleSendMessage}
                  replyTo={replyTo}
                  onCancelReply={() => setReplyTo(null)}
                  name={activeConv.name}
                />
              </>
            ) : (
              <div className="m-auto text-slate-400 text-sm">Select a conversation to start chatting</div>
            )}
          </section>
        </div>
      )}

      {modal === "report" && activeConv && <ReportModal name={activeConv.name} onClose={() => setModal(null)} />}
      {modal === "profile" && activeConv && <ProfileModal c={activeConv} onClose={() => setModal(null)} />}
    </div>
  );
}