/* Shared helpers for the shop (index.html) and the admin panel (admin.html). */
const CONFIG = {
  shopName: "Hank's BBQ",    // used for page titles and the footer. The logo itself is img/logo.png
  currency: "$",              // change if you sell in another currency
};

// The backend serves the website too, so normally API_BASE is empty (same address).
// If you open the files directly or with VS Code Live Server (port 5500),
// they talk to the backend on API_PORT (the APP_PORT value in your .env).
const API_PORT = 8000;
const API_BASE = (location.protocol === "file:" || location.port === "5500") ? "http://localhost:" + API_PORT : "";

const Auth = {
  get token() { return localStorage.getItem("token"); },
  set token(v) { v ? localStorage.setItem("token", v) : localStorage.removeItem("token"); },
  logout() { this.token = null; },
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const money = (n) => CONFIG.currency + Number(n || 0).toFixed(2);
const imgSrc = (url) => (!url ? "" : url.startsWith("/") ? API_BASE + url : url);
const shortId = (id) => String(id).slice(0, 8).toUpperCase();
const STATUS_LABELS = {
  pending: "Pending", preparing: "Preparing", ready: "Ready",
  out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled",
};
// Neutral placeholder shown while an item or category has no photo yet.
const PLACEHOLDER_ICON = `<span class="ph"><svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true"><path d="M24 3c1 8 11 12 11 24a11 11 0 0 1-22 0c0-5 2.500-8.500 5-11.500 .5 3 2 5 4 6 1.500-6 .5-12 2-18.500z"/><path d="M24 44a5.500 5.500 0 0 1-5.500-5.500c0-3 2.500-5 5.500-9 3 4 5.500 6 5.500 9A5.500 5.500 0 0 1 24 44z" fill="#130e0d" opacity=".35"/></svg></span>`;

function formatError(data, status) {
  if (!data || data.detail === undefined) return `Request failed (${status})`;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map((d) => (d.msg || "Invalid value").replace(/^Value error, /, "")).join(". ");
  }
  return `Request failed (${status})`;
}

async function api(path, { method = "GET", body, auth = true, form } = {}) {
  const headers = {};
  if (auth && Auth.token) headers.Authorization = "Bearer " + Auth.token;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: payload });
  } catch {
    throw new Error("Cannot reach the server. Is it running?");
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && auth && Auth.token) {
      Auth.logout();
      window.dispatchEvent(new Event("session-expired"));
    }
    if (res.status === 429) throw new Error("Too many requests, please wait a moment and try again.");
    throw new Error(formatError(data, res.status));
  }
  return data;
}

function toast(message, type = "info") {
  let box = document.getElementById("toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; document.body.appendChild(box); }
  const el = document.createElement("div");
  el.className = "toast " + (type === "error" ? "error" : "");
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
