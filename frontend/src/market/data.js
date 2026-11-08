export const CATEGORIES = ["Electronics", "Books", "Clothes", "School Supplies", "Others"];
export const CONDITIONS = ["New", "Like New", "Good", "Fair"];
export const PRICES = [
  { id: "any", label: "Any price", test: () => true },
  { id: "u100", label: "Under ₱100", test: (p) => p < 100 },
  { id: "100-500", label: "₱100–₱500", test: (p) => p >= 100 && p <= 500 },
  { id: "500-1000", label: "₱500–₱1,000", test: (p) => p > 500 && p <= 1000 },
  { id: "1000+", label: "₱1,000+", test: (p) => p > 1000 },
];
export const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "low", label: "Price: Low to High" },
  { id: "high", label: "Price: High to Low" },
];
export const peso = (n) => `₱${Number(n).toLocaleString("en-PH")}`;
export const postedOn = (days) =>
  new Date(Date.now() - days * 864e5).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

const LOCS = ["AdNU Main Campus", "Ateneo Avenue Gate", "Xavier Hall"];
const P = (id, name, price, category, condition, seller, rating, days, desc) => ({
  id, name, price, category, condition, seller, rating, days, desc, location: LOCS[id % 3],
});
export const PRODUCTS = [
  P(1, "Programming Fundamentals", 350, "Books", "Good", "Xavier", 4.8, 2, "Used for CS 101. Clean pages, no missing sheets, light highlighting in the first chapters."),
  P(2, "Database Systems Textbook", 500, "Books", "Like New", "Ana", 4.9, 3, "Barely used textbook with no markings. Includes the access code card for the companion site."),
  P(3, "Calculus Book", 250, "Books", "Fair", "Miguel", 4.5, 6, "Worn cover but all pages intact. Some pencil notes in the margins."),
  P(4, "Networking Essentials", 400, "Books", "Good", "John", 4.7, 1, "Latest edition used for IT networking subjects. Sticky tabs included."),
  P(5, "Scientific Calculator", 600, "Electronics", "Like New", "Bea", 4.9, 2, "Approved for exams. Comes with the cover and a fresh battery."),
  P(6, "USB-C Hub", 450, "Electronics", "New", "Carlo", 4.6, 4, "7-in-1 hub with HDMI, USB 3.0 and SD slots. Still sealed."),
  P(7, "Wireless Mouse", 300, "Electronics", "Good", "Sofia", 4.4, 5, "Quiet-click wireless mouse. Works perfectly, USB receiver included."),
  P(8, "Keyboard", 700, "Electronics", "Good", "Paolo", 4.8, 1, "Mechanical keyboard with blue switches and a detachable cable."),
  P(9, "AdNU Jacket", 800, "Clothes", "Like New", "Ana", 4.9, 7, "Official AdNU jacket, size M. Worn only a few times."),
  P(10, "PE Uniform", 400, "Clothes", "Good", "Miguel", 4.5, 3, "Complete PE set, size L. Washed and ready to use."),
  P(11, "Hoodie", 600, "Clothes", "Good", "Bea", 4.7, 8, "Plain navy hoodie, size M. Soft and warm for air-conditioned rooms."),
  P(12, "Drawing Set", 250, "School Supplies", "New", "Sofia", 4.6, 2, "Pencils, charcoal and a kneaded eraser. Great for design and architecture classes."),
  P(13, "Notebook Set", 150, "School Supplies", "New", "Carlo", 4.5, 4, "Set of 5 ruled notebooks, never opened."),
  P(14, "Binder", 100, "School Supplies", "Fair", "Xavier", 4.8, 9, "A4 ring binder with dividers. Small scuff on the cover."),
  P(15, "Desk Lamp", 350, "Others", "Good", "John", 4.7, 5, "Adjustable LED desk lamp with USB charging. Perfect for dorm study sessions."),
];
