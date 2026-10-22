/* Page transition, same animation as the opening.
   Click a header link (Home, Menu, About, Contact, the logo, Admin panel): a dark screen with embers covers the page,
   the logo drops in with its tagline as one piece, the page moves to the section behind it, then the fire circle opens.
   Other in-page links (like Order now) just scroll smoothly. Without JavaScript every link still works as a normal link. */
(function () {
  const root = document.documentElement;
  const wipe = document.getElementById("wipe");
  if (!wipe) return;

  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const KEY = "wipe-arrive";
  const HOLD = 480, REVEAL = 550;                      // milliseconds
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const brand = wipe.querySelector(".w-brand");
  const center = wipe.querySelector(".w-center");
  const canvas = wipe.querySelector(".w-embers");
  const barFill = wipe.querySelector(".w-bar i");
  let busy = false, sparks = null;

  const setR = (v) => wipe.style.setProperty("--r", v.toFixed(2) + "vmax");

  function reset() {
    wipe.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    if (sparks) { sparks.stop(); sparks = null; }
    wipe.classList.remove("on");
    root.classList.remove("wipe-arrive", "wiping");
    brand.classList.remove("go");
    center.classList.remove("out");
    canvas.style.opacity = "";
    setR(0);
    busy = false;
  }

  function start(playLogo) {
    setR(0);
    wipe.classList.add("on");
    if (playLogo) { brand.classList.remove("go"); void brand.offsetWidth; brand.classList.add("go"); }
    barFill.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: HOLD + 60, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" });   // the loading line
    if (window.hanksEmbers) sparks = window.hanksEmbers(canvas, 0.03);
  }

  function reveal() {
    return new Promise((done) => {
      center.classList.add("out");
      canvas.style.opacity = "0";
      const t0 = performance.now();
      (function frame(now) {
        const t = Math.min(1, (now - t0) / REVEAL);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        setR(e * 135);
        if (t < 1) requestAnimationFrame(frame); else done();
      })(t0);
    });
  }

  async function run(change) {
    if (busy) return;
    busy = true;
    root.classList.add("wiping");
    const failsafe = setTimeout(reset, 6000);          // never leave the screen stuck
    try {
      start(true);
      await wipe.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100, fill: "forwards" }).finished;
      await wait(HOLD);
      await change();
      await reveal();
    } finally { clearTimeout(failsafe); reset(); }
  }

  function scrollToHash(hash, smooth) {
    if (typeof closeAll === "function") closeAll();   // shut the cart or a form if one is open
    const target = hash && hash !== "#top" ? document.querySelector(hash) : null;
    const header = document.getElementById("topbar");
    const offset = header ? header.offsetHeight : 0;
    const y = target ? Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset) : 0;
    window.scrollTo({ top: y, behavior: smooth && !reduce ? "smooth" : "instant" });
    history.replaceState(null, "", hash || location.pathname);
  }

  document.addEventListener("click", (ev) => {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const a = ev.target.closest("a[data-wipe]");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href) return;
    ev.preventDefault();

    if (href.startsWith("#")) {
      if (reduce || !a.closest("#topbar")) { scrollToHash(href, true); return; }   // Order now etc: smooth scroll
      run(async () => { scrollToHash(href, false); await wait(60); });
    } else {
      if (reduce) { location.href = href; return; }
      run(() => { try { sessionStorage.setItem(KEY, "1"); } catch (e) { /* private mode */ } location.href = href; return new Promise(() => {}); });
    }
  });

  /* arriving from the other page: the dark screen is already up, play the logo, then open the circle */
  async function arrive() {
    busy = true;
    try { start(true); await wait(HOLD); await reveal(); } finally { reset(); }
  }
  if (root.classList.contains("wipe-arrive")) arrive();

  /* coming back with the browser back button must not show a stuck screen */
  window.addEventListener("pageshow", (e) => { if (e.persisted) reset(); });
})();