// Mock chat data. Held in memory so unread counts persist while you move between pages.
export const chatStore = { convs: null };
const ago = (m) => new Date(Date.now() - m * 60000);
let seq = 100;
export const uid = () => `m${++seq}`;
const msg = (id, me, text, m, extra = {}) => ({ id, me, text, at: ago(m), status: "delivered", ...extra });

function seed() {
  if (typeof window !== "undefined" && window.location.hash.includes("empty")) return [];
  return [
    {
      id: "xavier", name: "Xavier Santos", online: true, lastSeen: "", rating: 4.9, unread: 0, blocked: false, tx: "ready",
      item: { id: 2, name: "Database Systems Textbook", price: 500, category: "Books", condition: "Good", seller: "Xavier Santos", rating: 4.9, days: 3, location: "AdNU Main Campus", desc: "Textbook for the Database Systems course. Clean pages, no missing sheets." },
      messages: [
        msg("x1", true, "Hi! Is this textbook still available?", 62),
        msg("x2", false, "Yes! It's still available.", 58),
        msg("x3", true, "Great! Can we meet tomorrow?", 50),
        msg("x4", false, "Sure! I can meet you at the AdNU Main Campus around 3 PM.", 45),
        msg("x5", true, "Perfect. I'll see you there!", 2),
      ],
    },
    {
      id: "maria", name: "Maria Cruz", online: false, lastSeen: "10 minutes ago", rating: 4.9, unread: 1, blocked: false, tx: null,
      item: { id: 9, name: "AdNU Jacket", price: 800, category: "Clothes", condition: "Like New", seller: "Maria Cruz", rating: 4.9, days: 7, location: "AdNU Main Campus", desc: "Official AdNU jacket, size M. Worn only a few times." },
      messages: [msg("m1", true, "Is the jacket still available?", 95), msg("m2", false, "Yes, it is. What size are you looking for?", 62, { status: undefined })],
    },
    {
      id: "john", name: "John Reyes", online: false, lastSeen: "3 hours ago", rating: 4.7, unread: 0, blocked: false, tx: null,
      item: { id: 5, name: "Scientific Calculator", price: 600, category: "Electronics", condition: "Like New", seller: "John Reyes", rating: 4.7, days: 2, location: "AdNU Main Campus", desc: "Approved for exams. Comes with the cover and a fresh battery." },
      messages: [msg("j1", true, "Can you do ₱500?", 1500), msg("j2", false, "Sure, ₱500 works for me.", 1480)],
    },
  ];
}
export const getConvs = () => (chatStore.convs ??= seed());

const same = (a, b) => a.toDateString() === b.toDateString();
export const clock = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
export const dayLabel = (d) => {
  const now = new Date();
  if (same(d, now)) return "Today";
  if (same(d, new Date(now - 864e5))) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
};
export const rel = (d) => {
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24 && same(d, new Date())) return `${h} hour${h > 1 ? "s" : ""} ago`;
  return dayLabel(d);
};
export const totalUnread = () => (chatStore.convs || getConvs()).reduce((n, c) => n + c.unread, 0);
