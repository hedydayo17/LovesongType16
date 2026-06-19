// ============================================================
// motion.js — モーションエンジン(GSAP + ScrollTrigger + Lenis 全部盛り)
// GSAP/Lenis 未読込・reduce-motion でも内容は必ず見える(フォールバック)
// ============================================================
const MX = (() => {
  const hasGSAP = typeof gsap !== "undefined";
  const hasST = hasGSAP && typeof ScrollTrigger !== "undefined";
  const hasLenis = typeof Lenis !== "undefined";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const on = hasGSAP && !reduce;
  if (hasST) gsap.registerPlugin(ScrollTrigger);
  const EASE = "power3.out";

  // ---- Lenis 慣性スクロール(window) ----
  let lenis = null;
  if (on && hasLenis) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true, touchMultiplier: 1.6 });
    lenis.on("scroll", () => { if (hasST) ScrollTrigger.update(); });
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  function scrollTo(target, opts = {}) {
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.1, ...opts });
    else if (target && target.scrollIntoView) target.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }
  // 画面切替時:結果のScrollTriggerを掃除 + 先頭へ
  function killScroll() {
    if (hasST) ScrollTrigger.getAll().forEach(t => t.kill());
    if (lenis) lenis.scrollTo(0, { immediate: true });
    window.scrollTo(0, 0);
  }
  function refresh() { if (hasST) ScrollTrigger.refresh(); if (lenis) lenis.resize(); }
  function lenisStart() { if (lenis) { try { lenis.start(); } catch {} } }

  // ---- 文字分割 ----
  function splitChars(el) {
    if (!el) return [];
    const out = [];
    [...el.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        [...n.textContent].forEach(c => {
          const s = document.createElement("span"); s.className = "ch";
          s.textContent = c; frag.appendChild(s); out.push(s);
        });
        el.replaceChild(frag, n);
      }
    });
    return out;
  }

  // ---- 背景:粒子 + ブロブ + コニック回転 + ポインタ視差 ----
  function blobs() {
    if (!on) return;
    // 漂う粒子を生成
    const pc = document.getElementById("particles");
    if (pc && !pc.childElementCount) {
      for (let i = 0; i < 26; i++) {
        const s = document.createElement("span"); s.className = "pt";
        const sz = gsap.utils.random(3, 8);
        s.style.cssText = `width:${sz}px;height:${sz}px;left:${gsap.utils.random(0,100)}%;top:${gsap.utils.random(0,100)}%`;
        pc.appendChild(s);
        gsap.to(s, { y: gsap.utils.random(-120, -260), x: `+=${gsap.utils.random(-40,40)}`,
          opacity: 0, duration: gsap.utils.random(6, 12), repeat: -1, delay: gsap.utils.random(0, 6),
          ease: "none", onRepeat: () => gsap.set(s, { y: 0, opacity: gsap.utils.random(.3, .8) }) });
        gsap.set(s, { opacity: gsap.utils.random(.3, .8) });
      }
    }
    // ブロブのゆらぎ
    gsap.utils.toArray(".blob").forEach((b, i) => {
      gsap.to(b, { x: `+=${i % 2 ? 50 : -60}`, y: `+=${i % 2 ? -70 : 50}`,
        duration: 7 + i * 2, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(b, { scale: 1.18, duration: 5 + i, repeat: -1, yoyo: true, ease: "sine.inOut" });
    });
    // コニック回転
    gsap.to(".conic", { rotation: 360, duration: 60, repeat: -1, ease: "none" });
    // ポインタ視差
    window.addEventListener("pointermove", (e) => {
      const dx = e.clientX / window.innerWidth - .5, dy = e.clientY / window.innerHeight - .5;
      gsap.to(".blob", { xPercent: dx * 16, yPercent: dy * 16, duration: 1, ease: "power2.out", overwrite: "auto" });
      gsap.to(".particles", { xPercent: dx * 8, yPercent: dy * 8, duration: 1.2, ease: "power2.out", overwrite: "auto" });
    });
  }

  // ---- マグネティックボタン ----
  function magnetize(root = document) {
    if (!on) return;
    root.querySelectorAll("[data-mag]").forEach(btn => {
      if (btn._mag) return; btn._mag = true;
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        gsap.to(btn, { x: (e.clientX - r.left - r.width / 2) * .25, y: (e.clientY - r.top - r.height / 2) * .35, duration: .4, ease: "power3.out" });
      });
      btn.addEventListener("pointerleave", () => gsap.to(btn, { x: 0, y: 0, duration: .5, ease: "elastic.out(1,.4)" }));
    });
  }

  // ---- 画面遷移ワイプ ----
  let wiping = false;
  function wipe(cb) {
    if (!on) { cb(); return; }
    if (wiping) return; wiping = true;
    const w = document.querySelector(".wipe");
    gsap.timeline({ onComplete: () => { wiping = false; } })
      .set(w, { display: "block", scaleY: 0, transformOrigin: "bottom" })
      .to(w, { scaleY: 1, duration: .42, ease: "power4.inOut" })
      .add(() => cb())
      .set(w, { transformOrigin: "top" })
      .to(w, { scaleY: 0, duration: .5, ease: "power4.inOut" }, "+=.05")
      .set(w, { display: "none" });
  }

  // ---- ヒーロー入場 ----
  function hero() {
    if (!on) return;
    gsap.timeline({ defaults: { ease: EASE } })
      .from(".hero-title .ln > *", { yPercent: 115, opacity: 0, rotate: 4, stagger: .12, duration: .85, ease: "power4.out" })
      .from(".hero-lead", { y: 20, opacity: 0, duration: .5 }, "-=.4")
      .from(".hm", { y: 16, opacity: 0, scale: .8, stagger: .08, duration: .45, ease: "back.out(2)" }, "-=.3")
      .from(".hero .btn", { y: 24, opacity: 0, stagger: .1, duration: .5 }, "-=.2")
      .from(".hero-share, .marquee", { opacity: 0, duration: .6 }, "-=.3");
    const track = document.querySelector(".marquee-track");
    if (track) gsap.to(track, { x: -track.scrollWidth / 2, duration: 18, repeat: -1, ease: "none" });
    magnetize(document);
  }

  function screenIn() {
    if (!on) return;
    gsap.from("#app .screen > *", { y: 22, opacity: 0, stagger: .06, duration: .5, ease: EASE, clearProps: "all" });
    magnetize(document);
  }
  function galleryIn() {
    if (!on) return;
    gsap.from(".g-card", { y: 30, opacity: 0, scale: .85, stagger: { each: .035, from: "start" }, duration: .5, ease: "back.out(1.7)", clearProps: "all" });
  }

  // 選択した円が弾ける
  function dotBurst(dot) {
    if (!on || !dot) return;
    gsap.fromTo(dot, { scale: 1 }, { scale: 1.35, duration: .18, yoyo: true, repeat: 1, ease: "power2.out", clearProps: "transform" });
    const r = dot.getBoundingClientRect();
    const ring = document.createElement("span"); ring.className = "burst-ring";
    ring.style.left = (r.left + r.width / 2) + "px"; ring.style.top = (r.top + r.height / 2) + "px";
    document.body.appendChild(ring);
    gsap.fromTo(ring, { scale: .2, opacity: .7 }, { scale: 2.6, opacity: 0, duration: .5, ease: "power2.out", onComplete: () => ring.remove() });
  }

  // ---- 結果:scroll-snap 優先のため Lenis 慣性は止める / 他画面復帰で再開 ----
  function result() {
    if (!on) return false;
    if (lenis) { try { lenis.stop(); } catch {} }
    refresh();
    // 本文リビールは CSS+IntersectionObserver(observeReveals)が担当。
    // ここではGSAPの「飾り」だけ(失敗しても本文は見える設計)。
    // ブロブを背景視差(スクロール量に追従)
    gsap.utils.toArray(".blob").forEach((b, i) => {
      gsap.to(b, { yPercent: (i % 2 ? -1 : 1) * (30 + i * 10), ease: "none",
        scrollTrigger: { trigger: "#app", start: "top top", end: "bottom bottom", scrub: 1 } });
    });
    // タイプ名 char リビール + 紙吹雪 + パネル内パララックス
    const chars = splitChars(document.querySelector(".w-parody"));
    if (chars.length) {
      // from を onEnter 内で生成 → トリガー未発火でも名前は必ず見える
      ScrollTrigger.create({
        trigger: ".p-type", start: "top 60%", once: true,
        onEnter: () => { gsap.from(chars, { opacity: 0, yPercent: 120, rotate: 8, stagger: .05, duration: .7, ease: "back.out(1.7)" }); confetti(); }
      });
    }
    gsap.to(".p-type .type-mascot", { yPercent: -60, ease: "none",
      scrollTrigger: { trigger: ".p-type", start: "top bottom", end: "bottom top", scrub: true } });
    // 恋愛傾向バーがスクロールで伸びる
    ScrollTrigger.create({ trigger: ".p-traits", start: "top 65%", once: true,
      onEnter: () => gsap.fromTo(".p-traits .trait-bar i", { width: 0 },
        { width: (i, el) => el.dataset.w + "%", duration: 1, stagger: .1, ease: "power3.out" }) });
    // "10" カウントアップ
    const count = document.querySelector(".w-songs-count");
    if (count) {
      const obj = { v: 0 };
      ScrollTrigger.create({ trigger: ".p-songs-intro", start: "top 60%", once: true,
        onEnter: () => gsap.to(obj, { v: 10, duration: 1.1, ease: "power2.out", onUpdate: () => count.textContent = Math.round(obj.v) }) });
    }
    // 曲名の横マーキー(intro)
    const mt = document.querySelector(".song-marquee-track");
    if (mt) gsap.to(mt, { xPercent: -50, duration: 20, repeat: -1, ease: "none" });
    // 曲リストを1件ずつ
    ScrollTrigger.create({ trigger: ".p-songs", start: "top 65%", once: true,
      onEnter: () => gsap.from(".songlist .song", { x: -30, opacity: 0, stagger: .06, duration: .5, ease: EASE, clearProps: "all" }) });
    magnetize(document);
    refresh();
    return true;
  }

  function confetti() {
    if (!on) return;
    const colors = ["#ff5e8a", "#ffc857", "#8a8dff", "#36d1a8", "#ff9bb8", "#fff"];
    const box = document.createElement("div"); box.className = "confetti"; document.body.appendChild(box);
    for (let i = 0; i < 90; i++) {
      const p = document.createElement("span"); p.style.background = colors[i % colors.length]; box.appendChild(p);
      gsap.set(p, { x: window.innerWidth / 2, y: window.innerHeight * .4, scale: gsap.utils.random(.6, 1.5) });
      gsap.to(p, { x: window.innerWidth / 2 + gsap.utils.random(-240, 240), y: window.innerHeight + 40,
        rotation: gsap.utils.random(-360, 360), duration: gsap.utils.random(1.1, 2.3), ease: "power1.in", onComplete: () => p.remove() });
    }
    setTimeout(() => box.remove(), 2500);
  }

  // ---- PCのみ:#app 内ホイールを smooth + 速度減速(Lenis 無効でも自然なスクロール感) ----
  const _appEl = document.getElementById("app");
  if (_appEl) {
    _appEl.addEventListener("wheel", (e) => {
      if (window.innerWidth < 768) return; // スマホ・タブ縦は対象外(body scroll)
      if (_appEl.scrollHeight <= _appEl.clientHeight + 1) return; // スクロール不要画面
      e.preventDefault();
      _appEl.scrollBy({ top: e.deltaY * 0.5, behavior: "smooth" });
    }, { passive: false });
  }

  return { on, lenis, scrollTo, killScroll, refresh, lenisStart, hero, screenIn, galleryIn, dotBurst, result, wipe, magnetize, blobs, splitChars };
})();
