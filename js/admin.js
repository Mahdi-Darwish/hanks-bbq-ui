/* Admin panel: live orders board, menu items, categories, users */
const A = {
  me: null,
  categories: [],
  products: [],
  orders: [],
  knownOrderIds: null,   // null until the first load, so we don't beep for old orders
  editingProduct: null,
  editingCategory: null,
  pendingImage: undefined,
  pendingCatImage: undefined, // undefined = unchanged, null = removed, string = new url
  timer: null,
};

const custName = (o) => o.full_name || o.phone_number || "";
function openModal(id) { $("#overlay").classList.add("open"); $(id).classList.add("open"); }
function closeAll() { $("#overlay").classList.remove("open"); $$(".modal.open").forEach((m) => m.classList.remove("open")); }

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880; gain.gain.value = 0.15;
    osc.start(); osc.stop(ctx.currentTime + 0.25);
  } catch { /* audio not allowed */ }
}

/* ---------- login ---------- */
async function enter() {
  if (!Auth.token) return showGate();
  try {
    A.me = await api("/me");
  } catch { return showGate(); }
  if (A.me.role !== "admin") { Auth.logout(); showGate("This account is not an admin."); return; }
  $("#gate").classList.add("hidden");
  $("#dash").classList.remove("hidden");
  $("#logoutBtn").classList.remove("hidden");
  await loadCategories();
  await Promise.all([loadProducts(), loadOrders()]);
  clearInterval(A.timer);
  A.timer = setInterval(loadOrders, 8000);
}
function showGate(msg = "") {
  clearInterval(A.timer);
  $("#gate").classList.remove("hidden");
  $("#dash").classList.add("hidden");
  $("#logoutBtn").classList.add("hidden");
  $("#loginErr").textContent = msg;
}
$("#loginForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try {
    const res = await api("/login", { method: "POST", auth: false, body: { phone_number: $("#aUser").value.replace(/[\s\-().]/g, ""), password: $("#aPass").value } });
    Auth.token = res.access_token;
    $("#aPass").value = "";
    await enter();
  } catch (e) { $("#loginErr").textContent = e.message; }
});
$("#logoutBtn").onclick = () => { Auth.logout(); showGate(); };
window.addEventListener("session-expired", () => showGate("Session expired, please log in again."));

/* ---------- tabs ---------- */
$("#nav").addEventListener("click", (ev) => {
  const b = ev.target.closest("button[data-tab]");
  if (!b) return;
  $$("#nav button").forEach((x) => x.classList.toggle("active", x === b));
  ["orders", "menu", "categories", "users"].forEach((t) => $("#tab-" + t).classList.toggle("hidden", t !== b.dataset.tab));
  if (b.dataset.tab === "users") loadUsers();
});

/* ---------- orders ---------- */
const NEXT_STEPS = {
  pending: [["preparing", "Accept & prepare", "ok"], ["cancelled", "Cancel", "danger"]],
  preparing: [["ready", "Mark ready", "ok"], ["cancelled", "Cancel", "danger"]],
  ready: [["out_for_delivery", "Out for delivery", ""], ["delivered", "Picked up", "ok"]],
  out_for_delivery: [["delivered", "Delivered", "ok"]],
};
const BOARD_COLUMNS = ["pending", "preparing", "ready", "out_for_delivery"];

async function loadOrders() {
  try { A.orders = await api("/admin/orders?limit=200"); } catch (e) { if (Auth.token) toast(e.message, "error"); return; }
  const ids = new Set(A.orders.map((o) => o.id));
  const fresh = A.knownOrderIds ? A.orders.filter((o) => !A.knownOrderIds.has(o.id) && o.status === "pending") : [];
  if (fresh.length) { beep(); toast(`${fresh.length} new order${fresh.length > 1 ? "s" : ""} received`); }
  A.knownOrderIds = ids;
  renderOrders(new Set(fresh.map((o) => o.id)));
}

/* the shop sends item choices first, then the customer's own words after "Notes: " */
function splitNotes(raw) {
  const text = String(raw || "").trim();
  const m = /(?:^|\. )Notes: ([\s\S]*)$/.exec(text);
  if (!m) return { choices: text, note: "" };
  return { choices: text.slice(0, m.index).trim(), note: m[1].trim() };
}
function notesHtml(raw) {
  const { choices, note } = splitNotes(raw);
  return (note ? `<div class="kitchen-note"><b>Customer note</b><p>${esc(note)}</p></div>` : "") +
    (choices ? `<div class="kitchen-note choices"><b>Item choices</b><p>${esc(choices.replace(/\. /g, "\n"))}</p></div>` : "");
}

function orderCard(o, flash) {
  const steps = (NEXT_STEPS[o.status] || []).map(([s, label, cls]) =>
    `<button class="btn sm ${cls}" data-status="${esc(s)}" data-order="${esc(o.id)}">${esc(label)}</button>`).join("");
  return `<div class="order ${flash ? "new-flash" : ""} ${splitNotes(o.notes).note ? "has-note" : ""}">
    <div class="top"><b>#${shortId(o.id)}</b><span class="pill ${esc(o.status)}">${esc(STATUS_LABELS[o.status] || o.status)}</span></div>
    <div class="meta">${o.created_at ? new Date(o.created_at).toLocaleString() : ""}<br>
      Customer: ${esc(custName(o))}${o.phone_number ? `, <a href="tel:${esc(o.phone_number)}">${esc(o.phone_number)}</a>` : ""}</div>
    <ul>${o.items.map((i) => `<li>${i.quantity} x ${esc(i.product_name)}</li>`).join("")}</ul>
    ${o.delivery_address ? `<div class="meta">Deliver to: ${esc(o.delivery_address)}</div>` : `<div class="meta">Pickup</div>`}
    ${notesHtml(o.notes)}
    <div class="top" style="margin-top:8px"><b>${money(o.total_price)}</b></div>
    <div class="btns">${steps}</div>
  </div>`;
}

function renderOrders(flashIds = new Set()) {
  const pending = A.orders.filter((o) => o.status === "pending").length;
  $("#newCount").textContent = pending ? `(${pending})` : "";
  const cols = BOARD_COLUMNS.map((s) => {
    const list = A.orders.filter((o) => o.status === s).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return `<div class="col"><h3>${esc(STATUS_LABELS[s])} <span>${list.length}</span></h3>${list.map((o) => orderCard(o, flashIds.has(o.id))).join("") || '<div class="hint" style="padding:6px">Nothing here</div>'}</div>`;
  }).join("");
  const done = A.orders.filter((o) => o.status === "delivered" || o.status === "cancelled").slice(0, 30);
  $("#tab-orders").innerHTML = `
    <div class="panel"><div class="toolbar"><h2 class="grow" style="margin:0">Live orders</h2><span class="hint">Refreshes automatically every few seconds</span></div>
      <div class="board">${cols}</div></div>
    <div class="panel"><h2>Recently finished</h2><div class="tbl-wrap"><table>
      <tr><th>Order</th><th>Customer</th><th>Total</th><th>Notes</th><th>Status</th><th>Date</th></tr>
      ${done.map((o) => `<tr><td>#${shortId(o.id)}</td><td>${esc(custName(o))}</td><td>${money(o.total_price)}</td><td>${esc(splitNotes(o.notes).note || "")}</td><td><span class="pill ${esc(o.status)}">${esc(STATUS_LABELS[o.status])}</span></td><td>${o.created_at ? new Date(o.created_at).toLocaleString() : ""}</td></tr>`).join("") || '<tr><td colspan="6" class="hint">No finished orders yet.</td></tr>'}
    </table></div></div>`;
}

$("#tab-orders").addEventListener("click", async (ev) => {
  const b = ev.target.closest("button[data-status]");
  if (!b) return;
  if (b.dataset.status === "cancelled" && !confirm("Cancel this order?")) return;
  b.disabled = true;
  try { await api(`/admin/orders/${b.dataset.order}/status`, { method: "PATCH", body: { status: b.dataset.status } }); await loadOrders(); }
  catch (e) { toast(e.message, "error"); b.disabled = false; }
});

/* ---------- categories ---------- */
async function loadCategories() {
  A.categories = await api("/admin/categories");
  renderCategories();
  $("#pCat").innerHTML = A.categories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
}
function renderCategories() {
  $("#tab-categories").innerHTML = `<div class="panel">
    <div class="toolbar"><h2 class="grow" style="margin:0">Categories</h2><button class="btn" data-new-cat>+ New category</button></div>
    <div class="tbl-wrap"><table><tr><th></th><th>Position</th><th>Name</th><th>Items</th><th></th></tr>
    ${A.categories.map((c) => `<tr><td><div class="thumb">${c.image_url ? `<img src="${esc(imgSrc(c.image_url))}" alt="">` : PLACEHOLDER_ICON}</div></td><td>${c.sort_order}</td><td><b>${esc(c.name)}</b></td>
      <td>${A.products.filter((p) => p.category_id === c.id).length}</td>
      <td style="text-align:right"><button class="btn ghost sm" data-edit-cat="${esc(c.id)}">Edit</button>
      <button class="btn danger sm" data-del-cat="${esc(c.id)}">Delete</button></td></tr>`).join("") || '<tr><td colspan="5" class="hint">No categories yet.</td></tr>'}
    </table></div></div>`;
}
function setCatPreview(url) {
  const img = $("#cPreview");
  img.classList.toggle("hidden", !url);
  $("#cRemoveImg").classList.toggle("hidden", !url);
  if (url) img.src = imgSrc(url);
}
$("#cFile").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  const form = new FormData(); form.append("file", file);
  $("#cErr").textContent = "Uploading photo...";
  try {
    const res = await api("/admin/uploads/product-image", { method: "POST", form });
    A.pendingCatImage = res.image_url; setCatPreview(res.image_url); $("#cErr").textContent = "";
  } catch (e) { $("#cErr").textContent = e.message; $("#cFile").value = ""; }
});
$("#cRemoveImg").onclick = () => { A.pendingCatImage = null; $("#cFile").value = ""; setCatPreview(null); };
function openCategory(cat) {
  A.editingCategory = cat || null;
  $("#cmTitle").textContent = cat ? "Edit category" : "New category";
  $("#cName").value = cat ? cat.name : "";
  $("#cOrder").value = cat ? cat.sort_order : A.categories.length;
  $("#cErr").textContent = "";
  A.pendingCatImage = undefined;
  $("#cFile").value = "";
  setCatPreview(cat && cat.image_url);
  openModal("#categoryModal");
}
$("#categoryForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const body = { name: $("#cName").value.trim(), sort_order: parseInt($("#cOrder").value || "0", 10) };
  if (A.pendingCatImage !== undefined) body.image_url = A.pendingCatImage;
  try {
    if (A.editingCategory) await api(`/admin/categories/${A.editingCategory.id}`, { method: "PATCH", body });
    else await api("/admin/categories", { method: "POST", body });
    closeAll(); await loadCategories(); await loadProducts(); toast("Category saved");
  } catch (e) { $("#cErr").textContent = e.message; }
});
$("#tab-categories").addEventListener("click", async (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  if (b.matches("[data-new-cat]")) openCategory();
  else if (b.dataset.editCat) openCategory(A.categories.find((c) => c.id === b.dataset.editCat));
  else if (b.dataset.delCat) {
    if (!confirm("Delete this category?")) return;
    try { await api(`/admin/categories/${b.dataset.delCat}`, { method: "DELETE" }); await loadCategories(); toast("Category deleted"); }
    catch (e) { toast(e.message, "error"); }
  }
});

/* ---------- menu items ---------- */
let productFilter = "all";
async function loadProducts() { A.products = await api("/admin/products"); renderProducts(); renderCategories(); }
function renderProducts() {
  const list = A.products.filter((p) => productFilter === "all" || p.category_id === productFilter);
  $("#tab-menu").innerHTML = `<div class="panel">
    <div class="toolbar"><h2 class="grow" style="margin:0">Menu items</h2>
      <select id="filterCat" style="width:auto"><option value="all">All categories</option>
        ${A.categories.map((c) => `<option value="${esc(c.id)}" ${c.id === productFilter ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      <button class="btn" data-new-product>+ New item</button></div>
    <div class="tbl-wrap"><table><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Available</th><th></th></tr>
    ${list.map((p) => `<tr>
      <td><div class="thumb">${p.image_url ? `<img src="${esc(imgSrc(p.image_url))}" alt="">` : PLACEHOLDER_ICON}</div></td>
      <td><b>${esc(p.name)}</b><br><span class="hint">${esc((p.description || "").slice(0, 60))}</span></td>
      <td>${esc(p.category_name || "None")}</td>
      <td>${money(p.price)}${p.old_price ? ` <s class="hint">${money(p.old_price)}</s>` : ""}</td>
      <td><label class="switch"><input type="checkbox" data-toggle="${esc(p.id)}" ${p.is_available ? "checked" : ""}> ${p.is_available ? "Yes" : "Hidden"}</label></td>
      <td style="text-align:right;white-space:nowrap"><button class="btn ghost sm" data-edit-product="${esc(p.id)}">Edit</button>
        <button class="btn danger sm" data-del-product="${esc(p.id)}">Delete</button></td></tr>`).join("") || '<tr><td colspan="6" class="hint">No items here yet.</td></tr>'}
    </table></div></div>`;
}
function setPreview(url) {
  const img = $("#pPreview");
  img.classList.toggle("hidden", !url);
  $("#pRemoveImg").classList.toggle("hidden", !url);
  if (url) img.src = imgSrc(url);
}
function openProduct(p) {
  if (!A.categories.length) { toast("Create a category first.", "error"); return; }
  A.editingProduct = p || null;
  A.pendingImage = undefined;
  $("#pmTitle").textContent = p ? "Edit item" : "New item";
  $("#pName").value = p?.name || "";
  $("#pDesc").value = p?.description || "";
  $("#pPrice").value = p?.price ?? "";
  $("#pOld").value = p?.old_price ?? "";
  $("#pAvail").checked = p ? p.is_available : true;
  $("#pCat").value = p?.category_id || (productFilter !== "all" ? productFilter : A.categories[0].id);
  $("#pFile").value = "";
  $("#pErr").textContent = "";
  setPreview(p?.image_url);
  openModal("#productModal");
}
$("#pFile").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  const form = new FormData(); form.append("file", file);
  $("#pSave").disabled = true; $("#pErr").textContent = "Uploading photo...";
  try {
    const res = await api("/admin/uploads/product-image", { method: "POST", form });
    A.pendingImage = res.image_url; setPreview(res.image_url); $("#pErr").textContent = "";
  } catch (e) { $("#pErr").textContent = e.message; $("#pFile").value = ""; }
  finally { $("#pSave").disabled = false; }
});
$("#pRemoveImg").onclick = () => { A.pendingImage = null; $("#pFile").value = ""; setPreview(null); };

$("#productForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const old = $("#pOld").value;
  const body = {
    name: $("#pName").value.trim(),
    description: $("#pDesc").value.trim(),
    price: parseFloat($("#pPrice").value),
    old_price: old ? parseFloat(old) : null,
    is_available: $("#pAvail").checked,
    category_id: $("#pCat").value,
  };
  if (A.pendingImage !== undefined) body.image_url = A.pendingImage;
  $("#pSave").disabled = true;
  try {
    if (A.editingProduct) await api(`/admin/products/${A.editingProduct.id}`, { method: "PATCH", body });
    else await api("/admin/products", { method: "POST", body });
    closeAll(); await loadProducts(); toast("Item saved");
  } catch (e) { $("#pErr").textContent = e.message; }
  finally { $("#pSave").disabled = false; }
});

$("#tab-menu").addEventListener("click", async (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  if (b.matches("[data-new-product]")) openProduct();
  else if (b.dataset.editProduct) openProduct(A.products.find((p) => p.id === b.dataset.editProduct));
  else if (b.dataset.delProduct) {
    if (!confirm("Delete this item for good?")) return;
    try { await api(`/admin/products/${b.dataset.delProduct}`, { method: "DELETE" }); await loadProducts(); toast("Item deleted"); }
    catch (e) { toast(e.message, "error"); }
  }
});
$("#tab-menu").addEventListener("change", async (ev) => {
  if (ev.target.id === "filterCat") { productFilter = ev.target.value; renderProducts(); return; }
  if (ev.target.dataset.toggle) {
    try { await api(`/admin/products/${ev.target.dataset.toggle}`, { method: "PATCH", body: { is_available: ev.target.checked } }); await loadProducts(); }
    catch (e) { toast(e.message, "error"); await loadProducts(); }
  }
});

/* ---------- users ---------- */
async function loadUsers() {
  let users;
  try { users = await api("/admin/users"); } catch (e) { toast(e.message, "error"); return; }
  $("#tab-users").innerHTML = `<div class="panel"><h2>Users</h2><div class="tbl-wrap"><table>
    <tr><th>Name</th><th>Phone</th><th>Role</th><th>Status</th><th></th></tr>
    ${users.map((u) => { const self = u.id === A.me.id; return `<tr>
      <td><b>${esc(custName(u))}</b>${self ? " (you)" : ""}</td><td>${esc(u.phone_number || "")}</td><td>${esc(u.role)}</td>
      <td>${u.is_active === false ? "Deactivated" : "Active"}</td>
      <td style="text-align:right;white-space:nowrap">${self ? "" : `
        <button class="btn ghost sm" data-user-act="${u.role === "admin" ? "demote" : "promote"}" data-user="${esc(u.id)}">${u.role === "admin" ? "Make customer" : "Make admin"}</button>
        <button class="btn ghost sm" data-user-act="deactivate" data-user="${esc(u.id)}">Deactivate</button>
        <button class="btn ghost sm" data-user-act="activate" data-user="${esc(u.id)}">Activate</button>
        <button class="btn danger sm" data-user-act="delete" data-user="${esc(u.id)}">Delete</button>`}</td></tr>`; }).join("")}
    </table></div></div>`;
}
$("#tab-users").addEventListener("click", async (ev) => {
  const b = ev.target.closest("button[data-user-act]");
  if (!b) return;
  const act = b.dataset.userAct, id = b.dataset.user;
  if ((act === "delete" || act === "promote") && !confirm(act === "delete" ? "Permanently delete this user?" : "Give this user full admin access?")) return;
  try {
    if (act === "delete") await api(`/admin/users/${id}`, { method: "DELETE" });
    else await api(`/admin/users/${id}/${act}`, { method: "PATCH" });
    toast("Done"); loadUsers();
  } catch (e) { toast(e.message, "error"); }
});

/* ---------- modals ---------- */
document.addEventListener("click", (ev) => { if (ev.target.closest("[data-close]") || ev.target.id === "overlay") closeAll(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

document.title = CONFIG.shopName + " | Admin";
$("#brand").textContent = CONFIG.shopName + " Admin";
enter();