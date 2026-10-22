/* Motion for Hank's BBQ: the opening, embers and flames, the hero emblem, header, scroll reveal, menu highlight. */
(function () {
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const body = document.body;

  /* ---------- embers: sparks drifting up off the coals (used on the opening and the hero) ---------- */
  function embers(canvas, density) {
    if (!canvas || reduce) return { stop() {} };
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, run = true, visible = true, parts = [];
    const dpr = 1;
    const COLORS = ["238,106,44", "212,42,32", "255,170,110", "245,238,227"];
    function size() {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const want = Math.round((w * h) / 1000 * density);
      while (parts.length < want) parts.push(spawn(true));
      parts.length = Math.min(parts.length, want);
    }
    function spawn(anywhere) {
      return { x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10, r: 0.8 + Math.random() * 2.2,
        vy: 0.35 + Math.random() * 1.1, sway: Math.random() * 6.28, sp: 0.01 + Math.random() * 0.025,
        amp: 0.3 + Math.random() * 0.9, life: Math.random(), c: COLORS[(Math.random() * COLORS.length) | 0] };
    }
    function tick() {
      if (!run) return;
      if (visible && !document.hidden) {
        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          p.y -= p.vy; p.sway += p.sp; p.x += Math.sin(p.sway) * p.amp; p.life += 0.004;
          const fade = Math.max(0, Math.min(1, p.y / h * 1.6));
          const flick = 0.55 + 0.45 * Math.sin(p.life * 40 + i);
          ctx.beginPath();
          ctx.fillStyle = `rgba(${p.c},${(fade * flick).toFixed(3)})`;
                    ctx.arc(p.x, p.y, p.r * (0.6 + fade * 0.6), 0, 6.283);
          ctx.fill();
          if (p.y < -10) parts[i] = spawn(false);
        }
      }
      requestAnimationFrame(tick);
    }
    size();
    window.addEventListener("resize", size);
    if ("IntersectionObserver" in window) new IntersectionObserver((en) => { visible = en[0].isIntersecting; }).observe(canvas);
    requestAnimationFrame(tick);
    return { stop() { run = false; } };
  }

  window.hanksEmbers = embers;   // the page transition reuses the same embers

  /* ---------- the fire pit: charcoal that breathes, a grate, grease dripping onto the coals ---------- */
  function buildFlames() {
    const box = $("#flames");
    if (!box) return;
    const rnd = (a, b) => a + Math.random() * (b - a);
    function row(cls, n, wMin, wMax, hMin, hMax) {
      let h = "";
      for (let i = 0; i < n; i++) {
        const w = rnd(wMin, wMax), ht = rnd(hMin, hMax), ash = Math.random() < 0.18 ? " ash" : "";
        h += `<i class="coal${ash}" style="--x:${(i / n * 100 + rnd(-1.5, 1.5)).toFixed(1)}%;--w:${w.toFixed(0)}px;--h:${ht.toFixed(0)}px;--r:${rnd(-18, 18).toFixed(0)}deg;--a:${rnd(20, 160).toFixed(0)}deg;--d:${rnd(1.6, 4.6).toFixed(1)}s;--dl:${(-rnd(0, 5)).toFixed(1)}s;--b:${rnd(-6, 8).toFixed(0)}px"></i>`;
      }
      return `<div class="coals ${cls}">${h}</div>`;
    }
    const n = Math.min(20, Math.ceil(window.innerWidth / 90));
    let drips = "";
    for (let i = 0; i < 3; i++) drips += `<i class="drip" style="--x:${(16 + i * 30 + rnd(-4, 4)).toFixed(0)}%;--t:${rnd(5, 9).toFixed(1)}s;--dl:${(-rnd(0, 8)).toFixed(1)}s"></i>`;
    box.innerHTML = `<div class="heat"></div>${row("back", n, 80, 130, 30, 46)}<div class="grate"></div>${drips}${row("front", n, 90, 150, 30, 50)}`;
  }
  buildFlames();

  /* ---------- opening: dark pit, the logo drops in, embers rise, then the fire lights the page ---------- */
  const introEmbers = embers($("#introEmbers"), 0.025);
  embers($("#heroEmbers"), 0.015);

  function lightsOn() { body.classList.add("lit"); body.classList.remove("intro-on"); if (typeof introEmbers !== "undefined") setTimeout(() => introEmbers.stop(), 1800); }
  const intro = $("#intro");
  const arrived = document.documentElement.classList.contains("wipe-arrive");   // came here through the page transition
  if (reduce || !intro || arrived) {
    if (intro) intro.remove();
    if (arrived && !reduce) setTimeout(lightsOn, 650); else lightsOn();        // let the curtain lift first
  } else {
    let started = false;
    const dark = $(".dark", intro);
    const reveal = () => {
      if (started) return;
      started = true;
      $(".intro-center", intro).classList.add("out");
      lightsOn();
      const t0 = performance.now(), dur = 1100;
      (function frame(now) {
        const t = Math.min(1, (now - t0) / dur);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        dark.style.setProperty("--r", (e * 135).toFixed(2) + "vmax");
        if (t < 1) requestAnimationFrame(frame); else intro.remove();
      })(t0);
    };
    intro.addEventListener("click", reveal);
    const fonts = (document.fonts && document.fonts.ready) ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
    fonts.then(() => setTimeout(reveal, 1800));
  }

  /* ---------- hero media: the logo emblem is the default. A real photo or video in img/ replaces it ---------- */
  const frame = $("#heroFrame");
  function showMedia(el, isVideo) {
    frame.innerHTML = "";
    frame.classList.add("photo");
    frame.prepend(el);
    body.classList.add("has-media");
    if (isVideo) body.classList.add("has-video");
  }
  function tryImage() {
    const img = new Image();
    img.alt = "";
    img.onload = () => showMedia(img, false);
    img.src = "img/hero.jpg";
  }
  /* a transparent photo of your burger (img/hero-burger.png or .webp): it floats, sways and follows the mouse */
  function showCutout(img) {
    frame.classList.add("cutout");
    frame.innerHTML = '<div class="halo"></div><div class="ring"></div><div class="float"><div class="tilt"></div></div><div class="ground"></div>';
    frame.querySelector(".tilt").appendChild(img);
    body.classList.add("has-media", "has-cutout");
    if (reduce) return;
    const hero = $(".hero");
    let raf = 0, mx = 0, my = 0;
    function apply() {
      raf = 0;
      frame.style.setProperty("--mx", mx.toFixed(3));
      frame.style.setProperty("--my", my.toFixed(3));
      frame.style.setProperty("--sc", Math.min(1, window.scrollY / 700).toFixed(3));
    }
    const queue = () => { if (!raf) raf = requestAnimationFrame(apply); };
    if (window.matchMedia("(pointer: fine)").matches) {
      hero.addEventListener("pointermove", (e) => {
        const r = hero.getBoundingClientRect();
        mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        my = ((e.clientY - r.top) / r.height - 0.5) * 2;
        queue();
      });
      hero.addEventListener("pointerleave", () => { mx = 0; my = 0; queue(); });
    }
    window.addEventListener("scroll", queue, { passive: true });
  }
  function tryCutout(next, ext = "png") {
    const img = new Image();
    img.alt = "";
    img.onload = () => showCutout(img);
    img.onerror = () => (ext === "png" ? tryCutout(next, "webp") : next());
    img.src = "img/hero-burger." + ext;
  }
  function tryVideo() {
    const v = document.createElement("video");
    v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.preload = "auto";
    v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    v.addEventListener("loadeddata", () => { showMedia(v, true); const p = v.play(); if (p && p.catch) p.catch(() => {}); });
    v.addEventListener("error", tryImage);
    v.src = "img/hero.mp4";
  }
  tryCutout(tryVideo);

  /* ---------- header line appears on scroll ---------- */
  const bar = $("#topbar");
  const onScroll = () => bar.classList.toggle("scrolled", window.scrollY > 10);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- menu cards fade in as you scroll ---------- */
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: 0.1, rootMargin: "0px 0px -30px 0px" })
    : null;
  let cardN = 0;
  function enhance(root) {
    $$(".card.reveal:not(.in):not([data-fx])", root).forEach((card) => {
      card.dataset.fx = "1";
      card.style.setProperty("--k", cardN++ % 4);   // cards in a row arrive one after another
      if (io) io.observe(card); else card.classList.add("in");
    });
  }
  const menu = $("#menu");
  new MutationObserver(() => enhance(menu)).observe(menu, { childList: true });
  enhance(menu);

  /* ---------- headings, info items and footer columns slide in as you scroll ---------- */
  const io2 = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io2.unobserve(en.target); } }), { threshold: 0.15 })
    : null;
  $$(".block-head, .about-copy > *, .foot-top > *").forEach((el, i) => {
    el.classList.add("rv");
    el.style.transitionDelay = ((i % 4) * 90) + "ms";
    if (io2) io2.observe(el); else el.classList.add("in");
  });

  /* ---------- the sticky bars sit exactly under the header, whatever height it has on this screen ---------- */
  const headerEl = $("#topbar");
  if (headerEl && "ResizeObserver" in window) {
    const setHeader = () => document.documentElement.style.setProperty("--hdr", headerEl.offsetHeight + "px");
    setHeader();
    new ResizeObserver(setHeader).observe(headerEl);
  }

  /* ---------- the header link for the section you are in stays underlined ---------- */
  const links = $$('.nav a[href^="#"]');
  const spots = links.map((a) => ({ a, el: $(a.getAttribute("href")) })).filter((x) => x.el);
  let ticking = false;
  function spy() {
    ticking = false;
    if (!spots.length) return;
    const y = window.scrollY + 140;
    let current = spots[0];
    spots.forEach((s) => { if (s.el.offsetTop <= y && s.el.offsetTop >= current.el.offsetTop) current = s; });   // the section nearest above the line
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 6) current = spots[spots.length - 1];
    links.forEach((l) => l.classList.toggle("active", l === current.a));
  }
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
  window.addEventListener("load", spy);
  spy();
})();

/* ---------- Socials: the header button opens a small menu with Instagram and TikTok ---------- */
(function () {
  const btn = document.getElementById("socialBtn");
  const menu = document.getElementById("socialMenu");
  if (!btn || !menu) return;
  function place() {
    const r = btn.getBoundingClientRect();
    menu.style.top = r.bottom + "px";
    menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8)) + "px";
  }
  function open() { menu.hidden = false; btn.setAttribute("aria-expanded", "true"); place(); }
  function close() { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }
  btn.addEventListener("click", (e) => { e.stopPropagation(); menu.hidden ? open() : close(); });
  menu.addEventListener("click", () => close());
  document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { close(); btn.focus(); } });
  window.addEventListener("resize", () => { if (!menu.hidden) place(); });
  window.addEventListener("scroll", () => { if (!menu.hidden) close(); }, { passive: true });
})();

/* ---------- Version 3 extras: all cheap, all transform or opacity only ---------- */
(function () {
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* the hero stops animating once it is off screen */
  const hero = document.querySelector(".hero");
  if (hero && "IntersectionObserver" in window) {
    new IntersectionObserver((en) => hero.classList.toggle("off", !en[0].isIntersecting), { threshold: 0 }).observe(hero);
  }

  /* the about photos and the stamp arrive when you reach them */
  const photos = document.getElementById("aboutPhotos");
  if (photos) {
    if ("IntersectionObserver" in window && !reduce) {
      new IntersectionObserver((en) => {
        const e = en[0];
        photos.classList.toggle("live", e.isIntersecting);          // the stamp only spins while you can see it
        if (e.intersectionRatio >= 0.25) photos.classList.add("in");
      }, { threshold: [0, 0.25] }).observe(photos);
    } else photos.classList.add("in");
  }

  /* scroll progress line: browsers with scroll timelines do it in CSS, the rest get this */
  const bar = document.getElementById("progress");
  const toTop = document.getElementById("toTop");
  const nativeProgress = window.CSS && CSS.supports && CSS.supports("animation-timeline: scroll()");
  let queued = false;
  function frame() {
    queued = false;
    const y = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar && !nativeProgress) bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, y / max) : 0).toFixed(4) + ")";
    if (toTop) toTop.classList.toggle("show", y > 900);
  }
  window.addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(frame); } }, { passive: true });
  frame();
  if (toTop) toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }));

  /* the logo in the hero leans toward the mouse */
  const emblem = document.querySelector(".emblem");
  if (emblem && hero && !reduce && window.matchMedia("(pointer: fine)").matches) {
    let raf = 0, tx = 0, ty = 0;
    const apply = () => { raf = 0; emblem.style.setProperty("--tx", tx.toFixed(3)); emblem.style.setProperty("--ty", ty.toFixed(3)); };
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    hero.addEventListener("pointerleave", () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(apply); });
  }
})();
