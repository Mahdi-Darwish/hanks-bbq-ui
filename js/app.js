/* Customer facing shop */
const state = {
  user: null,
  categories: [],
  products: [],
  activeCategory: "all",
  search: "",
  cart: { items: [], total: 0, item_count: 0 },
  pendingAction: null,   // something to finish after the customer logs in
  opts: {},              // choices (like spicy) per cart item, kept on this device: { productId: [{ qty, text }] }
  sheet: null,           // the item page that is open
  authMode: "login",
  ordersTimer: null,
};

/* ---------- helpers ---------- */
function openModal(id) { $("#overlay").classList.add("open"); $(id).classList.add("open"); }
function closeAll() {
  $("#overlay").classList.remove("open");
  $$(".modal.open, .drawer.open").forEach((m) => m.classList.remove("open"));
  clearInterval(state.ordersTimer);
}
function qtyInCart(productId) {
  const line = state.cart.items.find((i) => i.product_id === productId);
  return line ? line.quantity : 0;
}
// A real photo when one was uploaded, otherwise a quiet neutral placeholder.
const thumb = (url, name) =>
  url ? `<img src="${esc(imgSrc(url))}" alt="${esc(name)}" loading="lazy">` : PLACEHOLDER_ICON;
const isOfferCategory = (c) => /offer|deal/i.test(c.name);

/* ---------- menu ---------- */
async function loadMenu() {
  $("#menu").innerHTML = `<div class="grid solo">${'<div class="skel"></div>'.repeat(6)}</div>`;
  try {
    const [cats, prods] = await Promise.all([api("/categories", { auth: false }), api("/products", { auth: false })]);
    state.categories = cats;
    state.products = prods;
  } catch (e) {
    $("#menu").innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    return;
  }
  const offers = state.categories.find(isOfferCategory);
  $("#offersBtn").classList.toggle("hidden", !(offers && state.products.some((p) => p.category_id === offers.id)));
  renderCategories();
  renderMenu();
}

function renderCategories() {
  const counts = {};
  state.products.forEach((p) => { counts[p.category_id] = (counts[p.category_id] || 0) + 1; });
  const used = state.categories.filter((c) => counts[c.id]);

  // text chips (sticky bar)
  $("#cats").innerHTML = [`<button class="chip ${state.activeCategory === "all" ? "active" : ""}" data-cat="all">All</button>`]
    .concat(used.map((c) => `<button class="chip ${state.activeCategory === c.id ? "active" : ""}" data-cat="${esc(c.id)}">${esc(c.name)}</button>`))
    .join("");

  // photo tiles (your own category photos)
  $("#browse").classList.toggle("hidden", used.length === 0);
  $("#tiles").innerHTML = used.map((c) => {
    const n = counts[c.id];
    const has = !!c.image_url;
    return `<button class="tile ${has ? "has-img" : "no-img"} ${state.activeCategory === c.id ? "active" : ""}" data-cat="${esc(c.id)}" aria-label="${esc(c.name)}, ${n} ${n === 1 ? "item" : "items"}">
      ${has ? `<img src="${esc(imgSrc(c.image_url))}" alt="" loading="lazy">` : `<span class="tile-ph" aria-hidden="true"></span>`}
      <span class="go" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
      <span class="label"><b>${esc(c.name)}</b><small>${n} ${n === 1 ? "item" : "items"}</small></span></button>`;
  }).join("");
}

function productCard(p, instant = false) {
  const q = qtyInCart(p.id);
  const action = q
    ? `<div class="stepper"><button data-dec="${esc(p.id)}" aria-label="Remove one">&minus;</button><span>${q}</span><button data-inc="${esc(p.id)}" aria-label="Add one">+</button></div>`
    : `<button class="btn sm" data-add="${esc(p.id)}">Add</button>`;
  let tag = "", old = "";
  if (p.old_price && p.old_price > p.price) {
    const off = Math.round((1 - p.price / p.old_price) * 100);
    tag = `<span class="tag">Save ${off}%</span>`;
    old = `<s>${money(p.old_price)}</s>`;
  }
  return `<article class="card reveal${instant ? " in" : ""}" data-open="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(p.name)}, choose options">
    <div class="pic">${thumb(p.image_url, p.name)}${tag}</div>
    <div class="body"><h3>${esc(p.name)}</h3><p>${esc(p.description || "")}</p>
      <div class="foot"><span class="price">${money(p.price)}${old}</span>${action}</div></div>
  </article>`;
}

let lastMenuKey = "";
function renderMenu() {
  // Cart changes re-render the cards; only animate them when the visible set really changes.
  const key = state.activeCategory + "|" + state.products.length;
  const instant = key === lastMenuKey;
  lastMenuKey = key;

  const term = state.search.trim().toLowerCase();
  let list = state.products;
  if (term) list = list.filter((p) => p.name.toLowerCase().includes(term) || (p.description || "").toLowerCase().includes(term));
  if (state.activeCategory !== "all") list = list.filter((p) => p.category_id === state.activeCategory);

  if (!list.length) {
    $("#menu").innerHTML = `<div class="empty">${state.products.length ? "Nothing matches your search." : "The menu is empty right now. Please check back soon."}</div>`;
    return;
  }
  if (state.activeCategory === "all" && !term) {
    let html = "";
    const title = (name, count) => `<h2 class="section-title">${esc(name)}<span class="cnt">${count} item${count > 1 ? "s" : ""}</span></h2>`;
    for (const c of state.categories) {
      const items = list.filter((p) => p.category_id === c.id);
      if (items.length) html += `${title(c.name, items.length)}<div class="grid">${items.map((p) => productCard(p, instant)).join("")}</div>`;
    }
    const orphans = list.filter((p) => !p.category_id);
    if (orphans.length) html += `${title("More", orphans.length)}<div class="grid">${orphans.map((p) => productCard(p, instant)).join("")}</div>`;
    $("#menu").innerHTML = html;
  } else {
    $("#menu").innerHTML = `<div class="grid solo">${list.map((p) => productCard(p, instant)).join("")}</div>`;
  }
}

/* ---------- cart ---------- */
async function loadCart() {
  if (!Auth.token) { state.cart = { items: [], total: 0, item_count: 0 }; renderCart(); return; }
  try { state.cart = await api("/cart"); } catch { /* session expiry is handled elsewhere */ }
  renderCart();
}

/* ---------- choices per cart item (spicy, no onions...) ----------
   The server cart only knows items and quantities, so the choices live here, per item,
   and travel to the kitchen inside the order notes. */
const REDUCE = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
function optsKey() { return "opts:" + (state.user ? (state.user.phone_number || state.user.id) : "guest"); }
function loadOpts() { try { return JSON.parse(localStorage.getItem(optsKey())) || {}; } catch { return {}; } }
function saveOpts() { try { localStorage.setItem(optsKey(), JSON.stringify(state.opts)); } catch { /* private mode */ } }
function reconcileOpts() {          // keep our notes in step with what the server cart really holds
  const inCart = new Map(state.cart.items.map((i) => [i.product_id, i.quantity]));
  for (const id of Object.keys(state.opts)) if (!inCart.has(id)) delete state.opts[id];
  for (const [id, q] of inCart) {
    const list = state.opts[id] || (state.opts[id] = []);
    let sum = list.reduce((a, e) => a + e.qty, 0);
    if (sum < q) { if (list.length) list[list.length - 1].qty += q - sum; else list.push({ qty: q, text: "" }); }
    while (sum > q && list.length) {
      const last = list[list.length - 1], cut = Math.min(last.qty, sum - q);
      last.qty -= cut; sum -= cut; if (!last.qty) list.pop();
    }
  }
  saveOpts();
}
function noteAdd(id, qty, note) {   // note === null: a + button, goes on the latest entry
  const list = state.opts[id] || (state.opts[id] = []);
  if (note === null) { if (list.length) list[list.length - 1].qty += qty; else list.push({ qty, text: "" }); }
  else { const same = list.find((e) => e.text === note); if (same) same.qty += qty; else list.push({ qty, text: note }); }
}
function noteRemove(id) {
  const list = state.opts[id]; if (!list || !list.length) return;
  list[list.length - 1].qty -= 1; if (list[list.length - 1].qty <= 0) list.pop();
}
function lineChoices(id) {          // what to show under the item name in the cart
  const list = state.opts[id] || [];
  const withText = list.filter((e) => e.text);
  if (!withText.length) return "";
  return list.length > 1 ? withText.map((e) => `${e.qty} x ${e.text}`).join("\n") : withText[0].text;   // one line per different choice
}
function orderNotes() {             // the kitchen reads this on the order
  const lines = [];
  for (const i of state.cart.items) {
    const list = (state.opts[i.product_id] || []).filter((e) => e.text);
    if (!list.length) continue;
    lines.push(`${i.product_name}: ` + (list.length > 1 || list[0].qty !== i.quantity || i.quantity > 1 ? list.map((e) => `${e.qty} x ${e.text}`).join(" / ") : list[0].text));
  }
  const own = $("#cNotes").value.trim();
  /* the customer's own note always comes last after the marker "Notes: ", the admin panel splits on it */
  return [lines.join(". "), own ? "Notes: " + own : ""].filter(Boolean).join(". ");
}

function renderCart() {
  reconcileOpts();
  const n = state.cart.item_count || 0;
  const badge = $("#cartCount");
  const grew = n > Number(badge.textContent || 0);
  badge.textContent = n;
  if (grew && !REDUCE) { badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump"); }
  $("#cartTotal").textContent = money(state.cart.total);
  const list = $("#cartList");
  if (!state.cart.items.length) {
    list.innerHTML = `<div class="empty">Your cart is empty.<br>Add something from the menu.</div>`;
    $("#cartFoot").classList.add("hidden");
  } else {
    $("#cartFoot").classList.remove("hidden");
    list.innerHTML = state.cart.items.map((i) => `
      <div class="line">
        <div class="thumb">${thumb(i.image_url, i.product_name)}</div>
        <div class="info"><b>${esc(i.product_name)}</b>${lineChoices(i.product_id) ? `<small class="choice">${esc(lineChoices(i.product_id))}</small>` : ""}<small>${money(i.unit_price)} each</small></div>
        <div class="stepper"><button data-dec="${esc(i.product_id)}" aria-label="Remove one">&minus;</button><span>${i.quantity}</span><button data-inc="${esc(i.product_id)}" aria-label="Add one">+</button></div>
        <b>${money(i.sub_total)}</b>
      </div>`).join("");
  }
  renderMenu(); // refresh the +/- steppers on the cards
}

async function addToCart(productId, quantity = 1, note = null) {
  if (!Auth.token) { state.pendingAction = () => addToCart(productId, quantity, note); showAuth("login", "Sign in to start your order."); return false; }
  try {
    state.cart = await api("/cart/items", { method: "POST", body: { product_id: productId, quantity } });
    noteAdd(productId, quantity, note);
    renderCart();
    return true;
  } catch (e) { toast(e.message, "error"); return false; }
}
async function removeOne(productId) {
  try { state.cart = await api(`/cart/items/${productId}?quantity=1`, { method: "DELETE" }); noteRemove(productId); renderCart(); }
  catch (e) { toast(e.message, "error"); }
}

/* ---------- item page: photo, choices, add to cart ---------- */
function categoryName(p) { const c = state.categories.find((x) => x.id === p.category_id); return c ? c.name : ""; }
function findItem(name) {           // an extra named in js/options.js, looked up on your real menu
  const n = name.trim().toLowerCase();
  return state.products.find((p) => p.name.trim().toLowerCase() === n) || state.products.find((p) => p.name.toLowerCase().includes(n));
}
function groupsFor(p) {
  const cat = categoryName(p);
  const rule = PRODUCT_OPTIONS.find((r) => (r.match.product || r.match.category) && (!r.match.product || r.match.product.test(p.name)) && (!r.match.category || r.match.category.test(cat)));
  if (!rule) return [];
  return rule.groups.map((g) => ({
    ...g,
    choices: g.choices.map((c) => {
      if (!c.item) return { label: c.label, product: null, price: 0 };
      const it = findItem(c.item);
      return it && it.id !== p.id ? { label: c.label || it.name, product: it, price: it.price } : null;
    }).filter(Boolean),
  })).filter((g) => g.choices.length);
}

function sheetPicks() {             // read what is ticked: [Set of choice numbers per group]
  return sheetGroups().map((g, i) => new Set($$(`#sheetGroups input[name="g${i}"]:checked`).map((el) => Number(el.value))));
}
function sheetGroups() { return state.sheet ? state.sheet.groups : []; }
function sheetUnit() {
  const sh = state.sheet; const picks = sheetPicks();
  let unit = sh.product.price;
  sh.groups.forEach((g, i) => picks[i].forEach((j) => { unit += g.choices[j].price; }));
  return unit;
}
function updateSheetTotal() {
  const sh = state.sheet; if (!sh) return;
  $("#sheetQty").textContent = sh.qty;
  $("#sheetAmt").textContent = money(sheetUnit() * sh.qty);
  $("#sheetMinus").disabled = sh.qty <= 1;
}

function openSheet(id) {
  const p = state.products.find((x) => x.id === id);
  if (!p) return;
  const groups = groupsFor(p);
  state.sheet = { product: p, groups, qty: 1 };
  $("#sheetMedia").innerHTML = p.image_url ? `<img src="${esc(imgSrc(p.image_url))}" alt="${esc(p.name)}">` : `<div class="ph big">${thumb(null, p.name)}</div>`;
  $("#sheetCat").textContent = categoryName(p);
  $("#sheetTitle").textContent = p.name;
  $("#sheetDesc").textContent = p.description || "";
  $("#sheetPrice").innerHTML = `${money(p.price)}${p.old_price && p.old_price > p.price ? `<s>${money(p.old_price)}</s>` : ""}`;
  $("#sheetGroups").innerHTML = groups.map((g, i) => {
    const single = g.type === "single";
    const kind = single && g.required ? "radio" : "checkbox";
    const hint = g.required ? "Required" : single ? "Optional" : "Choose any";
    return `<fieldset class="grp" style="--g:${i}"><legend>${esc(g.label)}<em>${hint}</em></legend><div class="opts">` +
      g.choices.map((c, j) => `<label class="opt${c.product ? " extra" : ""}"><input type="${kind}" name="g${i}" value="${j}" ${single && g.required && j === 0 ? "checked" : ""}><span class="t">${esc(c.label)}</span>${c.product ? `<span class="pr">+${money(c.price)}</span>` : ""}</label>`).join("") +
      `</div></fieldset>`;
  }).join("");
  $("#sheetAdd").disabled = false;
  updateSheetTotal();
  $("#sheetMedia").scrollTop = 0; $(".sheet-scroll").scrollTop = 0;
  openModal("#productSheet");
  setTimeout(() => $("#productSheet").focus({ preventScroll: true }), 50);
}

async function performAdd(snap) {
  if (!(await addToCart(snap.product.id, snap.qty, snap.note))) return false;
  for (const x of snap.extras) if (!(await addToCart(x.id, snap.qty, ""))) return false;
  return true;
}
function flyToCart() {              // the photo shrinks into the cart button
  if (REDUCE) return;
  const src = $("#sheetMedia img"), dest = $("#cartBtn");
  if (!src || !dest) return;
  const a = src.getBoundingClientRect(), b = dest.getBoundingClientRect();
  if (!a.width) return;
  const c = src.cloneNode();
  Object.assign(c.style, { position: "fixed", left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px", zIndex: 120, objectFit: "cover", borderRadius: "16px", pointerEvents: "none", transition: "transform .8s cubic-bezier(.55,0,.25,1), opacity .8s ease, border-radius .8s" });
  document.body.appendChild(c);
  requestAnimationFrame(() => {
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    c.style.transform = `translate(${dx}px, ${dy}px) scale(.06)`; c.style.opacity = ".35"; c.style.borderRadius = "50%";
  });
  setTimeout(() => c.remove(), 900);
}
async function submitSheet() {
  const sh = state.sheet; if (!sh) return;
  const picks = sheetPicks();
  const labels = [], extras = [];
  sh.groups.forEach((g, i) => picks[i].forEach((j) => { const c = g.choices[j]; if (c.product) extras.push(c.product); else labels.push(c.label); }));
  const snap = { product: sh.product, qty: sh.qty, note: labels.join(", "), extras };
  if (!Auth.token) {
    state.pendingAction = () => performAdd(snap);
    $("#productSheet").classList.remove("open");
    showAuth("login", "Sign in to start your order.");
    return;
  }
  $("#sheetAdd").disabled = true;
  flyToCart();
  const ok = await performAdd(snap);
  $("#sheetAdd").disabled = false;
  if (ok) { closeAll(); toast(`${snap.qty} x ${snap.product.name} added`); }
}

/* ---------- auth ---------- */
async function loadUser() {
  state.user = null;
  if (Auth.token) { try { state.user = await api("/me"); } catch { Auth.logout(); } }
  const loggedIn = !!state.user;
  state.opts = loggedIn ? loadOpts() : {};
  const authIcon = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5"/><path d="M5 21v-1.5a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5V21"/></svg>';
  $("#authBtn").innerHTML = authIcon + (loggedIn ? `Sign out<span class="uname"> (${esc(displayName(state.user).split(" ")[0])})</span>` : "Sign in");
  $("#ordersBtn").classList.toggle("hidden", !loggedIn);
  $("#adminLink").classList.toggle("hidden", !(loggedIn && state.user.role === "admin"));
}

const displayName = (u) => (u && (u.full_name || u.phone_number)) || "";
const AUTH_TEXT = {
  login: ["Welcome back", "Sign in to order and track your food.", "Sign in"],
  signup: ["Create your account", "It takes a minute and saves your orders.", "Create account"],
};
function showAuth(mode = "login", note = "") {
  setAuthMode(mode);
  if (note && mode === "login") $("#authSub").textContent = note;
  openModal("#authModal");
  setTimeout(() => $(mode === "signup" ? "#fName" : "#fPhone").focus(), 60);
}
function setAuthMode(mode) {
  state.authMode = mode;
  const [title, sub, btn] = AUTH_TEXT[mode];
  $("#authTitle").textContent = title;
  $("#authSub").textContent = sub;
  $("#authSubmit").textContent = btn;
  $("#tabLogin").classList.toggle("on", mode === "login");
  $("#tabSignup").classList.toggle("on", mode === "signup");
  $$("#authModal [data-only]").forEach((el) => el.classList.toggle("hidden", !el.dataset.only.split(" ").includes(mode)));
  $("#fPass").autocomplete = mode === "signup" ? "new-password" : "current-password";
  $("#fPass").placeholder = mode === "signup" ? "Create a password" : "Enter your password";
  $("#authErr").textContent = "";
  $("#authOk").classList.add("hidden");
  $$("#authForm input").forEach((i) => i.classList.remove("bad"));
}
function authError(msg, field) {
  $("#authErr").textContent = msg;
  if (field) { $(field).classList.add("bad"); $(field).focus(); }
  return false;
}
async function submitAuth(ev) {
  ev.preventDefault();
  const mode = state.authMode;
  $("#authErr").textContent = ""; $("#authOk").classList.add("hidden");
  $$("#authForm input").forEach((i) => i.classList.remove("bad"));
  const name = $("#fName").value.trim(), phone = $("#fPhone").value.replace(/[\s\-().]/g, ""), pass = $("#fPass").value;
  if (mode === "signup" && name.length < 2) return authError("Please enter your full name.", "#fName");
  if (!/^\+?[0-9]{7,15}$/.test(phone)) return authError("Please enter a valid phone number (digits only, you can start with +).", "#fPhone");
  if (!pass) return authError("Please enter your password.", "#fPass");
  if (mode === "signup" && !(pass.length >= 8 && /[A-Za-z]/.test(pass) && /\d/.test(pass))) return authError("Use at least 8 characters, with letters and numbers.", "#fPass");
  $("#authSubmit").disabled = true;
  try {
    const body = mode === "signup" ? { full_name: name, phone_number: phone, password: pass } : { phone_number: phone, password: pass };
    const res = await api(mode === "signup" ? "/signup" : "/login", { method: "POST", body, auth: false });
    Auth.token = res.access_token;
    await loadUser();
    if (state.user && state.user.role === "admin") { location.href = "admin.html"; return; } // admins go to the dashboard
    closeAll();
    $("#authForm").reset();
    toast(mode === "signup" ? "Account created. Welcome to Hank’s!" : "Welcome back!");
    await loadCart();
    if (state.pendingAction) { const run = state.pendingAction; state.pendingAction = null; await run(); }
  } catch (e) { $("#authErr").textContent = e.message; }
  finally { $("#authSubmit").disabled = false; }
}

function logout() {
  Auth.logout(); state.user = null;
  loadUser(); loadCart(); closeAll();
  toast("Logged out");
}

/* ---------- checkout: three steps. 1 delivery or pickup, 2 notes for the kitchen, 3 review and confirm ---------- */
const CO = { step: 1, mode: "delivery" };
function setStep(n) {
  CO.step = n;
  $$("#checkoutModal .co-step").forEach((el) => {
    const on = Number(el.dataset.step) === n;
    el.classList.toggle("hidden", !on);
    if (on) { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; }
  });
  $$("#coSteps li").forEach((li, i) => { li.classList.toggle("on", i + 1 === n); li.classList.toggle("done", i + 1 < n); });
  $("#coBack").classList.toggle("hidden", n === 1);
  $("#coNext").classList.toggle("hidden", n === 3);
  $("#placeOrderBtn").classList.toggle("hidden", n !== 3);
  $("#coNext").textContent = n === 2 ? ($("#cNotes").value.trim() ? "Review order" : "Skip notes") : "Continue";
  $("#checkoutErr").textContent = "";
  if (n === 3) renderReview();
}
function setMode(mode) {
  CO.mode = mode;
  $$("#coMode button").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  $("#addrWrap").classList.toggle("hidden", mode === "pickup");
  $("#pickupHint").classList.toggle("hidden", mode !== "pickup");
}
function syncNoteUI() {
  const v = $("#cNotes").value;
  $("#noteCount").textContent = v.length;
  $$("#noteChips button").forEach((b) => b.classList.toggle("on", v.toLowerCase().includes(b.dataset.note.toLowerCase())));
  if (CO.step === 2) $("#coNext").textContent = v.trim() ? "Review order" : "Skip notes";
}
function toggleNote(text) {
  const box = $("#cNotes");
  const parts = box.value.split(/,\s*/).map((x) => x.trim()).filter(Boolean);
  const at = parts.findIndex((x) => x.toLowerCase() === text.toLowerCase());
  if (at >= 0) parts.splice(at, 1); else parts.push(text);
  box.value = parts.join(", ").slice(0, 300);
  syncNoteUI();
}
function renderReview() {
  const own = $("#cNotes").value.trim();
  const addr = CO.mode === "pickup" ? "" : $("#cAddress").value.trim();
  $("#checkoutSummary").innerHTML =
    state.cart.items.map((i) => `<div class="line"><div class="info"><b>${i.quantity} x ${esc(i.product_name)}</b>${lineChoices(i.product_id) ? `<small class="choice">${esc(lineChoices(i.product_id))}</small>` : ""}</div><b>${money(i.sub_total)}</b></div>`).join("") +
    `<div class="total-row" style="margin-top:14px"><span>Total</span><span>${money(state.cart.total)}</span></div>` +
    `<div class="review-box"><h4>${addr ? "Deliver to" : "Pickup"}</h4><p>${addr ? esc(addr) : "We will have it ready for you at the counter."}</p></div>` +
    `<div class="review-box note"><h4>Your notes</h4><p>${own ? esc(own) : "No notes"}</p></div>`;
}
function openCheckout() {
  if (!state.cart.items.length) return;
  $("#cNotes").value = "";
  setMode(CO.mode);
  syncNoteUI();
  setStep(1);
  $("#drawer").classList.remove("open");
  openModal("#checkoutModal");
}
function nextStep() {
  if (CO.step === 1 && CO.mode === "delivery" && !$("#cAddress").value.trim()) { $("#checkoutErr").textContent = "Please enter your delivery address, or switch to pickup."; return; }
  setStep(CO.step + 1);
}
async function placeOrder() {
  const btn = $("#placeOrderBtn");
  const notes = orderNotes();
  if (notes.length > 500) { $("#checkoutErr").textContent = "Your choices and notes are too long. Please go back and shorten the notes."; return; }
  btn.disabled = true;
  try {
    await api("/cart/checkout", { method: "POST", body: { delivery_address: CO.mode === "pickup" ? "" : $("#cAddress").value.trim(), notes } });
    $("#cNotes").value = "";
    state.opts = {}; saveOpts();
    await loadCart();
    closeAll();
    toast("Order placed. The pit is on it.");
    showOrders();
  } catch (e) { $("#checkoutErr").textContent = e.message; }
  finally { btn.disabled = false; }
}

/* ---------- my orders ---------- */
async function showOrders() {
  openModal("#ordersModal");
  await refreshOrders();
  clearInterval(state.ordersTimer);
  state.ordersTimer = setInterval(refreshOrders, 10000); // live status updates
}
const TRACK = ["pending", "preparing", "ready", "out_for_delivery", "delivered"];
const TRACK_LABELS = ["Received", "Cooking", "Ready", "On the way", "Delivered"];
function tracker(status) {
  if (status === "cancelled") return "";
  const at = TRACK.indexOf(status);
  const parts = TRACK.map((_, i) =>
    `<i class="${i <= at ? "done" : ""} ${i === at && at < TRACK.length - 1 ? "now" : ""}"></i>${i < TRACK.length - 1 ? `<u class="${i < at ? "done" : ""}"></u>` : ""}`).join("");
  return `<div class="progress">${parts}</div><div class="progress-labels">${TRACK_LABELS.map((l) => `<span>${l}</span>`).join("")}</div>`;
}
async function refreshOrders() {
  const box = $("#ordersList");
  try {
    const orders = await api("/orders");
    if (!orders.length) { box.innerHTML = `<div class="empty">No orders yet.</div>`; return; }
    box.innerHTML = orders.map((o) => `
      <div class="order">
        <div class="top"><b>Order #${shortId(o.order_id)}</b><span class="pill ${esc(o.status)}">${esc(STATUS_LABELS[o.status] || o.status)}</span></div>
        <div class="hint">${o.created_at ? new Date(o.created_at).toLocaleString() : ""}</div>
        ${tracker(o.status)}
        <ul>${o.items.map((i) => `<li>${i.quantity} x ${esc(i.product_name)}, ${money(i.price_at_purchase * i.quantity)}</li>`).join("")}</ul>
        ${o.delivery_address ? `<div class="hint">Deliver to: ${esc(o.delivery_address)}</div>` : `<div class="hint">Pickup</div>`}
        ${o.notes ? `<div class="kn">${esc(o.notes)}</div>` : ""}
        <div class="top" style="margin-top:10px"><b>${money(o.total)}</b>
          ${o.status === "pending" ? `<button class="btn ghost sm" data-cancel="${esc(o.order_id)}">Cancel order</button>` : ""}</div>
      </div>`).join("");
  } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
async function cancelOrder(id) {
  if (!confirm("Cancel this order?")) return;
  try { await api(`/orders/${id}/cancel`, { method: "POST" }); toast("Order cancelled"); refreshOrders(); }
  catch (e) { toast(e.message, "error"); }
}

/* ---------- wiring ---------- */
function setSearch(v) { state.search = v; $("#search").value = v; $("#searchMobile").value = v; renderMenu(); }
function scrollToMenu() { window.scrollTo({ top: $("#menu").getBoundingClientRect().top + window.scrollY - 150, behavior: "smooth" }); }

document.addEventListener("click", (ev) => {
  const t = ev.target.closest("button, a, .overlay");
  if (!t) {
    const card = ev.target.closest("[data-open]");
    if (card) openSheet(card.dataset.open);
    return;
  }
  if (t.matches("[data-add]")) {
    const p = state.products.find((x) => x.id === t.dataset.add);
    if (p && groupsFor(p).length) openSheet(p.id); else addToCart(t.dataset.add);
  }
  else if (t.matches("[data-inc]")) addToCart(t.dataset.inc);
  else if (t.matches("[data-dec]")) removeOne(t.dataset.dec);
  else if (t.matches("[data-cancel]")) cancelOrder(t.dataset.cancel);
  else if (t.matches("[data-scroll-menu]")) $("#browse").scrollIntoView({ behavior: "smooth" });
  else if (t.matches("[data-go-offers]")) {
    const offers = state.categories.find(isOfferCategory);
    state.activeCategory = offers ? offers.id : "all";
    renderCategories(); renderMenu(); scrollToMenu();
  }
  else if (t.matches("[data-close]") || t.matches(".overlay")) closeAll();
  else if (t.matches("[data-cat]")) {
    state.activeCategory = t.dataset.cat;
    renderCategories(); renderMenu(); scrollToMenu();
  } else if (t.matches("[data-auth]")) setAuthMode(t.dataset.auth);
  else if (t.matches("[data-eye]")) {
    const f = $("#fPass"), show = f.type === "password";
    f.type = show ? "text" : "password"; t.innerHTML = show ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.1 10.1 0 0 1 12 19c-6.4 0-10-7-10-7a18.5 18.5 0 0 1 5.1-5.9M9.9 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a18.6 18.6 0 0 1-2.2 3.2"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="M2 2l20 20"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'; t.setAttribute("aria-label", show ? "Hide password" : "Show password");
  }
});

$("#cartBtn").onclick = () => { $("#overlay").classList.add("open"); $("#drawer").classList.add("open"); };
$("#authBtn").onclick = () => (state.user ? logout() : showAuth());
$("#ordersBtn").onclick = showOrders;
$("#checkoutBtn").onclick = () => { if (!Auth.token) return showAuth("login", "Sign in to check out."); openCheckout(); };
$("#clearCartBtn").onclick = async () => { try { state.cart = await api("/cart", { method: "DELETE" }); state.opts = {}; renderCart(); } catch (e) { toast(e.message, "error"); } };
$("#placeOrderBtn").onclick = placeOrder;
$("#coNext").onclick = nextStep;
$("#coBack").onclick = () => setStep(Math.max(1, CO.step - 1));
$("#coMode").addEventListener("click", (e) => { const b = e.target.closest("button[data-mode]"); if (b) setMode(b.dataset.mode); });
$("#noteChips").addEventListener("click", (e) => { const b = e.target.closest("button[data-note]"); if (b) toggleNote(b.dataset.note); });
$("#cNotes").addEventListener("input", syncNoteUI);
$("#sheetAdd").onclick = submitSheet;
$("#sheetMinus").onclick = () => { if (state.sheet && state.sheet.qty > 1) { state.sheet.qty--; updateSheetTotal(); } };
$("#sheetPlus").onclick = () => { if (state.sheet && state.sheet.qty < 20) { state.sheet.qty++; updateSheetTotal(); } };
$("#sheetGroups").addEventListener("change", (e) => {
  const input = e.target; if (!input.matches("input")) return;
  const m = /^g(\d+)$/.exec(input.name); if (!m) return;
  const g = state.sheet.groups[Number(m[1])];
  if (g.type === "single" && input.checked) $$(`#sheetGroups input[name="${input.name}"]`).forEach((o) => { if (o !== input) o.checked = false; });
  updateSheetTotal();
});
document.addEventListener("keydown", (e) => {   // Enter or Space on a focused card opens it
  if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-open]")) { e.preventDefault(); openSheet(e.target.dataset.open); }
});
$("#authForm").addEventListener("submit", submitAuth);
$("#search").addEventListener("input", (e) => setSearch(e.target.value));
$("#searchMobile").addEventListener("input", (e) => setSearch(e.target.value));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });
window.addEventListener("session-expired", () => { loadUser(); loadCart(); toast("Your session expired, please sign in again.", "error"); });

(async function init() {
  document.title = CONFIG.shopName + " | Order online";
  $("#footName").textContent = "\u00a9 " + new Date().getFullYear() + " " + CONFIG.shopName;
  await loadUser();
  await Promise.all([loadMenu(), loadCart()]);
})();