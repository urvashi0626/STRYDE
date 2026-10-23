"use strict";

/* =========================================================
   STRYDE — script.js
   ---------------------------------------------------------
   CONFIGURE BEFORE GOING LIVE (search this file for "CONFIG:"):
     1. OWNER_WHATSAPP   owner's WhatsApp number
     2. OWNER_EMAIL      inbox that receives email orders
     3. PRODUCTS[].price real prices in INR, then set PRICES_ARE_SAMPLES = false
     4. CONTACT_DETAILS  public contact info for the Contact section
   ---------------------------------------------------------
   How ordering works (no backend):
   - The cart lives in localStorage (product id + quantity only).
   - Prices and totals are always recomputed from PRODUCTS below,
     never read from the page or from storage.
   - Checkout builds a message and opens WhatsApp (wa.me) or the
     customer's email app (mailto). The customer must press Send.
   - Customer details are kept in memory only and are never stored.
   ========================================================= */

/* ---------------- CONFIG ---------------- */

// CONFIG: Replace with the owner's actual country-code-prefixed number without plus sign or spaces.
// Example: +91 98765 43210  ->  "919876543210"
const OWNER_WHATSAPP = "917988992492";

// CONFIG: Replace with the owner's real email address.
const OWNER_EMAIL = "bediurvashi6@gmail.com";

const STORE_NAME = "STRYDE";

// CONFIG: Set to false once real prices are entered in PRODUCTS.
// While true, every price shows a "Sample price" tag.
const PRICES_ARE_SAMPLES = true;

// CONFIG: Flat delivery fee in INR. 0 = shown as "Confirmed by STRYDE" and not added to the total.
const DELIVERY_FEE = 0;

// CONFIG: Maximum quantity of a single product per order.
const MAX_QTY_PER_ITEM = 10;

// CONFIG: Public contact details for the Contact section.
// Leave a value as "" to hide that row. Placeholder-looking values are hidden automatically.
const CONTACT_DETAILS = {
  phone: "",   // e.g. "+91 98765 43210"
  email: "",   // e.g. "hello@stryde.in" (falls back to OWNER_EMAIL when that is configured)
  address: "", // e.g. "12 MG Road, Bengaluru, Karnataka 560001"
  hours: ""    // e.g. "Mon to Sat, 10am to 7pm"
};

// CONFIG: Product catalogue. This is the ONLY trusted source for names and prices.
// Prices are whole rupees (INR). Descriptions are sample copy; edit to match your stock.
const PRODUCTS = [
  {
    id: "cricket-bat",
    name: "Premium Cricket Bat",
    category: "cricket",
    categoryLabel: "Cricket",
    price: 4999, // CONFIG: sample price (INR)
    image: "https://i.ibb.co/gZLTCYLW/bat.jpg",
    alt: "Premium cricket bat",
    summary: "A full-profile bat with a balanced pick-up, for players who want power without losing control.",
    details: [
      "Full-size blade for adult players",
      "Cushioned grip for comfort through long innings",
      "Balanced pick-up for quick bat speed"
    ],
    keywords: ["bat", "cricket", "willow"]
  },
  {
    id: "basketball",
    name: "Professional Basketball",
    category: "basketball",
    categoryLabel: "Basketball",
    price: 1999, // CONFIG: sample price (INR)
    image: "https://i.ibb.co/gLVdp6y5/basket-ball.jpg",
    alt: "Professional basketball",
    summary: "A size 7 match ball with deep channels for a confident grip indoors and outdoors.",
    details: [
      "Size 7 match ball",
      "Composite cover for indoor and outdoor courts",
      "Deep channels for control on every dribble"
    ],
    keywords: ["ball", "basketball", "hoops", "size 7"]
  },
  {
    id: "sports-jersey",
    name: "Performance Sports Jersey",
    category: "sportswear",
    categoryLabel: "Sportswear",
    price: 1299, // CONFIG: sample price (INR)
    image: "https://i.ibb.co/ZRJsbvFP/jerseys.jpg",
    alt: "Performance sports jerseys",
    summary: "A lightweight, breathable jersey that stays comfortable from training to match day.",
    details: [
      "Quick-dry, breathable fabric",
      "Relaxed athletic fit",
      "Add your size in the order notes at checkout"
    ],
    keywords: ["jersey", "shirt", "kit", "sportswear", "apparel", "tee"]
  }
];

/* ---------------- Constants ---------------- */

const CART_STORAGE_KEY = "stryde-cart-v1";

const CATEGORY_LABELS = {
  all: "All products",
  cricket: "Cricket",
  basketball: "Basketball",
  sportswear: "Sportswear"
};

const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const MAILTO_SAFE_LENGTH = 1800; // some email apps truncate longer mailto links

/* ---------------- Helpers ---------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const productById = new Map(PRODUCTS.map((p) => [p.id, p]));

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});
const formatINR = (n) => inrFormatter.format(n);
const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[\p{L}][\p{L}\p{M}\s.'-]*$/u;
const PIN_RE = /^[1-9]\d{5}$/;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

const collapseSpaces = (s) => String(s).replace(/\s+/g, " ").trim();

function clampQty(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_QTY_PER_ITEM);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isDevEnvironment() {
  const host = location.hostname;
  return location.protocol === "file:" || host === "" || host === "localhost" ||
    host === "127.0.0.1" || host === "[::1]";
}

function isWhatsAppConfigured() {
  return /^[1-9]\d{9,14}$/.test(OWNER_WHATSAPP);
}

function isEmailConfigured() {
  return EMAIL_RE.test(OWNER_EMAIL) && !/@example\.(com|org|net)$/i.test(OWNER_EMAIL);
}

function looksLikePlaceholder(value) {
  return !value || /X{3,}|example\.(com|org|net)|\[.*\]/i.test(value);
}

function formatWhatsAppDisplay(n) {
  return /^91\d{10}$/.test(n) ? `+91 ${n.slice(2, 7)} ${n.slice(7)}` : `+${n}`;
}

// Accepts 98765 43210, +91 98765 43210, 098765 43210, 919876543210. Returns 10 digits or null.
function normalizeMobile(value) {
  let d = String(value).replace(/[\s\-().]/g, "");
  if (d.startsWith("+91")) d = d.slice(3);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

const formatMobile = (d) => `+91 ${d.slice(0, 5)} ${d.slice(5)}`;

function initials(name) {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
}

function sampleTagHTML() {
  return PRICES_ARE_SAMPLES ? '<span class="sample-tag">Sample price</span>' : "";
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

/* ---------------- State ---------------- */

let cart = [];                 // [{ id, qty }]
let storageWorks = true;
let activeFilter = "all";
let searchQuery = "";
const selectorQty = new Map(); // quantity chosen on product cards / details, per product id
let pendingOrder = null;       // { ref, createdAt } — reused if the customer retries
let lastSend = null;           // { order, channel, link } for the current send attempt
let toastTimer = null;
const dom = {};

/* ---------------- Cart storage ---------------- */

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    const clean = [];
    for (const item of parsed) {
      // Only accept known product ids and sane quantities; ignore anything else.
      if (!item || typeof item.id !== "string" || !productById.has(item.id) || seen.has(item.id)) continue;
      const qty = Math.floor(Number(item.qty));
      if (!Number.isFinite(qty) || qty < 1) continue;
      seen.add(item.id);
      clean.push({ id: item.id, qty: Math.min(qty, MAX_QTY_PER_ITEM) });
    }
    return clean;
  } catch (err) {
    console.warn("STRYDE: could not read saved cart.", err);
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    storageWorks = true;
  } catch (err) {
    if (storageWorks) {
      storageWorks = false;
      console.warn("STRYDE: localStorage unavailable.", err);
      showToast("Your cart can't be saved on this device. It will work until you close this page.");
    }
  }
}

/* ---------------- Cart operations ---------------- */

function commitCart() {
  saveCart();
  pendingOrder = null; // cart changed, so any future send gets a fresh reference
  renderCart();
  updateCartCount();
  renderCheckoutSummary();
}

function addToCart(id, qty) {
  if (!productById.has(id)) return { added: 0, requested: qty };
  const line = cart.find((l) => l.id === id);
  const current = line ? line.qty : 0;
  const next = Math.min(current + qty, MAX_QTY_PER_ITEM);
  const added = next - current;
  if (added > 0) {
    if (line) line.qty = next;
    else cart.push({ id, qty: next });
    commitCart();
    bumpCartCount();
  }
  return { added, requested: qty };
}

function setCartQty(id, qty) {
  const line = cart.find((l) => l.id === id);
  if (!line) return;
  line.qty = clampQty(qty);
  commitCart();
}

function removeFromCart(id) {
  const p = productById.get(id);
  cart = cart.filter((l) => l.id !== id);
  commitCart();
  if (p) showToast(`${p.name} removed from your cart.`);
}

function clearCart() {
  cart = [];
  commitCart();
}

// Totals always come from PRODUCTS (trusted data), never from the DOM.
function getTotals() {
  const lines = cart
    .map((l) => {
      const product = productById.get(l.id);
      return product ? { product, qty: l.qty, lineTotal: product.price * l.qty } : null;
    })
    .filter(Boolean);
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const itemCount = lines.reduce((sum, l) => sum + l.qty, 0);
  const delivery = DELIVERY_FEE > 0 && lines.length ? DELIVERY_FEE : 0;
  return { lines, itemCount, subtotal, delivery, total: subtotal + delivery };
}

/* ---------------- Rendering: products ---------------- */

function qtyStepperHTML(scope, product, qty) {
  const name = escapeHTML(product.name);
  const id = escapeHTML(product.id);
  const small = scope === "cart" ? " qty-sm" : "";
  return `
    <div class="qty${small}" role="group" aria-label="Quantity for ${name}">
      <button type="button" class="qty-btn" data-action="qty-dec" data-scope="${scope}" data-id="${id}"
        data-fk="${scope}-dec-${id}" aria-label="Decrease quantity of ${name}" aria-disabled="${qty <= 1}">−</button>
      <input class="qty-input" type="number" inputmode="numeric" min="1" max="${MAX_QTY_PER_ITEM}" step="1"
        value="${qty}" data-scope="${scope}" data-id="${id}" data-fk="${scope}-input-${id}" aria-label="Quantity of ${name}">
      <button type="button" class="qty-btn" data-action="qty-inc" data-scope="${scope}" data-id="${id}"
        data-fk="${scope}-inc-${id}" aria-label="Increase quantity of ${name}" aria-disabled="${qty >= MAX_QTY_PER_ITEM}">+</button>
    </div>`;
}

function productCardHTML(p) {
  const qty = selectorQty.get(p.id) || 1;
  const id = escapeHTML(p.id);
  return `
    <article class="product-card">
      <button type="button" class="media product-media" data-action="details" data-id="${id}"
        data-fallback="${escapeHTML(p.name)}" tabindex="-1" aria-hidden="true">
        <img src="${escapeHTML(p.image)}" alt="" loading="lazy" width="800" height="600">
      </button>
      <div class="product-body">
        <p class="product-cat">${escapeHTML(p.categoryLabel)}</p>
        <h3 class="product-name"><button type="button" class="link-btn" data-action="details" data-id="${id}">${escapeHTML(p.name)}</button></h3>
        <p class="product-price">${formatINR(p.price)} ${sampleTagHTML()}</p>
        <button type="button" class="link-btn details-btn" data-action="details" data-id="${id}">View details<span class="visually-hidden"> for ${escapeHTML(p.name)}</span></button>
        <div class="product-controls">
          <div class="qty-row"><span class="qty-label" aria-hidden="true">Qty</span>${qtyStepperHTML("card", p, qty)}</div>
          <div class="product-buttons">
            <button type="button" class="btn btn-dark" data-action="add" data-id="${id}">Add to cart</button>
            <button type="button" class="btn btn-lime" data-action="buy" data-id="${id}">Buy now</button>
          </div>
        </div>
      </div>
    </article>`;
}

function renderProducts(announce = true) {
  const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const list = PRODUCTS.filter((p) => {
    if (activeFilter !== "all" && p.category !== activeFilter) return false;
    if (!terms.length) return true;
    const haystack = [p.name, p.categoryLabel, ...p.keywords].join(" ").toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });

  dom.grid.innerHTML = list.map(productCardHTML).join("");
  dom.noResults.hidden = list.length > 0;
  if (!list.length) dom.noResultsTerm.textContent = searchQuery || CATEGORY_LABELS[activeFilter];

  $$(".chip").forEach((chip) => chip.setAttribute("aria-pressed", String(chip.dataset.filter === activeFilter)));

  if (announce) {
    const where = activeFilter === "all" ? "" : ` in ${CATEGORY_LABELS[activeFilter]}`;
    dom.productStatus.textContent = `${list.length} ${list.length === 1 ? "product" : "products"} shown${where}.`;
  }
}

function setFilter(filter, { clearSearch = false } = {}) {
  activeFilter = Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, filter) ? filter : "all";
  if (clearSearch) {
    searchQuery = "";
    dom.searchInput.value = "";
  }
  renderProducts();
}

// Keep card + details-modal quantity selectors in sync for one product.
function syncSelectorQty(id) {
  const q = selectorQty.get(id) || 1;
  $$(".qty-input").forEach((input) => {
    if (input.dataset.id !== id || input.dataset.scope === "cart") return;
    input.value = q;
    const group = input.parentElement;
    group.querySelector('[data-action="qty-dec"]').setAttribute("aria-disabled", String(q <= 1));
    group.querySelector('[data-action="qty-inc"]').setAttribute("aria-disabled", String(q >= MAX_QTY_PER_ITEM));
  });
}

function changeQty(scope, id, delta) {
  if (!productById.has(id)) return;
  if (scope === "cart") {
    const line = cart.find((l) => l.id === id);
    if (!line) return;
    const next = line.qty + delta;
    if (next < 1 || next > MAX_QTY_PER_ITEM) return;
    setCartQty(id, next);
  } else {
    const next = (selectorQty.get(id) || 1) + delta;
    if (next < 1 || next > MAX_QTY_PER_ITEM) return;
    selectorQty.set(id, next);
    syncSelectorQty(id);
  }
}

function handleAdd(id, { quiet = false } = {}) {
  const p = productById.get(id);
  if (!p) return false;
  const qty = selectorQty.get(id) || 1;
  const { added } = addToCart(id, qty);
  selectorQty.set(id, 1);
  syncSelectorQty(id);

  if (added === 0) {
    showToast(`You already have the maximum of ${MAX_QTY_PER_ITEM} × ${p.name} in your cart.`, {
      label: "View cart", onClick: openCart
    });
    return true; // still allow Buy Now to proceed to checkout
  }
  if (!quiet) {
    const capped = added < qty ? ` (limit is ${MAX_QTY_PER_ITEM} per product)` : "";
    showToast(`Added ${added} × ${p.name} to your cart${capped}.`, { label: "View cart", onClick: openCart });
  }
  return true;
}

function handleBuy(id) {
  if (!handleAdd(id, { quiet: true })) return;
  closeDialog(dom.productDialog);
  openCheckout();
}

/* ---------------- Product details dialog ---------------- */

function openProductDialog(id) {
  const p = productById.get(id);
  if (!p) return;
  const qty = selectorQty.get(id) || 1;
  const safeId = escapeHTML(p.id);
  dom.productDialogBody.innerHTML = `
    <div class="media detail-media" data-fallback="${escapeHTML(p.name)}">
      <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.alt)}" width="1000" height="1000">
    </div>
    <div class="detail-info">
      <p class="product-cat">${escapeHTML(p.categoryLabel)}</p>
      <h2 class="detail-name" id="product-dialog-title">${escapeHTML(p.name)}</h2>
      <p class="product-price">${formatINR(p.price)} ${sampleTagHTML()}</p>
      <p>${escapeHTML(p.summary)}</p>
      <ul class="detail-points">${p.details.map((d) => `<li>${escapeHTML(d)}</li>`).join("")}</ul>
      <div class="qty-row"><span class="qty-label" aria-hidden="true">Quantity</span>${qtyStepperHTML("modal", p, qty)}</div>
      <div class="detail-actions">
        <button type="button" class="btn btn-dark" data-action="add" data-id="${safeId}">Add to cart</button>
        <button type="button" class="btn btn-lime" data-action="buy" data-id="${safeId}">Buy now</button>
      </div>
      <p class="fine-print">STRYDE confirms stock, delivery and the final price after you send your order.</p>
    </div>`;
  openDialog(dom.productDialog);
}

/* ---------------- Rendering: cart ---------------- */

function totalsHTML(t) {
  const deliveryValue = t.delivery ? formatINR(t.delivery) : "Confirmed by STRYDE";
  const note = t.delivery ? "" : '<dd class="totals-note">Delivery charges, if any, are confirmed by STRYDE when they reply.</dd>';
  return `
    <dt>Subtotal (${t.itemCount} ${t.itemCount === 1 ? "item" : "items"})</dt><dd>${formatINR(t.subtotal)}</dd>
    <dt>Delivery</dt><dd>${deliveryValue}</dd>
    <dt class="total-row">Total</dt><dd class="total-row">${formatINR(t.total)}</dd>
    ${note}`;
}

function cartItemHTML(l) {
  const p = l.product;
  const id = escapeHTML(p.id);
  return `
    <li class="cart-item">
      <span class="media cart-thumb" data-fallback="${escapeHTML(initials(p.name))}">
        <img src="${escapeHTML(p.image)}" alt="" width="168" height="168" loading="lazy">
      </span>
      <div>
        <div class="cart-item-top">
          <div>
            <p class="cart-item-name">${escapeHTML(p.name)}</p>
            <p class="cart-item-meta">${formatINR(p.price)} each</p>
          </div>
          <p class="cart-line-total"><span class="visually-hidden">Line total </span>${formatINR(l.lineTotal)}</p>
        </div>
        <div class="cart-item-bottom">
          ${qtyStepperHTML("cart", p, l.qty)}
          <button type="button" class="link-btn remove-btn" data-action="remove" data-id="${id}" data-fk="remove-${id}">
            Remove<span class="visually-hidden"> ${escapeHTML(p.name)}</span>
          </button>
        </div>
      </div>
    </li>`;
}

function renderCart() {
  const t = getTotals();
  const active = document.activeElement;
  const wasInCart = dom.cartDialog.open && dom.cartDialog.contains(active);
  const focusKey = wasInCart && active.dataset ? active.dataset.fk : null;

  dom.cartHeadCount.textContent = t.itemCount ? `(${t.itemCount})` : "";

  if (!t.lines.length) {
    dom.cartBody.innerHTML = `
      <div class="cart-empty">
        <span class="empty-mark" aria-hidden="true"></span>
        <p class="cart-empty-title">Your cart is empty</p>
        <p class="cart-empty-text">Add a bat, a ball or a jersey to get started.</p>
        <button type="button" class="btn btn-lime" data-action="browse">Browse products</button>
      </div>`;
    dom.cartFoot.innerHTML = "";
    dom.cartFoot.hidden = true;
  } else {
    dom.cartBody.innerHTML = `<ul class="cart-items">${t.lines.map(cartItemHTML).join("")}</ul>`;
    dom.cartFoot.innerHTML = `
      <dl class="totals">${totalsHTML(t)}</dl>
      <button type="button" class="btn btn-lime btn-block btn-lg" data-action="checkout">Proceed to checkout</button>
      <button type="button" class="btn btn-ghost btn-block" data-action="browse">Continue shopping</button>`;
    dom.cartFoot.hidden = false;
  }

  // Re-rendering replaces buttons, so put focus back where the customer was.
  if (wasInCart) {
    const target = focusKey ? dom.cartDialog.querySelector(`[data-fk="${CSS.escape(focusKey)}"]`) : null;
    (target || dom.cartTitle).focus();
  }
}

function updateCartCount() {
  const n = cart.reduce((sum, l) => sum + l.qty, 0);
  dom.cartCount.textContent = n > 99 ? "99+" : String(n);
  dom.cartCount.classList.toggle("is-empty", n === 0);
  dom.cartButton.setAttribute("aria-label", `Open cart, ${n} ${n === 1 ? "item" : "items"}`);
}

function bumpCartCount() {
  dom.cartCount.classList.remove("bump");
  void dom.cartCount.offsetWidth; // restart the animation
  dom.cartCount.classList.add("bump");
}

function openCart() {
  closeDialog(dom.productDialog);
  renderCart();
  openDialog(dom.cartDialog);
}

/* ---------------- Dialog helpers ---------------- */

function openDialog(dialog) {
  if (dialog.open) return;
  dialog._returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  document.body.classList.add("no-scroll");
}

function closeDialog(dialog) {
  if (!dialog || !dialog.open) return;
  if (typeof dialog.close === "function") dialog.close();
  else {
    dialog.removeAttribute("open");
    dialog.dispatchEvent(new Event("close"));
  }
}

function setupDialog(dialog) {
  let pressStartedOnBackdrop = false;
  dialog.addEventListener("pointerdown", (e) => { pressStartedOnBackdrop = e.target === dialog; });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog && pressStartedOnBackdrop) closeDialog(dialog);
  });
  dialog.addEventListener("close", () => {
    if (dom.toastRegion.parentElement === dialog) document.body.appendChild(dom.toastRegion);
    if (!document.querySelector("dialog[open]")) {
      document.body.classList.remove("no-scroll");
      const target = dialog._returnFocus;
      if (target && document.contains(target) && !target.closest("dialog")) target.focus({ preventScroll: true });
    }
    dialog._returnFocus = null;
  });
}

/* ---------------- Toast ---------------- */

function hideToast() {
  clearTimeout(toastTimer);
  dom.toastRegion.innerHTML = "";
}

function showToast(message, action) {
  if (!dom.toastRegion) return;
  // Dialogs sit in the top layer, so the toast must live inside the open dialog to be visible.
  const host = document.querySelector("dialog[open]") || document.body;
  if (dom.toastRegion.parentElement !== host) host.appendChild(dom.toastRegion);

  dom.toastRegion.innerHTML = "";
  const toast = document.createElement("div");
  toast.className = "toast";
  const text = document.createElement("p");
  text.textContent = message;
  toast.appendChild(text);
  if (action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "link-btn";
    btn.textContent = action.label;
    btn.addEventListener("click", () => { hideToast(); action.onClick(); });
    toast.appendChild(btn);
  }
  dom.toastRegion.appendChild(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 6000 : 4000);
}

/* ---------------- Checkout form ---------------- */

const FIELDS = [
  {
    key: "name", id: "co-name", label: "Full name",
    read: (el) => collapseSpaces(el.value),
    check(v) {
      if (!v) return "Enter your full name.";
      if (v.length < 2 || v.length > 80) return "Name should be between 2 and 80 characters.";
      if (!NAME_RE.test(v)) return "Use letters, spaces, dots, apostrophes or hyphens only.";
      return "";
    }
  },
  {
    key: "mobile", id: "co-mobile", label: "Mobile number",
    read: (el) => el.value.trim(),
    check(v) {
      if (!v) return "Enter your mobile number.";
      if (!normalizeMobile(v)) return "Enter a valid 10-digit Indian mobile number, for example 98765 43210.";
      return "";
    }
  },
  {
    key: "email", id: "co-email", label: "Email",
    read: (el) => el.value.trim(),
    check(v) {
      if (!v) return "Enter your email address.";
      if (v.length > 254 || !EMAIL_RE.test(v)) return "Enter a valid email address, for example name@gmail.com.";
      return "";
    }
  },
  {
    key: "address", id: "co-address", label: "Full delivery address",
    read: (el) => el.value.replace(/\r\n?/g, "\n").split("\n").map(collapseSpaces).filter(Boolean).join("\n"),
    check(v) {
      if (!v) return "Enter your full delivery address.";
      if (v.length < 10) return "Add your house or flat number, street and area so the order can be delivered.";
      if (v.length > 300) return "Keep the address under 300 characters.";
      return "";
    }
  },
  {
    key: "city", id: "co-city", label: "City",
    read: (el) => collapseSpaces(el.value),
    check(v) {
      if (!v) return "Enter your city.";
      if (v.length > 60 || !NAME_RE.test(v)) return "Enter a valid city name.";
      return "";
    }
  },
  {
    key: "state", id: "co-state", label: "State",
    read: (el) => el.value,
    check: (v) => (INDIAN_STATES.includes(v) ? "" : "Select your state.")
  },
  {
    key: "pin", id: "co-pin", label: "PIN code",
    read: (el) => el.value.replace(/\s/g, ""),
    check(v) {
      if (!v) return "Enter your PIN code.";
      if (!PIN_RE.test(v)) return "Enter a valid 6-digit PIN code.";
      return "";
    }
  },
  {
    key: "notes", id: "co-notes", label: "Order notes",
    read: (el) => el.value.replace(/\r\n?/g, "\n").trim().replace(/\n{3,}/g, "\n\n"),
    check: (v) => (v.length > 500 ? "Keep notes under 500 characters." : "")
  },
  {
    key: "confirm", id: "co-confirm", label: "Delivery details confirmation",
    read: (el) => el.checked,
    check: (v) => (v ? "" : "Tick this box to confirm your delivery details are correct.")
  }
];
const fieldById = new Map(FIELDS.map((f) => [f.id, f]));

function setFieldError(field, el, message) {
  const err = document.getElementById(`${field.id}-error`);
  if (err) err.textContent = message;
  if (message) el.setAttribute("aria-invalid", "true");
  else el.removeAttribute("aria-invalid");
}

function validateField(field) {
  const el = document.getElementById(field.id);
  const value = field.read(el);
  const message = field.check(value);
  setFieldError(field, el, message);
  return { value, message, el };
}

function validateForm() {
  const data = {};
  const errors = [];
  for (const field of FIELDS) {
    const { value, message, el } = validateField(field);
    if (message) errors.push({ field, message, el });
    else data[field.key] = value;
  }
  if (errors.length) return { valid: false, errors };
  data.mobileDisplay = formatMobile(normalizeMobile(data.mobile));
  return { valid: true, data };
}

function clearFormErrors() {
  FIELDS.forEach((f) => {
    const el = document.getElementById(f.id);
    if (el) setFieldError(f, el, "");
  });
  hideFormAlert();
}

function showFormAlert(html) {
  dom.formAlert.innerHTML = html;
  dom.formAlert.hidden = false;
}

function hideFormAlert() {
  dom.formAlert.hidden = true;
  dom.formAlert.innerHTML = "";
}

function showErrorSummary(errors) {
  const count = errors.length === 1 ? "1 field" : `${errors.length} fields`;
  showFormAlert(`
    <p><strong>Check ${count} before sending your order:</strong></p>
    <ul>${errors.map((e) => `<li><a href="#${e.field.id}" data-focus="${e.field.id}">${escapeHTML(e.field.label)}: ${escapeHTML(e.message)}</a></li>`).join("")}</ul>`);
  errors[0].el.focus();
}

function renderCheckoutSummary() {
  if (!dom.summaryItems) return;
  const t = getTotals();
  if (!t.lines.length) {
    dom.summaryItems.innerHTML = '<p>Your cart is empty. Add a product to place an order.</p>';
    dom.summaryTotals.innerHTML = "";
    return;
  }
  dom.summaryItems.innerHTML = `
    <ul class="summary-items">
      ${t.lines.map((l) => `
        <li class="summary-item">
          <span class="media summary-thumb" data-fallback="${escapeHTML(initials(l.product.name))}">
            <img src="${escapeHTML(l.product.image)}" alt="" width="104" height="104" loading="lazy">
          </span>
          <span>
            <span class="summary-name">${escapeHTML(l.product.name)}</span>
            <span class="summary-meta">${l.qty} × ${formatINR(l.product.price)}</span>
          </span>
          <span class="summary-line">${formatINR(l.lineTotal)}</span>
        </li>`).join("")}
    </ul>
    <button type="button" class="link-btn edit-cart" data-action="edit-cart">Edit cart</button>`;
  dom.summaryTotals.innerHTML = totalsHTML(t);
}

function updateSendButtons() {
  const dev = isDevEnvironment();
  // In production an unconfigured channel is hidden. Locally it stays visible so you can test,
  // and clicking it explains what to configure.
  dom.sendWhatsApp.hidden = !(isWhatsAppConfigured() || dev);
  dom.sendEmail.hidden = !(isEmailConfigured() || dev);
  dom.sendUnavailable.hidden = !(dom.sendWhatsApp.hidden && dom.sendEmail.hidden);
}

function showCheckoutView(view) {
  dom.formView.hidden = view !== "form";
  dom.confirmView.hidden = view !== "confirm";
  dom.doneView.hidden = view !== "done";
  dom.checkoutTitle.textContent = { form: "Checkout", confirm: "Send your order", done: "Order marked as sent" }[view];
  const panel = $(".checkout-panel");
  if (panel) panel.scrollTop = 0;
}

function openCheckout() {
  if (!cart.length) {
    showToast("Your cart is empty. Add a product to check out.");
    return;
  }
  closeDialog(dom.cartDialog);
  closeDialog(dom.productDialog);
  hideFormAlert();
  renderCheckoutSummary();
  updateSendButtons();
  showCheckoutView("form");
  openDialog(dom.checkoutDialog);
  document.getElementById("co-name").focus();
}

/* ---------------- Order reference + message ---------------- */

function generateOrderRef() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const datePart = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  const values = new Uint32Array(6);
  if (window.crypto && typeof window.crypto.getRandomValues === "function") {
    window.crypto.getRandomValues(values);
  } else {
    for (let i = 0; i < values.length; i++) values[i] = Math.floor(Math.random() * 2 ** 32);
  }
  let code = "";
  values.forEach((v) => { code += alphabet[v % alphabet.length]; });
  return `STR-${datePart}-${code}`;
}

// format: "whatsapp" (bold with *), "email" (CRLF line breaks), or "plain" (for copying)
function buildOrderText(order, format) {
  const heading = (s) => (format === "whatsapp" ? `*${s}*` : s.toUpperCase());
  const c = order.customer;
  const out = [];

  out.push(heading(`${STORE_NAME} New Order`));
  out.push(`Order reference: ${order.ref}`);
  out.push(`Created: ${dateFormatter.format(order.createdAt)}`);
  out.push("");
  out.push(heading("Customer"));
  out.push(`Name: ${c.name}`);
  out.push(`Mobile: ${c.mobileDisplay}`);
  out.push(`Email: ${c.email}`);
  out.push("");
  out.push(heading("Delivery address"));
  out.push(c.address);
  out.push(`City: ${c.city}`);
  out.push(`State: ${c.state}`);
  out.push(`PIN code: ${c.pin}`);
  out.push("");
  out.push(heading("Items"));
  order.lines.forEach((l, i) => {
    out.push(`${i + 1}. ${l.product.name}`);
    out.push(`   Qty: ${l.qty} × ${formatINR(l.product.price)} = ${formatINR(l.lineTotal)}`);
  });
  out.push("");
  out.push(`Subtotal: ${formatINR(order.subtotal)}`);
  out.push(`Delivery: ${order.delivery ? formatINR(order.delivery) : "To be confirmed by STRYDE"}`);
  out.push(format === "whatsapp" ? `*Total: ${formatINR(order.total)}*` : `Total: ${formatINR(order.total)}`);
  out.push("");
  out.push(heading("Order notes"));
  out.push(c.notes || "None");
  out.push("");
  out.push("Please confirm availability, delivery and payment details.");

  return out.join(format === "email" ? "\r\n" : "\n");
}

function buildWhatsAppURL(order) {
  return `https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(buildOrderText(order, "whatsapp"))}`;
}

function emailSubject(order) {
  return `${STORE_NAME} New Order — ${order.ref}`;
}

function buildMailtoURL(order) {
  const subject = encodeURIComponent(emailSubject(order));
  const body = encodeURIComponent(buildOrderText(order, "email"));
  return `mailto:${OWNER_EMAIL}?subject=${subject}&body=${body}`;
}

/* ---------------- Sending ---------------- */

function handlePlaceOrder(channel) {
  hideFormAlert();

  const totals = getTotals();
  if (!totals.lines.length) {
    showFormAlert("<p>Your cart is empty. Add a product before placing an order.</p>");
    return;
  }

  const configured = channel === "whatsapp" ? isWhatsAppConfigured() : isEmailConfigured();
  if (!configured) {
    const setting = channel === "whatsapp" ? "OWNER_WHATSAPP" : "OWNER_EMAIL";
    showFormAlert(`<p><strong>Ordering by ${channel === "whatsapp" ? "WhatsApp" : "email"} isn't set up yet.</strong> Store owner: set <code>${setting}</code> in script.js.</p>`);
    dom.formAlert.focus();
    return;
  }

  // Validate everything BEFORE opening WhatsApp or email.
  const result = validateForm();
  if (!result.valid) {
    showErrorSummary(result.errors);
    return;
  }

  if (!pendingOrder) pendingOrder = { ref: generateOrderRef(), createdAt: new Date() };
  const order = { ...pendingOrder, customer: result.data, ...totals };
  const link = channel === "whatsapp" ? buildWhatsAppURL(order) : buildMailtoURL(order);
  lastSend = { order, channel, link };

  renderConfirmView();
  openExternal(link, channel);
}

function openExternal(link, channel) {
  if (channel === "whatsapp") {
    const win = window.open(link, "_blank");
    if (win) {
      try { win.opener = null; } catch (_) { /* ignore */ }
    } else {
      setOpenNotice("Your browser blocked the new tab. Use “Open WhatsApp again” below.");
    }
  } else {
    const a = document.createElement("a");
    a.href = link;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

function setOpenNotice(text) {
  const el = document.getElementById("open-notice");
  if (el) {
    el.textContent = text;
    el.hidden = false;
  }
}

function recapHTML(order) {
  const c = order.customer;
  return `
    <div class="order-recap">
      <h3>Order summary</h3>
      <ul class="summary-items">
        ${order.lines.map((l) => `
          <li class="summary-item">
            <span class="media summary-thumb" data-fallback="${escapeHTML(initials(l.product.name))}">
              <img src="${escapeHTML(l.product.image)}" alt="" width="104" height="104">
            </span>
            <span>
              <span class="summary-name">${escapeHTML(l.product.name)}</span>
              <span class="summary-meta">${l.qty} × ${formatINR(l.product.price)}</span>
            </span>
            <span class="summary-line">${formatINR(l.lineTotal)}</span>
          </li>`).join("")}
      </ul>
      <dl class="totals">${totalsHTML(order)}</dl>
      <div>
        <h3>Delivering to</h3>
        <p class="recap-address">${escapeHTML(c.name)}
${escapeHTML(c.address)}
${escapeHTML(c.city)}, ${escapeHTML(c.state)} ${escapeHTML(c.pin)}
${escapeHTML(c.mobileDisplay)}, ${escapeHTML(c.email)}</p>
      </div>
    </div>`;
}

function renderConfirmView() {
  const { order, channel, link } = lastSend;
  const isWA = channel === "whatsapp";
  const ownerEmail = escapeHTML(OWNER_EMAIL);
  const longMail = !isWA && link.length > MAILTO_SAFE_LENGTH
    ? "<p>This order is long, and some email apps cut long messages short. If the email looks incomplete, delete its text and paste the copied order details instead.</p>"
    : "";

  const instructions = isWA
    ? `<p><strong>Your order has not been sent yet.</strong> We opened WhatsApp with your order message addressed to STRYDE. Check the message, then press <strong>Send</strong> in WhatsApp.</p>
       <p>If WhatsApp didn't open, use the button below, or copy the order details and send them to STRYDE on WhatsApp at ${escapeHTML(formatWhatsAppDisplay(OWNER_WHATSAPP))}.</p>`
    : `<p><strong>Your order has not been sent yet.</strong> We asked your device to open your email app with a new message to ${ownerEmail} with the subject “${escapeHTML(emailSubject(order))}”. Check it, then press <strong>Send</strong>.</p>
       <p>An email link can't send anything by itself or guarantee delivery. If no email app opened, copy the order details and email them to ${ownerEmail} yourself.</p>`;

  dom.confirmView.innerHTML = `
    <div class="confirm">
      <h2 class="confirm-title" id="confirm-title" tabindex="-1">Finish sending your order</h2>
      <div class="ref-block">
        <span class="ref-label">Order reference</span>
        <span class="ref-code">${escapeHTML(order.ref)}</span>
        <span class="ref-label">Created on this device. Quote it if you contact STRYDE.</span>
      </div>
      <div class="notice notice-warn">
        ${instructions}
        ${longMail}
        <p id="open-notice" hidden></p>
      </div>
      <div class="btn-row">
        <a class="btn btn-lime" id="reopen-link">${isWA ? "Open WhatsApp again" : "Open email again"}</a>
        <button type="button" class="btn btn-ghost" data-action="copy-order">Copy order details</button>
      </div>
      ${recapHTML(order)}
      <div class="confirm-question">
        <h3>Did you press Send?</h3>
        <p>This page can't see your WhatsApp or email, so it can't tell whether your order went through. Your cart stays saved until you confirm here.</p>
        <div class="btn-row">
          <button type="button" class="btn btn-dark" data-action="confirm-sent">Yes, I sent my order</button>
          <button type="button" class="btn btn-ghost" data-action="back-to-form">Not yet, go back</button>
        </div>
      </div>
    </div>`;

  // Set the href as a property so the URL never passes through HTML parsing.
  const reopen = document.getElementById("reopen-link");
  reopen.href = link;
  if (isWA) {
    reopen.target = "_blank";
    reopen.rel = "noopener";
  }

  showCheckoutView("confirm");
  document.getElementById("confirm-title").focus({ preventScroll: true });
}

function confirmSent() {
  if (!lastSend) return;
  const { order, channel } = lastSend;
  const firstName = order.customer.name.split(" ")[0];
  const via = channel === "whatsapp" ? "WhatsApp" : "email";

  clearCart();
  dom.checkoutForm.reset();
  clearFormErrors();
  lastSend = null;
  pendingOrder = null;

  dom.doneView.innerHTML = `
    <div class="confirm">
      <h2 class="confirm-title" id="done-title" tabindex="-1">Thanks, ${escapeHTML(firstName)}.</h2>
      <div class="ref-block">
        <span class="ref-label">Order reference</span>
        <span class="ref-code">${escapeHTML(order.ref)}</span>
      </div>
      <p>You told us you sent this order to STRYDE by ${via}, so your cart on this device has been cleared.</p>
      <div class="notice">
        <p>This confirmation is self-reported. This site can't see your ${via} and doesn't receive orders itself. STRYDE confirms stock, delivery charges and payment when they reply to your message.</p>
        <p>If you don't hear back, contact STRYDE and quote your order reference.</p>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-lime" data-action="finish">Continue shopping</button>
      </div>
    </div>`;
  showCheckoutView("done");
  document.getElementById("done-title").focus({ preventScroll: true });
}

async function copyOrderDetails() {
  if (!lastSend) return;
  const text = buildOrderText(lastSend.order, "plain");
  try {
    await navigator.clipboard.writeText(text);
    showToast("Order details copied.");
  } catch (_) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    (document.querySelector("dialog[open]") || document.body).appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
    area.remove();
    showToast(ok ? "Order details copied." : "Couldn't copy automatically. Select the order summary on screen and copy it.");
  }
}

/* ---------------- Contact section ---------------- */

function renderContact() {
  const rows = [];
  const phone = looksLikePlaceholder(CONTACT_DETAILS.phone) ? "" : CONTACT_DETAILS.phone.trim();
  const configuredEmail = looksLikePlaceholder(CONTACT_DETAILS.email) ? "" : CONTACT_DETAILS.email.trim();
  const email = configuredEmail || (isEmailConfigured() ? OWNER_EMAIL : "");
  const address = looksLikePlaceholder(CONTACT_DETAILS.address) ? "" : CONTACT_DETAILS.address.trim();
  const hours = looksLikePlaceholder(CONTACT_DETAILS.hours) ? "" : CONTACT_DETAILS.hours.trim();

  if (isWhatsAppConfigured()) {
    rows.push({ label: "WhatsApp", text: formatWhatsAppDisplay(OWNER_WHATSAPP), href: `https://wa.me/${OWNER_WHATSAPP}`, external: true });
  }
  if (phone) rows.push({ label: "Phone", text: phone, href: `tel:${phone.replace(/[^\d+]/g, "")}` });
  if (email) rows.push({ label: "Email", text: email, href: `mailto:${email}` });
  if (address) rows.push({ label: "Address", text: address });
  if (hours) rows.push({ label: "Hours", text: hours });

  dom.contactList.innerHTML = "";
  rows.forEach((row) => {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.className = "contact-label";
    label.textContent = row.label;
    const value = document.createElement("span");
    value.className = "contact-value";
    if (row.href) {
      const a = document.createElement("a");
      a.href = row.href;
      a.textContent = row.text;
      if (row.external) { a.target = "_blank"; a.rel = "noopener"; }
      value.appendChild(a);
    } else {
      value.textContent = row.text;
    }
    li.append(label, value);
    dom.contactList.appendChild(li);
  });

  dom.contactList.hidden = rows.length === 0;
  if (!rows.length) {
    dom.contactFallback.hidden = false;
    if (isDevEnvironment()) {
      dom.contactFallback.className = "dev-note";
      dom.contactFallback.textContent = "Developer note (only visible locally): add OWNER_WHATSAPP, OWNER_EMAIL or CONTACT_DETAILS in script.js to show contact details here.";
    } else {
      dom.contactFallback.textContent = "Reply to the WhatsApp chat or email thread from your order and STRYDE will help.";
    }
  } else {
    dom.contactFallback.hidden = true;
  }
}

/* ---------------- Header: menu + search ---------------- */

function setMenu(open) {
  dom.nav.classList.toggle("is-open", open);
  dom.menuToggle.setAttribute("aria-expanded", String(open));
  dom.menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}

function setSearch(open) {
  dom.searchPanel.hidden = !open;
  dom.searchToggle.setAttribute("aria-expanded", String(open));
  if (open) dom.searchInput.focus();
}

/* ---------------- Images ---------------- */

function markImageBroken(img) {
  const media = img.closest(".media");
  if (media) media.classList.add("is-broken");
}

// Errors don't bubble, but they can be caught in the capture phase.
document.addEventListener("error", (e) => {
  if (e.target instanceof HTMLImageElement) markImageBroken(e.target);
}, true);

function checkAlreadyFailedImages() {
  $$(".media img").forEach((img) => {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) markImageBroken(img);
  });
}

/* ---------------- Events ---------------- */

function bindEvents() {
  document.addEventListener("click", (e) => {
    const focusLink = e.target.closest("[data-focus]");
    if (focusLink) {
      e.preventDefault();
      const el = document.getElementById(focusLink.dataset.focus);
      if (el) el.focus();
      return;
    }

    const el = e.target.closest("[data-action]");
    if (!el) return;
    const { action, id, scope } = el.dataset;

    switch (action) {
      case "filter":
        // Anchors keep their default jump to #products; chips only filter.
        setFilter(el.dataset.filter, { clearSearch: el.tagName === "A" });
        if (el.tagName === "A") setMenu(false);
        break;
      case "details": openProductDialog(id); break;
      case "qty-dec": if (el.getAttribute("aria-disabled") !== "true") changeQty(scope, id, -1); break;
      case "qty-inc": if (el.getAttribute("aria-disabled") !== "true") changeQty(scope, id, +1); break;
      case "add": handleAdd(id); break;
      case "buy": handleBuy(id); break;
      case "remove": removeFromCart(id); break;
      case "open-cart": setMenu(false); openCart(); break;
      case "checkout": openCheckout(); break;
      case "edit-cart": closeDialog(dom.checkoutDialog); openCart(); break;
      case "browse":
        closeDialog(dom.cartDialog);
        setFilter("all", { clearSearch: true });
        scrollToSection("products");
        break;
      case "clear-search": setFilter("all", { clearSearch: true }); break;
      case "close-dialog": closeDialog(el.closest("dialog")); break;
      case "send": handlePlaceOrder(el.dataset.channel); break;
      case "copy-order": copyOrderDetails(); break;
      case "confirm-sent": confirmSent(); break;
      case "back-to-form":
        showCheckoutView("form");
        dom.sendWhatsApp.hidden ? dom.sendEmail.focus() : dom.sendWhatsApp.focus();
        break;
      case "finish":
        closeDialog(dom.checkoutDialog);
        scrollToSection("products");
        break;
      default: break;
    }
  });

  // Typed quantities
  document.addEventListener("change", (e) => {
    const input = e.target.closest ? e.target.closest(".qty-input") : null;
    if (!input) return;
    const { scope, id } = input.dataset;
    if (!productById.has(id)) return;
    const raw = Number(input.value);
    const q = clampQty(input.value);
    if (raw > MAX_QTY_PER_ITEM) showToast(`The limit is ${MAX_QTY_PER_ITEM} per product.`);
    if (scope === "cart") setCartQty(id, q);
    else {
      selectorQty.set(id, q);
      syncSelectorQty(id);
    }
  });

  // Checkout: validate on blur once a field has content, re-check while fixing an error
  dom.checkoutForm.addEventListener("focusout", (e) => {
    const field = fieldById.get(e.target.id);
    if (!field || field.key === "confirm") return;
    const el = e.target;
    if (el.value.trim() || el.hasAttribute("aria-invalid")) validateField(field);
  });
  dom.checkoutForm.addEventListener("input", (e) => {
    const field = fieldById.get(e.target.id);
    if (field && e.target.hasAttribute("aria-invalid")) validateField(field);
  });
  dom.checkoutForm.addEventListener("change", (e) => {
    const field = fieldById.get(e.target.id);
    if (field && (field.key === "confirm" || field.key === "state")) validateField(field);
  });
  // Enter in a field: validate, but never send without an explicit channel choice
  dom.checkoutForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const result = validateForm();
    if (!result.valid) showErrorSummary(result.errors);
    else (dom.sendWhatsApp.hidden ? dom.sendEmail : dom.sendWhatsApp).focus();
  });

  dom.checkoutDialog.addEventListener("close", () => {
    if (!dom.confirmView.hidden && lastSend) {
      showToast(`Your cart is still saved. Order ${lastSend.order.ref} isn't marked as sent.`);
    }
    if (!dom.doneView.hidden) showCheckoutView("form");
  });

  // Menu
  dom.menuToggle.addEventListener("click", () => setMenu(!dom.nav.classList.contains("is-open")));
  dom.nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("click", (e) => {
    if (dom.nav.classList.contains("is-open") && !e.target.closest(".site-header")) setMenu(false);
  });
  window.matchMedia("(min-width: 960px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

  // Search
  dom.searchToggle.addEventListener("click", () => setSearch(dom.searchPanel.hidden));
  dom.searchInput.addEventListener("input", () => {
    searchQuery = dom.searchInput.value.trim();
    renderProducts();
  });
  dom.searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    searchQuery = dom.searchInput.value.trim();
    if (searchQuery) activeFilter = "all";
    renderProducts();
    setMenu(false);
    scrollToSection("products");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
    if (dom.nav.classList.contains("is-open")) {
      setMenu(false);
      dom.menuToggle.focus();
    } else if (!dom.searchPanel.hidden) {
      setSearch(false);
      dom.searchToggle.focus();
    }
  });

  // Keep the cart in sync across tabs
  window.addEventListener("storage", (e) => {
    if (e.key !== CART_STORAGE_KEY) return;
    cart = loadCart();
    pendingOrder = null;
    renderCart();
    updateCartCount();
    renderCheckoutSummary();
    if (dom.checkoutDialog.open && !dom.confirmView.hidden) {
      lastSend = null;
      showCheckoutView("form");
      showFormAlert("<p>Your cart changed in another tab. Check the order summary, then place your order again.</p>");
    }
  });
}

/* ---------------- Init ---------------- */

function cacheDom() {
  Object.assign(dom, {
    grid: $("#product-grid"),
    noResults: $("#no-results"),
    noResultsTerm: $("#no-results-term"),
    productStatus: $("#product-status"),
    priceNote: $("#price-note"),
    cartCount: $("#cart-count"),
    cartButton: $("#cart-button"),
    cartDialog: $("#cart-dialog"),
    cartBody: $("#cart-body"),
    cartFoot: $("#cart-foot"),
    cartHeadCount: $("#cart-head-count"),
    cartTitle: $("#cart-title"),
    productDialog: $("#product-dialog"),
    productDialogBody: $("#product-dialog-body"),
    checkoutDialog: $("#checkout-dialog"),
    checkoutTitle: $("#checkout-title"),
    checkoutForm: $("#checkout-form"),
    formView: $("#checkout-form-view"),
    confirmView: $("#checkout-confirm-view"),
    doneView: $("#checkout-done-view"),
    formAlert: $("#form-alert"),
    summaryItems: $("#checkout-summary-items"),
    summaryTotals: $("#checkout-totals"),
    sendWhatsApp: $("#send-whatsapp"),
    sendEmail: $("#send-email"),
    sendUnavailable: $("#send-unavailable"),
    menuToggle: $("#menu-toggle"),
    nav: $("#primary-nav"),
    searchToggle: $("#search-toggle"),
    searchPanel: $("#search-panel"),
    searchForm: $("#search-form"),
    searchInput: $("#search-input"),
    toastRegion: $("#toast-region"),
    contactList: $("#contact-list"),
    contactFallback: $("#contact-fallback"),
    stateSelect: $("#co-state"),
    year: $("#year")
  });
}

function warnAboutConfig() {
  const issues = [];
  if (!isWhatsAppConfigured()) issues.push("OWNER_WHATSAPP");
  if (!isEmailConfigured()) issues.push("OWNER_EMAIL");
  if (PRICES_ARE_SAMPLES) issues.push("PRODUCTS prices (then set PRICES_ARE_SAMPLES = false)");
  if (issues.length) console.warn(`STRYDE setup: configure ${issues.join(", ")} in script.js before going live.`);
}

function init() {
  try {
    cacheDom();

    INDIAN_STATES.forEach((state) => dom.stateSelect.add(new Option(state, state)));

    cart = loadCart();
    saveCart(); // writes back the sanitised cart
    dom.priceNote.hidden = !PRICES_ARE_SAMPLES;
    dom.year.textContent = String(new Date().getFullYear());

    renderProducts(false);
    renderCart();
    updateCartCount();
    renderCheckoutSummary();
    renderContact();
    updateSendButtons();

    [dom.cartDialog, dom.productDialog, dom.checkoutDialog].forEach(setupDialog);
    bindEvents();
    checkAlreadyFailedImages();
    warnAboutConfig();
  } catch (err) {
    console.error("STRYDE failed to start.", err);
    const grid = document.getElementById("product-grid");
    if (grid) grid.innerHTML = '<p class="no-results">Something went wrong loading the store. Please refresh the page.</p>';
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
