// ============================================================
// app.js — 診断フロー制御
// Step 0(生年月日) → 0a(ジャンル) → 0b(アーティスト) → 15問 → 結果 → 10曲
// 生年月日はスコア非影響・結果カード非表示(feedback_no_age_on_card 準拠)
// ============================================================

const state = {
  birth: null,        // {y,m,d} — カードには出さない
  genres: [],         // 0〜5
  artists: [],        // 0〜3
  qIndex: 0,
  answers: [],        // 選んだ選択肢index
  scores: {},         // type別合計
  result: null,       // 結果 type key
  lastRecommend: []   // 直近10曲
};

// ─── K: 診断ステート保存/復元(localStorage、24h有効)─────────
// ユーザーがブラウザを閉じても/誤ってリロードしても、診断途中なら
// LPに「↗ 前回の続きから」バナーを出して resume できる。
// 結果確定時にclear。24h経過分は自動破棄。
const PROGRESS_KEY = "lsd16:progress:v1";
function saveProgress() {
  try {
    if (state.result) { localStorage.removeItem(PROGRESS_KEY); return; }
    // 何も入力されてなければ保存しない
    const hasInput = state.birth || state.qIndex > 0 ||
                     (state.genres && state.genres.length) ||
                     (state.artists && state.artists.length);
    if (!hasInput) return;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      birth: state.birth,
      genres: state.genres || [],
      artists: state.artists || [],
      artistIds: state.artistIds || [],
      qIndex: state.qIndex,
      answers: state.answers || [],
      ts: Date.now(),
    }));
  } catch {}
}
function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p.ts || Date.now() - p.ts > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(PROGRESS_KEY);
      return null;
    }
    return p;
  } catch { return null; }
}
function clearProgress() {
  try { localStorage.removeItem(PROGRESS_KEY); } catch {}
}
// 「前回の続きから」リジューム
function resumeProgress() {
  const p = loadProgress();
  if (!p) return;
  state.birth = p.birth || null;
  state.genres = p.genres || [];
  state.artists = p.artists || [];
  state.artistIds = p.artistIds || [];
  state.qIndex = p.qIndex || 0;
  state.answers = p.answers || [];
  // どの step まで進んでいたかで分岐
  if (state.qIndex > 0 && state.qIndex < QUESTIONS.length) {
    renderQuestion();
  } else if (state.artists.length || state.genres.length) {
    // アーティスト入力済 → そこから
    renderArtists();
  } else if (state.genres.length) {
    renderGenres();
  } else if (state.birth) {
    renderGenres();
  } else {
    renderBirth();
  }
}

const $ = (sel) => document.querySelector(sel);
const app = () => $("#app");

// ---- 画面遷移 ----
function show(html) {
  MX.killScroll();
  document.documentElement.classList.remove("snap-mode");
  if (MX.lenisStart) MX.lenisStart(); // 結果ページで止めた lenis を他画面で復帰
  app().innerHTML = html;
  window.scrollTo(0, 0);
}

// 画面遷移(ワイプ付き)。GSAP無ければ即実行
function go(fn) { MX.wipe(fn); }

// ---- parody名のフレーズ境界 <wbr> ヒント ----
// 狭幅カード(図鑑/マーキュー)で2行に折る時、単語の途中ではなく
// 意味の境界で切れるようにする。短い名前(<=6文字)はヒント不要 → 1行のまま。
const PARODY_BREAKS = {
  "進撃のロマンチスト": "進撃の<wbr>ロマンチスト",
  "ヤキモチモンスター": "ヤキモチ<wbr>モンスター",
  "ピュアエンジェル":   "ピュア<wbr>エンジェル",
  "マブダチエイリアン": "マブダチ<wbr>エイリアン",
  "ときめきパパラッチ": "ときめき<wbr>パパラッチ",
  "ド直球ザウルス":     "ド直球<wbr>ザウルス",
  "ミステリアス狼":     "ミステリアス<wbr>狼",
  "情熱ラブゾンビ":     "情熱<wbr>ラブゾンビ",
  "運命マジシャン":     "運命<wbr>マジシャン",
};
function parodyBR(name) { return PARODY_BREAKS[name] || name; }

// ---- ランディング(ヒーロー):摩擦ゼロの入口。16P/ラブタイプ流に「即スタート」を強調 ----
// ─── 16タイプ相性ピラミッド ─────────────────────────────────────
// 自タイプと他15タイプそれぞれの「相性スコア(0-100)」を計算して上位順に並べる。
// 共感(同Kei)・補完(compatible特定指名)・温度差(対角Kei)を組み合わせた
// ロジック。ファウンダー指示「ラブタイプとの相性は共感できるように正確に」を、
// data.js の compatible/Kei定義を信号源にして表現。
const _ADJACENT_KEI = {
  "溺愛系":     ["ピュア系", "アクティブ系"],
  "ピュア系":   ["マイペース系", "溺愛系"],
  "マイペース系": ["アクティブ系", "ピュア系"],
  "アクティブ系": ["溺愛系", "マイペース系"],
};
function _keiOf(typeKey) {
  return Object.keys(KEI).find(k => KEI[k].types.includes(typeKey));
}
// ペア固有の決定論的調整(同じスコア帯でも順位がブレないように)
function _pairHashAdjust(a, b, range) {
  let h = 0; const str = a + "|" + b;
  for (let i = 0; i < str.length; i++) h = ((h * 31) + str.charCodeAt(i)) % 10000;
  return (h % range) - Math.floor(range / 2);
}
function affinityScore(currentType, otherType) {
  if (currentType === otherType) return 0;
  const tA = TYPE_MAP[currentType];
  // 1. 既定の compatible(parody名)に含まれる = 最強相性(90-98)
  if (tA.compatible.includes(otherType)) return 90 + Math.abs(_pairHashAdjust(currentType, otherType, 9));
  // 2. 同 Kei = 共感型(75-87)
  const keiA = _keiOf(currentType);
  const keiB = _keiOf(otherType);
  if (keiA === keiB) return 75 + Math.abs(_pairHashAdjust(currentType, otherType, 13));
  // 3. 隣接 Kei = 補完型(60-72)
  if (_ADJACENT_KEI[keiA]?.includes(keiB)) return 60 + Math.abs(_pairHashAdjust(currentType, otherType, 13));
  // 4. 対角 Kei = 温度差(35-50)
  return 35 + Math.abs(_pairHashAdjust(currentType, otherType, 16));
}
// 16段ピラミッド(15タイプ並べ):1+2+3+4+5 = 15
const _PYRAMID_ROWS = [1, 2, 3, 4, 5];
function buildPyramidHTML() {
  const me = state.result;
  if (!me) return "";
  // 他15タイプを相性スコア降順で
  const ranked = TYPES.map(t => t.key)
    .filter(k => k !== me)
    .map(k => ({ key: k, score: affinityScore(me, k) }))
    .sort((a, b) => b.score - a.score);
  // 5段に流し込み
  const rows = [];
  let idx = 0;
  for (let r = 0; r < _PYRAMID_ROWS.length; r++) {
    const cells = [];
    for (let c = 0; c < _PYRAMID_ROWS[r]; c++) {
      const item = ranked[idx++];
      if (!item) continue;
      const t = TYPE_MAP[item.key];
      const tier = r === 0 ? "tier-top" : r === _PYRAMID_ROWS.length - 1 ? "tier-low" : "";
      const rank = idx;
      cells.push(`<span class="cp-pill ${tier}" style="--c:${t.color}" title="${t.parody}・相性${item.score}">
        <span class="cp-rank">No.${rank}</span>
        <span class="cp-name">${t.parody}</span>
        <span class="cp-score">${item.score}</span>
      </span>`);
    }
    rows.push(`<div class="cp-row cp-r${r + 1}">${cells.join("")}</div>`);
  }
  return rows.join("");
}

// ─── F: 累計診断数の擬似カウンタ ────────────────────────────────────
// 本物のサーバ集計はまだだが、「今日 ○人が診断した」をローカルで概算表示する。
// 数値ソース:ローンチ日(2026-06-22)からの経過日 × 1日あたり擬似増加 +
//            このブラウザでの自分の診断回数(localStorage)。
// 100万人スケールに到達したら、Vercel KV/Edge Config 等で本物のグローバル
// カウンタに差し替える(同じ countSeed() 関数を上書き)。
function countSeed() {
  const LAUNCH = new Date(2026, 5, 22).getTime(); // 2026-06-22(0-indexedで5)
  const now = Date.now();
  const days = Math.max(0, Math.floor((now - LAUNCH) / 86400000));
  // 日ごとに +120〜180 のレンジで擬似増加(日付ハッシュで決定論的、ランダムには見えるが固定)
  let total = 1280; // 立ち上げ初期値
  for (let d = 0; d <= days; d++) {
    const noise = ((d * 17 + 31) % 60) + 120; // 120-180
    total += noise;
  }
  // ローカルの自分の診断回数も足す(自分の貢献感)
  try {
    const myCount = parseInt(localStorage.getItem("lsd16:myCount") || "0", 10) || 0;
    total += myCount;
  } catch {}
  return total;
}
function bumpMyCount() {
  try {
    const n = parseInt(localStorage.getItem("lsd16:myCount") || "0", 10) || 0;
    localStorage.setItem("lsd16:myCount", String(n + 1));
  } catch {}
}

// ─── S: 動的 document.title ───
// 結果到達時に「私は◯◯系×× | ラブソング診断16」へ変える(ホーム履歴・タブ・
// PWAアプリ切替で映える)。非結果ページでは元タイトルに戻す。
const _DEFAULT_TITLE = "ラブソング診断16 | あなたのタイプに合う10曲が見つかる";
function _updateDocTitle() {
  try {
    if (state.result) {
      const t = TYPE_MAP[state.result];
      const k = state.kei ? state.kei : "";
      document.title = `私は「${k}${t.parody}」だった | ラブソング診断16`;
      // SNSクローラーには効かないが、ブックマーク・ブラウザ履歴では映える
      const desc = `「${t.parody}」— ${t.tagline} あなたは何タイプ?`;
      const setMeta = (selector, content) => {
        const el = document.querySelector(selector);
        if (el) el.setAttribute("content", content);
      };
      setMeta('meta[name="description"]', desc);
      setMeta('meta[property="og:title"]', document.title);
      setMeta('meta[property="og:description"]', desc);
      setMeta('meta[name="twitter:title"]', document.title);
      setMeta('meta[name="twitter:description"]', desc);
    } else {
      document.title = _DEFAULT_TITLE;
    }
  } catch {}
}
function renderLanding() {
  _updateDocTitle();
  const marquee = TYPES.concat(TYPES).map(t =>
    `<span class="mq" style="--c:${t.color}">
      <span class="mq-mascot">${mascotSVG(t.parody)}</span>
      <span class="mq-label">${parodyBR(t.parody)}</span>
    </span>`).join("");
  show(`
    ${loadProgress() ? `<button class="resume-banner" onclick="resumeProgress()" aria-label="前回の続きから再開">
      <span class="rb-icon">↻</span>
      <span class="rb-text"><b>前回の続きから</b><small>Q${(loadProgress().qIndex || 0) + 1} / ${QUESTIONS.length} まで進めていました</small></span>
      <span class="rb-arrow">→</span>
    </button>` : ""}
    <section class="screen hero">
      <div class="hero-brand">ラブソング診断<span class="hero-brand-num">16</span></div>
      <h1 class="hero-title">
        <span class="ln"><span>あなたを</span></span>
        <span class="ln"><span class="grad">16の恋愛タイプ</span><span>から</span></span>
        <span class="ln"><span class="grad">ラブソング</span><span>診断。</span></span>
      </h1>
      <p class="hero-sub">あなたを表すラブソング。</p>
      <div class="hero-counter" aria-label="累計診断数">
        <span class="hc-dot" aria-hidden="true"></span>
        <span class="hc-text">すでに <b>${countSeed().toLocaleString("ja-JP")}人</b> が診断中</span>
      </div>
      <div class="hero-meta">
        <span class="hm">#16タイプ</span>
        <span class="hm">#ラブソング</span>
        <span class="hm">#完全無料</span>
      </div>
      <button class="btn primary big" id="heroCTA" data-mag onclick="go(renderBirth)">診断をはじめる</button>
      <button class="btn ghost" onclick="go(()=>renderGallery('landing'))">16タイプを見る</button>
      <p class="hero-share">診断結果は #ラブソング診断16 でシェア</p>
      <div class="hero-preview">
        <div class="hp-label">↓ こんな結果が出る</div>
        <div class="marquee"><div class="marquee-track">${marquee}</div></div>
      </div>
    </section>
    <div id="stickyCTA" class="sticky-cta" role="region" aria-label="診断をはじめる">
      <button class="btn primary" onclick="go(renderBirth)" data-mag>診断をはじめる →</button>
    </div>
  `);
  MX.hero();
  // ヒーロCTAが画面外に出たら、下部 sticky CTA bar をフェードイン
  const heroBtn = document.getElementById("heroCTA");
  const sticky = document.getElementById("stickyCTA");
  if (heroBtn && sticky && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(([e]) => {
      sticky.classList.toggle("show", !e.isIntersecting);
    }, { threshold: 0, rootMargin: "0px 0px -10% 0px" });
    io.observe(heroBtn);
  }
}

// ---- Step 0: 生年月日(iOS風 ホイールピッカー) ----
const BIRTH_ITEM_H = 44; // .wheel-item の高さ(px)。CSSと一致必須

function _wheelColHTML(id, vals, unit) {
  const items = vals.map(v => `<div class="wheel-item" data-v="${v}">${v}</div>`).join("");
  return `
    <div class="wheel-col-wrap">
      <div class="wheel-col" id="${id}" data-unit="${unit}">
        <div class="wheel-pad"></div>
        ${items}
        <div class="wheel-pad"></div>
      </div>
      <span class="wheel-unit">${unit}</span>
    </div>
  `;
}

function renderBirth() {
  const years  = []; for (let y = 1925; y <= 2025; y++) years.push(y);
  const months = []; for (let m = 1; m <= 12; m++) months.push(m);
  const days   = []; for (let d = 1; d <= 31; d++) days.push(d);

  show(`
    <section class="screen">
      <div class="step-tag">はじめに</div>
      <h2 class="title">生年月日を教えてください</h2>
      <p class="lead">あなたの世代に響く選曲に使います。</p>
      <div class="card-input">
        <label class="field-label">生年月日</label>
        <div class="wheel-picker" id="bw">
          <div class="wheel-mask" aria-hidden="true"></div>
          ${_wheelColHTML("wy", years,  "年")}
          ${_wheelColHTML("wm", months, "月")}
          ${_wheelColHTML("wd", days,   "日")}
        </div>
        <p class="note">スクロールして選択。結果カードには表示しません。</p>
        <p id="birthErr" class="err"></p>
      </div>
      <button class="btn primary" onclick="submitBirth()">次へ</button>
      <button class="btn ghost" onclick="go(renderLanding)">← トップに戻る</button>
    </section>
  `);

  // デフォルト位置:2000 / 1 / 1
  const def = (state.birth) || { y: 2000, m: 1, d: 1 };
  initWheel("wy", def.y, years);
  initWheel("wm", def.m, months);
  initWheel("wd", def.d, days);

  MX.screenIn();
}

function initWheel(id, value, vals) {
  const col = document.getElementById(id);
  if (!col) return;
  const idx = Math.max(0, vals.indexOf(value));
  // 初期スクロール位置 = idx × itemH(scroll-snap-align: center で中央に来る)
  col.scrollTop = idx * BIRTH_ITEM_H;
  updateWheelHighlight(col);
  // スクロール中央の項目をリアルタイムで強調
  col.addEventListener("scroll", () => {
    if (col._rafId) cancelAnimationFrame(col._rafId);
    col._rafId = requestAnimationFrame(() => updateWheelHighlight(col));
  }, { passive: true });
  // タップで一発スクロール(中央に持ってくる)
  col.addEventListener("click", e => {
    const item = e.target.closest(".wheel-item");
    if (!item) return;
    const items = col.querySelectorAll(".wheel-item");
    const i = Array.from(items).indexOf(item);
    if (i >= 0) col.scrollTo({ top: i * BIRTH_ITEM_H, behavior: "smooth" });
  });
}

function updateWheelHighlight(col) {
  const sel = Math.round(col.scrollTop / BIRTH_ITEM_H);
  col.querySelectorAll(".wheel-item").forEach((el, i) => {
    el.classList.toggle("on", i === sel);
    // 中央からの距離でフェード(±3まで段階)
    const d = Math.min(3, Math.abs(i - sel));
    el.style.opacity = (1 - d * 0.22).toFixed(2);
  });
}

function readWheel(id) {
  const col = document.getElementById(id);
  if (!col) return NaN;
  const idx = Math.round(col.scrollTop / BIRTH_ITEM_H);
  const item = col.querySelectorAll(".wheel-item")[idx];
  return item ? parseInt(item.dataset.v, 10) : NaN;
}

function submitBirth() {
  const y = readWheel("wy");
  const m = readWheel("wm");
  const d = readWheel("wd");
  const err = $("#birthErr");
  if (!y || !m || !d || y < 1900 || y > 2025 || m < 1 || m > 12 || d < 1 || d > 31) {
    err.textContent = "生年月日を正しく選択してください。";
    return;
  }
  // 月ごとの日数バリデーション(2月31日などNG)
  const maxD = new Date(y, m, 0).getDate();
  if (d > maxD) {
    err.textContent = `${m}月は${maxD}日までです。`;
    return;
  }
  state.birth = { y, m, d };
  renderGenres();
}

// ---- Step 0a: ジャンル選択(1〜5・Skip可) ----
function renderGenres() {
  const chips = GENRES.map(g =>
    `<button class="chip" data-g="${g}" onclick="toggleGenre(this)">${g}</button>`
  ).join("");
  show(`
    <section class="screen">
      <div class="step-tag">Step 1 / 3</div>
      <h2 class="title">好きな音楽ジャンルは?</h2>
      <p class="lead">1〜5つ選んでください(あとで選曲に反映)。</p>
      <div class="chips">${chips}</div>
      <div class="btn-row">
        <button class="btn ghost" onclick="renderArtists()">スキップ</button>
        <button class="btn primary" onclick="submitGenres()">次へ</button>
      </div>
      <button class="btn ghost" onclick="go(renderBirth)">← 戻る</button>
    </section>
  `);
  syncGenreUI();
  MX.screenIn();
}

function toggleGenre(el) {
  const g = el.dataset.g;
  const i = state.genres.indexOf(g);
  if (i >= 0) state.genres.splice(i, 1);
  else { if (state.genres.length >= 5) return; state.genres.push(g); }
  syncGenreUI();
}
function syncGenreUI() {
  document.querySelectorAll(".chip").forEach(c =>
    c.classList.toggle("on", state.genres.includes(c.dataset.g)));
}
function submitGenres() { renderArtists(); }

// ---- Step 0b: 好きなアーティスト3組(Skip可) ----
function renderArtists() {
  show(`
    <section class="screen">
      <div class="step-tag">Step 2 / 3</div>
      <h2 class="title">好きなアーティストは?</h2>
      <p class="lead">最大3組まで(思いつかなければスキップでOK)。<br>入力するとSpotifyから候補が出ます。</p>
      <div class="card-input">
        ${[1,2,3].map(i => `
          <div class="artist-ac">
            <input class="text-in artist-in" id="a${i}" type="text" placeholder="アーティスト ${i}" autocomplete="off" data-idx="${i}">
            <ul class="artist-sug" id="sug${i}" role="listbox" hidden></ul>
          </div>
        `).join("")}
      </div>
      <div class="btn-row">
        <button class="btn ghost" onclick="startQuiz()">スキップ</button>
        <button class="btn primary" onclick="submitArtists()">診断スタート</button>
      </div>
      <button class="btn ghost" onclick="go(renderGenres)">← 戻る</button>
    </section>
  `);
  initArtistAC();
  MX.screenIn();
}

// ---- Spotify Artist Search autocomplete ----
const _sugCache = new Map(); // クエリ → 候補配列(セッション内キャッシュ)
let _sugAbort = {};          // 入力idx → AbortController(連打時に古いリクエスト中断)
function initArtistAC() {
  document.querySelectorAll(".artist-in").forEach(inp => {
    const idx = inp.dataset.idx;
    const sug = document.getElementById("sug" + idx);
    let timer = null;
    inp.addEventListener("input", () => {
      clearTimeout(timer);
      const q = inp.value.trim();
      if (!q) { sug.hidden = true; sug.innerHTML = ""; return; }
      timer = setTimeout(() => fetchArtistSuggestions(q, sug, inp), 280);
    });
    inp.addEventListener("blur", () => {
      // クリックで sug を確定できるよう少し遅延
      setTimeout(() => { sug.hidden = true; }, 180);
    });
    inp.addEventListener("focus", () => {
      if (sug.children.length) sug.hidden = false;
    });
  });
}
// Spotify rate-limit 検出時、しばらく autocomplete を諦めるための時刻記録
let _spotifyRateLimitedUntil = 0;
function _isSpotifyRateLimited() {
  return Date.now() < _spotifyRateLimitedUntil;
}
function _markSpotifyRateLimited(ms) {
  _spotifyRateLimitedUntil = Date.now() + ms;
  console.warn(`[spotify] rate limited, suspending autocomplete for ${Math.round(ms/1000)}s`);
}
function _renderSugMessage(sugEl, msg) {
  sugEl.innerHTML = "";
  const li = document.createElement("li");
  li.className = "sug-msg";
  li.textContent = msg;
  sugEl.appendChild(li);
  sugEl.hidden = false;
}

async function fetchArtistSuggestions(query, sugEl, inp) {
  const cached = _sugCache.get(query);
  if (cached) { renderSuggestions(cached, sugEl, inp); return; }
  // rate limit 中なら静かに「手動入力OK」案内
  if (_isSpotifyRateLimited()) {
    _renderSugMessage(sugEl, `「${query}」のまま手動で入力できます ↓`);
    return;
  }
  const idx = inp.dataset.idx;
  if (_sugAbort[idx]) _sugAbort[idx].abort();
  const ac = new AbortController(); _sugAbort[idx] = ac;
  let token = await getSpotifyToken();
  if (!token) { sugEl.hidden = true; return; }
  try {
    const q = encodeURIComponent(query);
    let r;
    for (let attempt = 0; attempt < 2; attempt++) {
      r = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=artist&limit=5&market=JP`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ac.signal,
      });
      if (r.status === 401 && attempt === 0) {
        _spToken = null; _spTokenExp = 0;
        token = await getSpotifyToken();
        if (!token) return;
        continue;
      }
      if (r.status === 429 && attempt === 0) {
        await new Promise(rr => setTimeout(rr, 1500));
        continue;
      }
      break;
    }
    if (r.status === 429) {
      // 連続 retry でも 429 → 5分間 autocomplete無効化
      _markSpotifyRateLimited(5 * 60 * 1000);
      _renderSugMessage(sugEl, `「${query}」のまま手動で入力できます ↓`);
      return;
    }
    if (!r.ok) {
      console.warn(`[artist-sug] http ${r.status} for "${query}"`);
      return;
    }
    const data = await r.json();
    const items = (data.artists && data.artists.items) || [];
    const list = items.map(a => ({
      id: a.id,
      name: a.name,
      img: (a.images && a.images[2] && a.images[2].url)
        || (a.images && a.images[1] && a.images[1].url)
        || (a.images && a.images[0] && a.images[0].url)
        || null,
      followers: (a.followers && a.followers.total) || 0,
    }));
    _sugCache.set(query, list);
    renderSuggestions(list, sugEl, inp);
  } catch (e) {
    if (e.name !== "AbortError") console.warn("[artist-sug] failed:", e);
  }
}
// 安全な画像URL判定(Spotify CDN 等の https のみ許可 — javascript: スキーム XSS 防止)
function isSafeImgUrl(u) {
  if (typeof u !== "string") return false;
  try { const url = new URL(u); return url.protocol === "https:" || url.protocol === "http:"; }
  catch { return false; }
}
function renderSuggestions(list, sugEl, inp) {
  // 外部 API レスポンス(Spotify)を扱うため、innerHTML 補間は使わず DOM APIs で構築
  while (sugEl.firstChild) sugEl.removeChild(sugEl.firstChild);
  if (!list.length) { sugEl.hidden = true; return; }
  for (const a of list) {
    const li = document.createElement("li");
    li.className = "artist-sug-item";
    li.setAttribute("role", "option");
    li.dataset.name = a.name; // dataset は内部的にエスケープされる
    let imgEl;
    if (isSafeImgUrl(a.img)) {
      imgEl = document.createElement("img");
      imgEl.className = "asi-img";
      imgEl.src = a.img;
      imgEl.loading = "lazy";
      imgEl.alt = "";
    } else {
      imgEl = document.createElement("span");
      imgEl.className = "asi-img placeholder";
    }
    li.appendChild(imgEl);
    const nameEl = document.createElement("span");
    nameEl.className = "asi-name";
    nameEl.textContent = a.name; // textContent で HTML として解釈されない
    li.appendChild(nameEl);
    // クリックで input に正規名を入れる(mousedown は blur より早く発火)
    li.addEventListener("mousedown", e => {
      e.preventDefault();
      inp.value = a.name;
      // 後続の top-tracks fetch 用に Spotify ID を input に紐付けて保持
      inp.dataset.spotifyId = a.id || "";
      sugEl.hidden = true;
      while (sugEl.firstChild) sugEl.removeChild(sugEl.firstChild);
      if (navigator.vibrate) navigator.vibrate(8);
    });
    sugEl.appendChild(li);
  }
  sugEl.hidden = false;
}

function submitArtists() {
  const pairs = ["a1", "a2", "a3"].map(id => {
    const el = $("#" + id);
    return { name: (el && el.value || "").trim(), spotifyId: (el && el.dataset.spotifyId) || "" };
  }).filter(p => p.name);
  state.artists   = pairs.map(p => p.name);          // 既存ロジック互換(isFavArtist 等で使用)
  state.artistIds = pairs.map(p => p.spotifyId).filter(Boolean); // 動的 top-tracks fetch 用
  // 質問中に裏で fetch を走らせる。失敗しても診断は通常通り進行
  prefetchDynamicSongs();
  startQuiz();
}

// ---- 好きアーティストの top tracks を動的 pool に追加 ----
// Step 0b submit 後に裏で Spotify /v1/artists/{id}/top-tracks を取得し
// state.dynamicSongs に貯める。重複(既存 SONGS とのタイトル一致)は除外。
// 結果ページの recommend() は SONGS + dynamicSongs を統合して10曲抽出。
state.dynamicSongs = [];
async function prefetchDynamicSongs() {
  if (!state.artistIds || !state.artistIds.length) return;
  const token = await getSpotifyToken();
  if (!token) return; // 取れなければ静的pool だけで運用
  // 既存 SONGS との重複判定キー(正規化:小文字+記号除去)
  const seen = new Set(SONGS.map(s => `${normArtist(s.title)}::${normArtist(s.artist)}`));
  const collected = [];
  // 注:/v1/artists/{id}/top-tracks は Spotify 2024.11 公開アクセス制限で 403 になる。
  //     代替で /v1/search?q=artist:NAME&type=track を使い、自前で artist.id 一致フィルタ
  await Promise.all(state.artistIds.map(async (aid, i) => {
    try {
      const aname = state.artists[i] || "";
      if (!aname) return;
      const q = encodeURIComponent(`artist:"${aname}"`);
      // Spotify 仕様変更で limit>10 だと 400 が返ることがあるため安全策で 10 固定
      const r = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=10&market=JP`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const data = await r.json();
      const tracks = (data.tracks && data.tracks.items) || [];
      // 同名別アーティスト混入防止:必ず ID 一致のものだけ採用
      const mine = tracks.filter(t => t && t.artists && t.artists.some(a => a.id === aid));
      // popularity 降順で上位 10 件
      mine.sort((x, y) => (y.popularity || 0) - (x.popularity || 0));
      for (const t of mine.slice(0, 10)) {
        const title = t.name;
        const artist = (t.artists.find(a => a.id === aid) || t.artists[0]).name;
        const key = `${normArtist(title)}::${normArtist(artist)}`;
        if (seen.has(key)) continue; // 既存 SONGS と重複 → 静的スコアを優先
        seen.add(key);
        // スコア:全タイプ均等 5、isFavArtist の +5 boost で十分競争可能
        const scores = {};
        ["バイブス警察","運命マジシャン","進撃のロマンチスト","一途ペンギン",
         "ヤキモチモンスター","推し活ベビー","チル仙人","慎重うさぎ",
         "同志の虎","マブダチエイリアン","ミステリアス狼","ド直球ザウルス",
         "ときめきパパラッチ","情熱ラブゾンビ","沼っくま","ピュアエンジェル"]
          .forEach(k => scores[k] = 5);
        collected.push({
          title, artist,
          genre: "J-POP", // 仮置き(動的曲は genreBonus 対象外でも問題ない)
          scores,
          _dynamic: true,
        });
      }
    } catch (_) { /* graceful */ }
  }));
  state.dynamicSongs = collected;
}

// ---- Step 1: 15問 ----
function startQuiz() {
  state.qIndex = 0;
  state.answers = [];
  state.scores = {};
  TYPES.forEach(t => state.scores[t.key] = 0);
  saveProgress();
  renderQuestion();
}

// 16personalities 式の「そう思う⇔思わない」スケール(7段階)
function renderQuestion() {
  const i = state.qIndex;
  const q = QUESTIONS[i];
  const pct = Math.round((i / QUESTIONS.length) * 100);
  const remain = QUESTIONS.length - i;
  const prev = state.answers[i];   // 戻ってきた時に選択を復元
  // 7つの円: 0,1,2=そう思う側(暖色) / 3=中立 / 4,5,6=思わない側(寒色)。端ほど大きい
  const dots = SCALE_VALUES.map((v, idx) => {
    const dist = Math.abs(3 - idx);                 // 中心からの距離 0..3
    const side = idx < 3 ? "agree" : idx > 3 ? "dis" : "neu";
    const cls = `dot d${dist} ${side}${prev === idx ? " sel" : ""}`;
    // SR用ラベル: 数値だけだと「3」「2」のみ読まれて意味不明なので、回答の含意を明示
    const SR_LABELS = ["とてもそう思う", "そう思う", "少しそう思う", "どちらでもない", "少し思わない", "思わない", "全く思わない"];
    return `<button class="${cls}" role="radio" aria-checked="${prev === idx}" aria-label="${SR_LABELS[idx]}" onclick="answer(${idx})"></button>`;
  }).join("");
  // 残り問数に応じた応援メッセージで「あと少し感」を醸成
  const cheer = remain >= 20 ? "じっくり選んで" :
                remain >= 10 ? "いいペース!" :
                remain >= 5  ? "もうすぐ判定!" :
                remain >= 2  ? "あと少し!" :
                                "ラスト!";
  show(`
    <section class="screen quiz" aria-label="質問 ${i + 1} / ${QUESTIONS.length}">
      <div class="progress" role="progressbar" aria-valuenow="${i}" aria-valuemin="0" aria-valuemax="${QUESTIONS.length}" aria-label="診断進捗">
        <div class="bar" style="width:${pct}%"></div>
        <div class="progress-spark" style="left:${pct}%" aria-hidden="true"></div>
      </div>
      <div class="qhead">
        <div class="qcount"><span class="qc-q">Q</span><b>${i + 1}</b><span>/ ${QUESTIONS.length}</span></div>
        <div class="qremain"><span class="qr-num">あと${remain}問</span><span class="qr-cheer">${cheer}</span></div>
      </div>
      <div class="qcard">
        <h2 class="qtext">${q.s}</h2>
      </div>
      <div class="scale" role="radiogroup" aria-label="この設問に対するあなたの考え">
        <div class="scale-labels">
          <span class="scale-end agree">${SCALE_LABEL_LEFT}</span>
          <span class="scale-end dis">${SCALE_LABEL_RIGHT}</span>
        </div>
        <div class="dots">${dots}</div>
      </div>
      <button class="back" onclick="goBack()">← ${i > 0 ? '戻る' : 'アーティスト選択に戻る'}</button>
    </section>
  `);
  // クイズの入場はCSSアニメで実装(GSAPに依存させない=回答操作が絶対に固まらない)
}

let _answering = false;
function answer(pos) {
  if (_answering) return;
  if (state.qIndex >= QUESTIONS.length) return; // wipe遷移中の駆け込みクリックで answers が溢れるのを防止
  _answering = true;
  state.answers[state.qIndex] = pos;
  // 触覚フィードバック(対応モバイルのみ)— 中立は無音、外側ほど強め
  const strengths = [16, 12, 8, 0, 8, 12, 16];
  if (navigator.vibrate && strengths[pos]) navigator.vibrate(strengths[pos]);
  const dots = document.querySelectorAll(".dot");
  dots.forEach((d, idx) => d.classList.toggle("sel", idx === pos));
  MX.dotBurst(dots[pos]);
  const screen = document.querySelector(".quiz");
  setTimeout(() => {
    if (screen) screen.classList.add("q-leave");
    setTimeout(() => {
      _answering = false;
      state.qIndex++;
      saveProgress(); // 各回答ごとに進捗保存(K: resume対応)
      if (state.qIndex >= QUESTIONS.length) go(finishQuiz);
      else renderQuestion();
    }, 170);
  }, 220);
}
function goBack() {
  if (state.qIndex > 0) { state.qIndex--; saveProgress(); renderQuestion(); }
  else { go(renderArtists); }  // Q1から戻る場合はアーティスト選択へ
}

// 各タイプの「主役/脇役で出現する全質問の重みの絶対値合計 × 最大回答倍率」=理論上の最大点。
// これで割って正規化すると、主役質問数の多寡による構造的バイアスが消える。
// abs(w) で算出する理由:逆方向重み(-1)も最大スコアに寄与する(同意=減点 / 反対=加点)。
const MAX_SCALE = Math.max(...SCALE_VALUES); // = 3
const TYPE_MAX_RAW = (() => {
  const m = {};
  TYPES.forEach(t => m[t.key] = 0);
  QUESTIONS.forEach(q => { for (const k in q.w) m[k] = (m[k] || 0) + Math.abs(q.w[k]) * MAX_SCALE; });
  return m;
})();

function finishQuiz() {
  // 集計: 各設問の回答位置 → スコア倍率 × タイプ重み
  TYPES.forEach(t => state.scores[t.key] = 0);
  state.answers.forEach((pos, qIdx) => {
    const q = QUESTIONS[qIdx];
    if (!q || pos == null) return; // 念のため: スパース/オーバーラン保護
    const val = SCALE_VALUES[pos];
    for (const k in q.w) state.scores[k] += q.w[k] * val;
  });
  // ★正規化スコア:各タイプの実スコアを「そのタイプの理論最大点」で割る(=−1..+1)
  //   → 主役質問数が違っても公平に比較できる。判定にはこれを使う。
  //   state.scores(生スコア)も traits/系判定で参照されるためそのまま保持。
  const norm = {};
  TYPES.forEach(t => {
    const max = TYPE_MAX_RAW[t.key] || 1; // ゼロ除算ガード
    norm[t.key] = (state.scores[t.key] || 0) / max;
  });
  state.normScores = norm;

  // 最高点 → 同点は TIE_PRIORITY で確定
  const top1 = Math.max(...Object.values(norm));
  const top = TYPES.map(t => t.key).filter(k => norm[k] === top1);
  state.result = top.length === 1 ? top[0]
    : TIE_PRIORITY.find(k => top.includes(k));
  // 「系」を判定:各系の正規化スコア平均が最大のもの(各系のタイプ数差も吸収)
  let bestKei = null, bestAvg = -Infinity;
  for (const name in KEI) {
    const arr = KEI[name].types;
    const avg = arr.reduce((s, k) => s + (norm[k] || 0), 0) / arr.length;
    if (avg > bestAvg) { bestAvg = avg; bestKei = name; }
  }
  state.kei = bestKei;
  bumpMyCount(); // F: 累計診断数(ローカル分)をインクリメント
  clearProgress(); // K: 結果到達でresume用ステートをクリア
  // 判定中ローディング演出(1.0s)を挟んで結果ページへ。
  // ロジック自体は瞬時に終わるが、ユーザーが「ちゃんと計算してくれた」感を持てる
  // よう、心理的にちょっと「待つ」体験を入れる。100万人向けの安心感UI。
  renderJudging();
  // 850ms 経過時点で .leaving クラスを付けて fadeOut → 200ms後に結果ページへ
  setTimeout(() => {
    const j = document.querySelector(".judging");
    if (j) j.classList.add("leaving");
  }, 850);
  setTimeout(() => renderWrapped(), 1100);
}

// 判定中の画面(クイズ完了 → 結果表示の間に1.5s表示)
function renderJudging() {
  show(`
    <section class="screen judging" role="status" aria-live="polite" aria-label="診断中">
      <div class="jd-bg" aria-hidden="true">
        <span class="jd-orb jd-o1"></span>
        <span class="jd-orb jd-o2"></span>
        <span class="jd-orb jd-o3"></span>
      </div>
      <div class="jd-content">
        <div class="jd-spinner" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>
        <div class="jd-title">あなたの<br>恋愛タイプを<br>判定中…</div>
        <div class="jd-sub">${QUESTIONS.length}問の回答から、<br>16タイプ × 系 = 64パターンを照合中</div>
      </div>
    </section>
  `);
}

// hex(#RRGGBB) を相対量で暗くした rgb 文字列(color-mix の代替。html2canvas が color-mix() を解釈できないため)
function darken(hex, keep = 0.45) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgb(${Math.round(r * keep)}, ${Math.round(g * keep)}, ${Math.round(b * keep)})`;
}

// ---- Step 2+3: Spotify Wrapped 風スクロール結果体験 ----
// フルビューポートのパネルが scroll-snap で吸い付き、
// IntersectionObserver で要素が順番にせり上がって表示される。
function renderWrapped() {
  _updateDocTitle();
  const t = TYPE_MAP[state.result];
  state.lastRecommend = recommend(state.result);
  const comp = t.compatible
    .map((c, i) => `<span class="w-chip reveal" style="--d:${i * .12}s">${c}</span>`).join("");

  // 各曲フルスクリーン panel(scroll-snap で1曲1ページ・スクショ前提)
  const songPanels = state.lastRecommend.map((s, i) => {
    const q = encodeURIComponent(`${s.title} ${s.artist}`);
    const spotify = `https://open.spotify.com/search/${q}`;
    const apple = `https://music.apple.com/jp/search?term=${q}`;
    const yt = `https://music.youtube.com/search?q=${q}`;
    const safeT_ = (s.title || "").replace(/'/g, "\\'");
    const safeA_ = (s.artist || "").replace(/'/g, "\\'");
    return `
      <section class="panel p-song" data-song-id="${s.title}|||${s.artist}">
        <div class="ps-num"><span class="ps-num-n">${i + 1}</span><span class="ps-num-of">/10</span></div>
        <div class="ps-card reveal">
          <button class="ps-play song-play" type="button" style="--jc:${t.color}"
            aria-label="30秒試聴"
            onclick="togglePreview(this, '${safeT_}', '${safeA_}')">
            <span class="sp-jacket" aria-hidden="true"></span>
            <span class="sp-overlay" aria-hidden="true"></span>
            <span class="sp-icon" aria-hidden="true"></span>
          </button>
          <div class="ps-meta">
            <span class="ps-genre">${s.genre}</span>
            ${(() => { const m = moodOf(s); return m ? `<span class="ps-mood" style="--mc:${m.color}">${m.emoji} ${m.name}</span>` : ''; })()}
            ${isFavArtist(s.artist) ? '<span class="ps-fav-badge">♥ あなたの好きなアーティスト</span>' : ''}
            <div class="ps-title">${s.title}</div>
            <div class="ps-artist">${s.artist}</div>
          </div>
          <div class="ps-reason"><span class="ps-reason-label">あなたの ${t.parody} に刺さる理由</span><span class="ps-reason-text">${getReason(s, state.result)}</span></div>
          <div class="ps-services">
            <a class="ps-svc sp" href="${spotify}" target="_blank" rel="noopener" aria-label="Spotifyでフル尺">Spotify</a>
            <a class="ps-svc am" href="${apple}" target="_blank" rel="noopener" aria-label="Apple Musicでフル尺">Apple</a>
            <a class="ps-svc yt" href="${yt}" target="_blank" rel="noopener" aria-label="YouTubeでフル尺">YouTube</a>
          </div>
        </div>
      </section>
    `;
  }).join("");

  const typeIdx = TYPES.findIndex(x => x.key === state.result) + 1;
  const typeNo  = typeIdx > 0 ? `No. ${String(typeIdx).padStart(2, "0")} / 16` : "";

  app().innerHTML = `
    <div class="wrapped" id="wrapped" style="--c:${t.color};--ac:${t.accent}">

      <!-- 結果リビール:タイプ露出前の「あなたは…」溜め -->
      <section class="panel p-reveal" style="background:
        radial-gradient(120% 100% at 50% 30%, color-mix(in srgb, var(--c) 28%, #1a0a18 72%), #1a0a18 70%)">
        <div class="reveal-stars" aria-hidden="true">
          <span class="rs s1"></span><span class="rs s2"></span><span class="rs s3"></span>
          <span class="rs s4"></span><span class="rs s5"></span><span class="rs s6"></span>
          <span class="rs s7"></span><span class="rs s8"></span>
          <span class="rs s9"></span><span class="rs s10"></span><span class="rs s11"></span>
          <span class="rs s12"></span>
        </div>
        <div class="reveal-aurora" aria-hidden="true">
          <span class="ra ra1" style="background:var(--c)"></span>
          <span class="ra ra2" style="background:var(--ac)"></span>
        </div>
        <div class="reveal-stack">
          <div class="reveal rv-tag" style="--d:.05s">${QUESTIONS.length}問、おつかれさま。</div>
          <h1 class="reveal rv-you" style="--d:.25s">あなたは<span class="rv-ellipsis"><i>.</i><i>.</i><i>.</i></span></h1>
          <div class="reveal rv-sub" style="--d:.6s">あなたを最も表す<br><b>ラブソング型</b>は</div>
          <div class="reveal rv-dots" style="--d:.9s" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
        </div>
        <div class="reveal scroll-hint light pulse big" style="--d:1.2s">↓ 下にスクロール</div>
      </section>

      <section class="panel p-type" style="background:
        radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, var(--c) 80%, #fff 20%) 0%, var(--c) 38%, color-mix(in srgb, var(--c) 50%, #1a0a18 50%) 100%)">
        <div class="hero-card reveal">
          <span class="sticker s1"></span><span class="sticker s2"></span><span class="sticker s3"></span>
          <span class="sticker s4"></span><span class="sticker s5"></span>

          <div class="hc-topline">
            <span class="hc-brand">ラブソング診断16</span>
            <span class="hc-no">${typeNo}</span>
          </div>

          <div class="hc-kei-ribbon"><span class="hc-kei-text">${state.kei || ""}</span></div>

          <div class="hc-mascot-frame">
            <span class="hc-halo" aria-hidden="true"></span>
            <span class="hc-sparkle sp1" aria-hidden="true">✦</span>
            <span class="hc-sparkle sp2" aria-hidden="true">✦</span>
            <span class="hc-sparkle sp3" aria-hidden="true">♡</span>
            <div class="type-mascot">${mascotSVG(t.parody)}</div>
          </div>

          <div class="hc-type-label">正式タイプ — ${t.type}</div>
          <h1 class="w-parody">${parodyBR(t.parody)}</h1>

          <div class="hc-divider" aria-hidden="true"><span>♡</span></div>
          <p class="hc-catch handwrite">「${t.tagline}」</p>

          <div class="hc-footline">あなたの定義 — ${t.definition}</div>
        </div>
      </section>

      <section class="panel p-desc">
        <div class="reveal w-section-label"><span class="wsl-bar"></span><span class="wsl-text">あなたの恋愛</span></div>
        <p class="reveal w-desc" style="--d:.15s">${t.description}</p>
      </section>

      <section class="panel p-strengths">
        <div class="reveal w-section-label"><span class="wsl-bar"></span><span class="wsl-text">恋愛の強み</span></div>
        <ul class="w-list">
          ${t.strengths.map((s, i) => `<li class="reveal" style="--d:${.1 + i * .12}s"><span class="li-no">0${i + 1}</span><span class="li-text">${s}</span></li>`).join("")}
        </ul>
        <div class="reveal w-loved" style="--d:.5s"><span class="w-loved-label">愛されポイント</span>${t.loved}</div>
      </section>

      <section class="panel p-ideal">
        <div class="reveal w-section-label"><span class="wsl-bar"></span><span class="wsl-text">こんな恋がしたい</span></div>
        <p class="reveal w-ideal" style="--d:.12s">${t.ideal}</p>
        <div class="reveal w-aruaru-label" style="--d:.3s">${t.parody} あるある</div>
        <div class="w-aruaru">
          ${t.aruaru.map((a, i) => `<span class="aru reveal" style="--d:${.4 + i * .12}s">${a}</span>`).join("")}
        </div>
      </section>

      <section class="panel p-compat">
        <div class="reveal w-section-label"><span class="wsl-bar"></span><span class="wsl-text">16タイプ相性ピラミッド</span></div>
        <p class="reveal compat-lead" style="--d:.05s">上に行くほど<b>相性◎</b>。あなた以外の15タイプを並べました。</p>
        <div class="reveal compat-pyramid" style="--d:.1s">${buildPyramidHTML()}</div>
        <button class="btn share reveal" style="--d:.5s" onclick="shareCompat()">気になる人に送って相性チェック</button>
      </section>

      <section class="panel p-songs-lead">
        <div class="reveal w-section-label"><span class="wsl-bar"></span><span class="wsl-text">そんなあなたへ</span></div>
        <h2 class="reveal songs-leadhead" style="--d:.2s">あなたにぴったりの<br><b class="g">ラブソング10曲</b>レコメンド。</h2>
        <p class="reveal mock-note" style="--d:.5s">スワイプで1曲ずつ表示<br>各曲タップで30秒試聴</p>
        <div class="reveal scroll-hint" style="--d:.7s">↓ スワイプで聴く</div>
      </section>

      ${songPanels}

      <section class="panel p-songs-summary">
        <div class="reveal w-section-label"><span class="wsl-bar"></span><span class="wsl-text">10曲まとめ</span></div>
        <h2 class="reveal w-songs-head">あなたのラブソング10曲</h2>
        <div class="reveal mood-breakdown" style="--d:.15s" id="moodBreakdown">${buildMoodBreakdownHTML()}</div>
        <div class="songlist" id="songlist">${buildSongsHTML()}</div>
        <button class="btn primary reveal" data-mag style="--d:.4s" onclick="reshuffleSongs()">別の10曲を見る ↻</button>
      </section>

      <section class="panel p-share">
        <div class="reveal share-card" style="background:
          linear-gradient(165deg, ${t.color}, ${darken(t.color, 0.45)})">
          <div class="sc-deco" aria-hidden="true">
            <span class="sc-d sc-d1">✦</span>
            <span class="sc-d sc-d2">·</span>
            <span class="sc-d sc-d3">✧</span>
            <span class="sc-d sc-d4">✦</span>
            <span class="sc-d sc-d5">·</span>
            <span class="sc-d sc-d6">✧</span>
          </div>
          <div class="sc-brand">ラブソング診断<span class="sc-brand-n">16</span></div>
          <div class="sc-mascot">${mascotSVG(t.parody)}</div>
          <div class="sc-kei">${state.kei || ""}</div>
          <div class="sc-parody">${parodyBR(t.parody)}</div>
          <div class="sc-tagline handwrite"><span class="sc-q-open">"</span>${t.tagline}<span class="sc-q-close">"</span></div>
          <div class="sc-divider" aria-hidden="true"></div>
          <div class="sc-foot">あなたは何タイプ?<br><span class="sc-url">lovesong-type16.vercel.app</span></div>
        </div>
        <!-- [グループA] 主要アクション:画像保存(目立たせる) -->
        <div class="share-group share-primary reveal" style="--d:.2s">
          <button class="btn save" data-mag onclick="savePNG(event)">画像で保存</button>
          <button class="btn stories" data-mag onclick="saveStoriesPNG(event)" aria-label="Stories向け縦長画像">Stories用(9:16)</button>
        </div>
        <!-- [グループB] SNSシェア:5サービス並列 -->
        <div class="share-group share-sns reveal" style="--d:.3s">
          <div class="share-group-label">SNSでシェア</div>
          <div class="share-grid">
            <button class="btn sns ig"   onclick="shareTo('instagram', event)" aria-label="Instagram">Instagram</button>
            <button class="btn sns tt"   onclick="shareTo('tiktok', event)"    aria-label="TikTok">TikTok</button>
            <button class="btn sns br"   onclick="shareTo('bereal', event)"    aria-label="BeReal">BeReal</button>
            <button class="btn sns x"    onclick="shareX()"                    aria-label="Xでポスト">X</button>
            <button class="btn sns line" onclick="shareLINE()"                 aria-label="LINEで送る">LINE</button>
          </div>
        </div>
        <!-- [グループC] ナビゲーション:図鑑/TOP/再診断 -->
        <div class="share-group share-nav reveal" style="--d:.4s">
          <button class="btn ghost" onclick="go(()=>renderGallery('result'))">16タイプ図鑑を見る</button>
          <button class="btn ghost" onclick="go(renderLanding)">↑ TOPへ戻る</button>
          <button class="btn restart" onclick="restartDiagnosis()" aria-label="もう一度診断する">↻ もう一度診断する</button>
        </div>
      </section>

    </div>
  `;
  observeReveals();   // 本文リビールは必ず表示(CSS+IO)
  MX.result();        // GSAPは飾り(文字/カウント/バー/視差/紙吹雪)だけ
  MX.magnetize(document);
  prefetchSongMeta(); // ジャケ写/preview を一括取得して各曲行に流し込む
  document.documentElement.classList.add("snap-mode"); // scroll-snap 結果ページ限定
  injectPanelWatermarks(t.parody); // 各panelに薄いマスコット透かし(p-typeは除く)
}

// 各 result panel の背景に半透明マスコット透かしを追加 — タイプ世界観で全画面包む演出
function injectPanelWatermarks(parody) {
  document.querySelectorAll(".wrapped .panel").forEach((p) => {
    if (p.classList.contains("p-type")) return;
    if (p.classList.contains("p-share")) return;
    if (p.querySelector(".panel-watermark")) return;
    const w = document.createElement("div");
    w.className = "panel-watermark";
    w.setAttribute("aria-hidden", "true");
    w.innerHTML = mascotSVG(parody);
    p.appendChild(w);
  });
}

function scrollWrappedTop() {
  MX.scrollTo(document.querySelector(".p-intro") || 0);
}

// ---- 16タイプ図鑑(探索・再訪の導線。from = "landing" | "result") ----
function renderGallery(from) {
  const cards = TYPES.map(t => `
    <button class="g-card" style="--c:${t.color}" onclick="go(()=>renderTypeDetail('${t.key}','${from}'))">
      <div class="g-mascot">${mascotSVG(t.parody)}</div>
      <div class="g-parody">${parodyBR(t.parody)}</div>
    </button>`).join("");
  const back = from === "result"
    ? `<button class="btn ghost" onclick="go(renderWrapped)">← 結果に戻る</button>`
    : `<button class="btn ghost" onclick="go(renderLanding)">← トップに戻る</button>`;
  show(`
    <section class="screen gallery">
      <div class="step-tag">16タイプ図鑑</div>
      <h2 class="title">恋愛タイプ図鑑</h2>
      <p class="lead">全16タイプ。あなたはどれ?友達はどれ?</p>
      <div class="g-grid">${cards}</div>
      ${back}
    </section>
  `);
  MX.galleryIn();
}

// 図鑑から個別タイプの読み物(診断せずに閲覧)
function renderTypeDetail(key, from) {
  const t = TYPE_MAP[key];
  const comp = t.compatible.map(c => `<span class="w-chip">${c}</span>`).join("");
  show(`
    <section class="screen type-detail">
      <div class="td-hero" style="background:
        linear-gradient(165deg, var(--c), color-mix(in srgb, var(--c) 45%, #000 55%));--c:${t.color}">
        <div class="td-mascot">${mascotSVG(t.parody)}</div>
        <div class="td-type">${t.type}</div>
        <h1 class="td-parody">${parodyBR(t.parody)}</h1>
        <p class="td-tagline">「${t.tagline}」</p>
      </div>
      <div class="td-body" style="--c:${t.color}">
        <p class="td-desc">${t.description}</p>
        <div class="td-section-label">恋愛の強み</div>
        <ul class="w-list">${t.strengths.map((s, i) => `<li><span class="li-no">0${i + 1}</span>${s}</li>`).join("")}</ul>
        <div class="td-section-label">相性◎</div>
        <div class="w-chips">${comp}</div>
        <div class="td-section-label">相性△</div>
        <div class="w-chips">${t.cautionMatch.map(c => `<span class="w-chip ca">${c}</span>`).join("")}</div>
        <button class="btn primary" data-mag onclick="go(renderBirth)">自分の診断をする →</button>
        <button class="btn ghost" onclick="go(()=>renderGallery('${from}'))">← 図鑑に戻る</button>
      </div>
    </section>
  `);
  MX.typeDetailIn();
}

// 公開URL(本番固定)。シェア文言には必ず含めて流入を担保する。
const SITE_URL = "https://lovesong-type16.vercel.app/";

// X(旧Twitter)向け:文字数を抑えて、タイプ名+tagline+URLで完結。
// 「自虐じゃない口語」を意識(「○○だった笑」「出た」)。
function shareTextX() {
  const t = TYPE_MAP[state.result];
  const kei = state.kei ? state.kei : "";
  return `「${kei}${t.parody}」だった…\n${t.tagline}\n\nあなたは何タイプ?▼\n${SITE_URL}`;
}
// LINE/汎用(Web Share API)向け:URLを明示して、リンクで流入させる。
function shareText() {
  const t = TYPE_MAP[state.result];
  const kei = state.kei ? state.kei : "";
  return `「${kei}${t.parody}」だった…\n${t.tagline}\n\nあなたの恋愛タイプは?\n${SITE_URL}`;
}
function shareX() {
  navigator.vibrate?.(16);
  const url = "https://twitter.com/intent/tweet?text=" +
    encodeURIComponent(shareTextX()) + "&hashtags=" + encodeURIComponent("ラブソング診断16");
  window.open(url, "_blank", "noopener");
}
function shareLINE() {
  navigator.vibrate?.(16);
  const url = "https://line.me/R/msg/text/?" + encodeURIComponent(shareText());
  window.open(url, "_blank", "noopener");
}

async function shareCompat() {
  navigator.vibrate?.(20);
  const t = TYPE_MAP[state.result];
  const text = `私「${t.parody}」だった!\n相性チェックしよ?\n${SITE_URL}`;
  const payload = { title: "ラブソング診断16", text, url: SITE_URL };
  // 1) Web Share API(対応端末)
  if (navigator.share && (navigator.canShare?.(payload) ?? true)) {
    try {
      await navigator.share(payload);
      return;
    } catch (e) {
      if (e?.name === "AbortError") return; // ユーザーが共有シートを閉じた
      // それ以外(NotAllowedError等)は fallback へ
    }
  }
  // 2) clipboard fallback
  try {
    await navigator.clipboard.writeText(text);
    alert("メッセージをコピーしました。気になる人に送ってみて。");
  } catch {
    // 3) clipboard も拒否(古いブラウザ)→ プロンプトで手動コピー誘導
    prompt("以下のメッセージをコピーして送ってね:", text);
  }
}

// パネルが見えたら .in を付与 → reveal 要素がせり上がる
function observeReveals() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("in"); });
  }, { threshold: 0.18 });
  document.querySelectorAll(".panel").forEach(p => io.observe(p));
}

// ---- Step 3: 10曲レコメンド(モック) ----
// アーティスト名の正規化(大文字小文字/スペース/記号/ピリオド差を吸収)
// 「Mrs. GREEN APPLE」≒「mrs green apple」≒「mrsgreenapple」、
// 「YOASOBI」≒「ヨアソビ」までは完全には無理だが、英字+一般的な揺れは吸収する
function normArtist(s) {
  return (s || "").toLowerCase()
    .replace(/[\s.,\-_'"’、・。!?!?&\(\)（）\[\]【】]/g, "")
    .trim();
}
function isFavArtist(songArtist) {
  if (!state.artists || !state.artists.length) return false;
  const n = normArtist(songArtist);
  if (!n) return false;
  return state.artists.some(a => {
    const an = normArtist(a);
    if (!an) return false;
    return n === an || n.includes(an) || an.includes(n);
  });
}

// ---- リスナー層(cluster)推定 ----
// ユーザーの「好きアーティスト」+「ジャンル選択」から推定リスナー層を多数決。
// recommend() で曲が一致clusterに属していたら +3.0 boost。
// 「ミセスファンに Kroi 出ない」「K-POPファンにアニソン出ない」を構造解決。
function userClusters() {
  if (typeof ARTIST_CLUSTERS === "undefined") return {};
  const counts = {};
  const AC = ARTIST_CLUSTERS;
  // 好きアーティストからの投票(weight 1.0)
  (state.artists || []).forEach(name => {
    if (!name) return;
    // 完全一致を最優先(辞書キー直接ヒット)
    if (AC[name]) {
      AC[name].forEach(c => counts[c] = (counts[c] || 0) + 1.0);
      return;
    }
    // 正規化マッチでフォールバック(typo救済)
    const n = normArtist(name);
    if (!n) return;
    for (const [artist, clusters] of Object.entries(AC)) {
      const an = normArtist(artist);
      if (n === an || an.includes(n) || n.includes(an)) {
        clusters.forEach(c => counts[c] = (counts[c] || 0) + 1.0);
        break;
      }
    }
  });
  // ジャンル選択からの補助投票(weight 0.5。アーティスト辞書スキップ層に効かせる)
  if (typeof GENRE_TO_CLUSTERS !== "undefined") {
    (state.genres || []).forEach(g => {
      (GENRE_TO_CLUSTERS[g] || []).forEach(c => counts[c] = (counts[c] || 0) + 0.5);
    });
  }
  return counts;
}
// 曲がどのリスナー層に属するかの判定。
// 第一根拠はアーティスト(ARTIST_CLUSTERS)だが、ジャンルが明確にcluster
// と紐づく場合は自動で補完する(2026-06-22 監査:RADWIMPS「前前前世」が
// genre=アニソン なのに ANISON_VOCALO に boost されてない問題を解消)。
const _GENRE_AUTO_CLUSTER = {
  "アニソン":   ["ANISON_VOCALO"],
  "ボカロ":     ["ANISON_VOCALO"],
  "シティポップ": ["CITYPOP"],
  "K-POP":      ["KPOP"],
  "洋楽ポップ":   ["WPOP"],
  "EDM/ダンス":  []
};
function songClusters(song) {
  if (typeof ARTIST_CLUSTERS === "undefined") return [];
  const fromArtist = ARTIST_CLUSTERS[song.artist] || [];
  const fromGenre = _GENRE_AUTO_CLUSTER[song.genre] || [];
  if (!fromGenre.length) return fromArtist;
  // 集合演算で重複除去
  const merged = new Set([...fromArtist, ...fromGenre]);
  return [...merged];
}
function clusterMatchScore(song, userClus) {
  // user の cluster と song の cluster の重なりに応じて bonus。
  // 強い重なり(投票数高)ほど大きく振る:max +3.0
  if (!userClus || !Object.keys(userClus).length) return 0;
  const sc = songClusters(song);
  if (!sc.length) return 0;
  let maxVote = 0;
  for (const c of sc) {
    if (userClus[c] && userClus[c] > maxVote) maxVote = userClus[c];
  }
  if (maxVote <= 0) return 0;
  // 1票で +2.0、2票で +2.7、3票以上で +3.0(飽和)
  return Math.min(3.0, 1.5 + maxVote * 0.6);
}

// ---- Mood:5クラスタへの自動分類(既存 score パターンから無料で算出)----
// 手動タグ付け不要・全曲に即適用。recommend は触らず、純粋に説明性UP用。
// バランス調整:王道ラブソングは複数タイプで高スコアになるため、moodクラスタが偏らないよう
// 「キラキラ」を絞り、並走/友達/一途系は「穏やか」に統合(2026-06-22 監査結果)。
const MOOD_DEFS = [
  { name: "切ない",   types: ["沼っくま", "進撃のロマンチスト", "ミステリアス狼"], color: "#7C5CFF", emoji: "🌙" },
  { name: "エモい",   types: ["情熱ラブゾンビ", "ヤキモチモンスター", "ド直球ザウルス"], color: "#FF4D6D", emoji: "🔥" },
  { name: "前向き",   types: ["バイブス警察", "ときめきパパラッチ", "推し活ベビー"], color: "#FF8FB1", emoji: "✨" },
  { name: "穏やか",   types: ["チル仙人", "慎重うさぎ", "マブダチエイリアン", "同志の虎"], color: "#5CB8C4", emoji: "☁️" },
  { name: "キラキラ", types: ["ピュアエンジェル", "運命マジシャン", "一途ペンギン"], color: "#FFB347", emoji: "💖" },
];
function moodOf(song) {
  if (!song || !song.scores) return null;
  // mood内タイプ数で正規化した「平均スコア」で判定。
  // 合計値だと「穏やか(5タイプ)」「キラキラ(2タイプ)」のように所属数の多い mood が
  // 機械的に勝ってしまい、過半の曲が同じ mood に集中する(2026-06-22 監査で発覚)。
  // 平均化で各mood が公平に競い、曲の感情キャラが正しくラベル付けされるように。
  let best = null, bestAvg = -1;
  for (const def of MOOD_DEFS) {
    const sum = def.types.reduce((s, t) => s + (song.scores[t] || 0), 0);
    const avg = sum / Math.max(1, def.types.length);
    if (avg > bestAvg) { bestAvg = avg; best = def; }
  }
  return best;
}
function moodSummary(songs) {
  // 結果10曲の mood 分布を「切ない 4 / 前向き 3 / 穏やか 3」形式で返す
  const counts = new Map();
  for (const s of songs) {
    const m = moodOf(s);
    if (!m) continue;
    counts.set(m.name, (counts.get(m.name) || 0) + 1);
  }
  // MOOD_DEFS の宣言順 + 件数降順で並べる
  return MOOD_DEFS.map(d => ({ name: d.name, color: d.color, emoji: d.emoji, n: counts.get(d.name) || 0 }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n);
}

function recommend(typeKey) {
  const t = TYPE_MAP[typeKey];
  // 700+曲 × 16タイプ × 0-10 のキュレーション済みスコアから重み付け抽出
  //   本人タイプスコア(0-10)を主軸 [二乗してメリハリ]
  //   + 相性タイプスコア合計の 25%
  //   + ジャンル一致 +1.5 ブースト
  //   + 好きアーティスト一致 +5.0 ブースト
  //   + リスナー層(cluster)一致 +2-3 ブースト ← NEW
  //     好きアーティスト+ジャンルから推定した層に属する曲を底上げ
  //   + 旧 types[] レガシー互換
  const userClus = userClusters();
  const hasClus = Object.keys(userClus).length > 0;
  // 静的 curated 700+ 曲 + 好きアーティスト由来の動的曲(あれば)を統合
  let songPool = state.dynamicSongs && state.dynamicSongs.length
    ? SONGS.concat(state.dynamicSongs)
    : SONGS;
  // ★ファウンダー指示「アニメ+ボカロ+アイドル選択で K-POP混入は最悪」を構造解決:
  //   ユーザーがcluster(ジャンル or アーティスト経由)を明示している場合、
  //   そのcluster + favArtist の曲だけに強制絞り込み。タイプスコアに押されて
  //   ユーザー興味外の曲が混入することを防ぐ。
  //   ただし絞った結果10曲未満になる場合は全体プールにフォールバック。
  if (hasClus) {
    const userClusKeys = Object.keys(userClus);
    const filtered = songPool.filter(s =>
      isFavArtist(s.artist) ||
      songClusters(s).some(c => userClusKeys.includes(c))
    );
    if (filtered.length >= 10) songPool = filtered;
  }
  const weighted = songPool.map(song => {
    const sc = song.scores || {};
    let primary = sc[typeKey];
    if (primary == null && Array.isArray(song.types)) primary = song.types.includes(typeKey) ? 9 : 3;
    if (primary == null) primary = 3;
    // 相性タイプの平均ボーナス
    let compatBonus = 0;
    if (t.compatible && t.compatible.length) {
      let sum = 0, n = 0;
      t.compatible.forEach(k => {
        const v = sc[k];
        if (v != null) { sum += v; n++; }
      });
      if (n) compatBonus = (sum / n) * 0.25;
    }
    // ジャンル一致でブースト
    const genreBonus = (state.genres && state.genres.includes(song.genre)) ? 1.5 : 0;
    // 好きアーティスト一致で大きめブースト(タイプ最高スコア相当のメリハリ)
    const favBonus = isFavArtist(song.artist) ? 5.0 : 0;
    // リスナー層(cluster)一致ブースト(同じ層のサウンドだけを底上げ)
    const clusterBonus = hasClus ? clusterMatchScore(song, userClus) : 0;
    // 二乗でメリハリ + 0.3 のベース(全曲ゼロ防止)
    const w = Math.max(0.3, Math.pow(primary, 1.7) + compatBonus + genreBonus + favBonus + clusterBonus);
    return { song, w };
  });
  // 重み付き非復元サンプリングのヘルパ
  const sampleN = (arr, n) => {
    const out = [];
    while (out.length < n && arr.length) {
      const total = arr.reduce((s, x) => s + x.w, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < arr.length; idx++) { r -= arr[idx].w; if (r <= 0) break; }
      out.push(arr.splice(Math.min(idx, arr.length - 1), 1)[0].song);
    }
    return out;
  };
  // mood多様性つきサンプリング:既に選ばれた曲と同じ mood の曲には pen を、
  // 違う mood の曲には boost をかけてからサンプリングする。
  // 結果10曲が同じ mood に偏らないようにするための仕組み(2026-06-22 監査)。
  const sampleNDiverse = (arr, n, alreadyPicked) => {
    const out = [];
    const usedMoods = new Map();
    (alreadyPicked || []).forEach(s => {
      const m = moodOf(s); if (!m) return;
      usedMoods.set(m.name, (usedMoods.get(m.name) || 0) + 1);
    });
    while (out.length < n && arr.length) {
      const total = arr.reduce((s, x) => {
        const xm = (moodOf(x.song) || {}).name;
        const dup = xm ? (usedMoods.get(xm) || 0) : 0;
        // 同じmood3曲以上で 0.5倍ペナ、未出現moodは1.5倍ボーナス
        const mult = dup >= 3 ? 0.5 : (dup === 0 && xm ? 1.5 : 1.0);
        return s + (x.w * mult);
      }, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < arr.length; idx++) {
        const xm = (moodOf(arr[idx].song) || {}).name;
        const dup = xm ? (usedMoods.get(xm) || 0) : 0;
        const mult = dup >= 3 ? 0.5 : (dup === 0 && xm ? 1.5 : 1.0);
        r -= arr[idx].w * mult;
        if (r <= 0) break;
      }
      const picked = arr.splice(Math.min(idx, arr.length - 1), 1)[0].song;
      out.push(picked);
      const m = moodOf(picked);
      if (m) usedMoods.set(m.name, (usedMoods.get(m.name) || 0) + 1);
    }
    return out;
  };
  // ── 3層保証で 10曲を構成 ──
  // 1. 好きアーティスト一致曲を 2曲 guarantee(本人の確信信号)
  // 2. リスナー層(cluster)一致曲を 3曲 guarantee(同じ層のサウンドを必ず混ぜる)
  // 3. 残り 5曲は mood多様化付きサンプリング(同mood偏重を抑制)
  // 重複は filter で完全排除。pool 不足時は自動でフォールバック。
  const isFav      = x => isFavArtist(x.song.artist);
  const isInClus   = x => hasClus && songClusters(x.song).some(c => userClus[c] > 0);
  const favPool      = weighted.filter(x => isFav(x));
  const clusterPool  = weighted.filter(x => !isFav(x) && isInClus(x));
  const otherPool    = weighted.filter(x => !isFav(x) && !isInClus(x));
  const wantFav      = Math.min(2, favPool.length);
  const favPicks     = sampleN(favPool, wantFav);
  const wantCluster  = Math.min(3, clusterPool.length);
  const clusterPicks = sampleN(clusterPool, wantCluster);
  const need         = 10 - favPicks.length - clusterPicks.length;
  // other が足りない場合は cluster 余剰や fav 余剰から補充
  const restPool     = otherPool.concat(clusterPool).concat(favPool);
  // restPool は既選曲(fav+cluster)の mood を見て多様化される
  const otherPicks   = sampleNDiverse(restPool, need, [...favPicks, ...clusterPicks]);
  // ── 配置設計(2026-06-22 v2:ファウンダー指示「記入したアーティストが
  //    後半だと微妙、興味ないジャンルが入ると最悪」)──
  // 1-2番目:fav(=ユーザーが入力した好きアーティスト曲)を最優先表示。
  //   「ちゃんと入力反映されてる」感を真っ先に伝える。
  // 3-5番目:cluster一致(同じ層のサウンド)
  // 6-10番目:other(タイプ親和度+mood多様性)
  const arranged = [];
  const favs = [...favPicks];
  const clusters = [...clusterPicks];
  const others = [...otherPicks];
  // 1-2位:fav曲(あれば最大2曲)
  while (favs.length && arranged.length < 2) arranged.push(favs.shift());
  // 3-5位:cluster一致曲(最大3曲)
  while (clusters.length && arranged.length < 5) arranged.push(clusters.shift());
  // 6-10位:other(残り全部)
  while (others.length && arranged.length < 10) arranged.push(others.shift());
  // 不足時は cluster/fav 余剰で補完
  while (arranged.length < 10 && (clusters.length || favs.length || others.length)) {
    if (clusters.length) arranged.push(clusters.shift());
    else if (favs.length) arranged.push(favs.shift());
    else if (others.length) arranged.push(others.shift());
  }
  return arranged.slice(0, 10);
}

function buildSongsHTML() {
  return state.lastRecommend.map((s, i) => songRow(s, i)).join("");
}

function buildMoodBreakdownHTML() {
  const summary = moodSummary(state.lastRecommend || []);
  if (!summary.length) return "";
  const pills = summary.map(m =>
    `<span class="mb-pill" style="--mc:${m.color}">
      <span class="mb-em">${m.emoji}</span>
      <span class="mb-name">${m.name}</span>
      <span class="mb-n">${m.n}</span>
    </span>`).join("");
  return `<div class="mb-label">10曲の雰囲気</div><div class="mb-pills">${pills}</div>`;
}

// 「あなたの ○○ にこの曲が刺さる理由」を返す。
// 専用reasonがあれば優先、なければタイプ別 5バリアントから曲ハッシュで決定論的に選択。
// 同じ曲は同じ文(stable)、違う曲は違う文(diversity)が両立し、
// 10曲中 fallback でも自然に分散する(同文連発を回避)。
function _strHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}
function getReason(song, typeKey) {
  if (!song || !typeKey) return "";
  const key = `${song.title}|||${song.artist}`;
  const SR = window.SONG_REASONS || {};
  if (SR[key] && SR[key][typeKey]) return SR[key][typeKey];
  const variants = (window.REASON_FALLBACK_VARIANTS || {})[typeKey];
  if (variants && variants.length) return variants[_strHash(key) % variants.length];
  return (window.REASON_FALLBACK || {})[typeKey] || "";
}

// 「あなたの中の他のタイプ」:メインタイプを除いた上位3つを 1行解説付きで並べる
function traitsHTML() {
  // 主役質問数の偏りを排除するため、ここも正規化スコアで Top3 を出す
  const scoreMap = state.normScores || state.scores || {};
  const top = Object.entries(scoreMap).sort((a, b) => b[1] - a[1]);
  const subs = top.filter(([k]) => k !== state.result).slice(0, 3);
  return subs.map(([k], i) => {
    const tt = TYPE_MAP[k];
    if (!tt) return "";
    return `
      <div class="alsome reveal" style="--c:${tt.color};--d:${i * .14}s">
        <div class="alsome-mascot">${mascotSVG(tt.parody)}</div>
        <div class="alsome-body">
          <div class="alsome-rank">No.${i + 2}</div>
          <div class="alsome-name">${parodyBR(tt.parody)}</div>
          <div class="alsome-line">${tt.tagline}</div>
        </div>
      </div>`;
  }).join("");
}

// p-songs-intro の横マーキー(曲名がどんどん流れる)
function songMarquee() {
  const titles = SONGS.slice().sort(() => Math.random() - .5).slice(0, 14).map(s => s.title);
  const row = titles.map(t => `<span class="sm-item">${t}</span>`).join("");
  return row + row; // ループ用に2倍
}

// 再シャッフル:曲リストを差し替えてジャケ写を取り直し、曲セクション先頭にスクロール
function reshuffleSongs() {
  navigator.vibrate?.([8, 18, 12]); // 触覚で「シャッフル」感
  // 既存リストを fadeOut → 入れ替え → fadeIn(jacket だけ scale-in)
  const list = document.getElementById("songlist");
  const mb = document.getElementById("moodBreakdown");
  const doSwap = () => {
    state.lastRecommend = recommend(state.result);
    if (list) {
      list.innerHTML = buildSongsHTML();
      list.classList.add("reshuffle-in");
      // .reshuffle-in を一定時間後に外す(再アニメ可能に)
      setTimeout(() => list.classList.remove("reshuffle-in"), 900);
    }
    if (mb) mb.innerHTML = buildMoodBreakdownHTML();
    prefetchSongMeta();
    const target = document.querySelector(".p-songs") || document.querySelector(".songs-summary");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // 短いフェードアウトを挟む(reduced-motion なら即時)
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (list && !reduced) {
    list.classList.add("reshuffle-out");
    setTimeout(() => { list.classList.remove("reshuffle-out"); doSwap(); }, 220);
  } else {
    doSwap();
  }
}

function songRow(s, i) {
  const q = encodeURIComponent(`${s.title} ${s.artist}`);
  const spotify = `https://open.spotify.com/search/${q}`;
  const apple = `https://music.apple.com/jp/search?term=${q}`;
  const yt = `https://music.youtube.com/search?q=${q}`;
  const safeT = (s.title || "").replace(/'/g, "\\'");
  const safeA = (s.artist || "").replace(/'/g, "\\'");
  const typeColor = TYPE_MAP[state.result] ? TYPE_MAP[state.result].color : "#ff5e8a";
  return `
    <div class="song reveal" data-song-id="${s.title}|||${s.artist}" style="--d:${Math.min(i, 8) * .05}s">
      <button class="song-play" type="button" aria-label="30秒試聴して再生" style="--jc:${typeColor}" onclick="togglePreview(this, '${safeT}', '${safeA}')">
        <span class="sp-jacket" aria-hidden="true"></span>
        <span class="sp-overlay" aria-hidden="true"></span>
        <span class="sp-num">#${i + 1}</span>
        <span class="sp-icon" aria-hidden="true"></span>
      </button>
      <div class="song-meta">
        ${(() => {
          const m = moodOf(s);
          const fav = isFavArtist(s.artist);
          const pills = [];
          if (m) pills.push(`<span class="song-mood" style="--mc:${m.color}">${m.emoji} ${m.name}</span>`);
          if (fav) pills.push('<span class="song-fav-badge">♥ 好きなアーティスト</span>');
          return pills.length ? `<div class="song-pills">${pills.join('')}</div>` : '';
        })()}
        <div class="song-title">${s.title}</div>
        <div class="song-artist">${s.artist} ・ ${s.genre}</div>
        <div class="song-links">
          <a class="song-link sp" href="${spotify}" target="_blank" rel="noopener" aria-label="Spotifyでフル尺">Spotify</a>
          <a class="song-link am" href="${apple}" target="_blank" rel="noopener" aria-label="Apple Musicでフル尺">Apple</a>
          <a class="song-link yt" href="${yt}" target="_blank" rel="noopener" aria-label="YouTubeでフル尺">YouTube</a>
        </div>
      </div>
    </div>`;
}

// ---- 30秒試聴 + ジャケ写 ----
// 取得元:Spotify Web API(優先) → iTunes Search API(preview_url欠落時のフォールバック)
// 日本曲は Spotify の preview_url が null になりがちなため iTunes 併用は必須
let _audio = null;
let _activeBtn = null;
const _songMeta = new Map(); // key: "title|||artist" → { previewUrl, artworkUrl, spotifyUrl, spotifyId } | null

// Spotify アクセストークン(50分キャッシュ)
let _spToken = null;
let _spTokenExp = 0;

// E: timeout 付き fetch(無限待ち防止。100万人スケールでネット遅延の人を救う)
function _fetchWithTimeout(url, opts = {}, ms = 5000) {
  return new Promise((resolve, reject) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => { ctrl.abort(); reject(new Error("timeout")); }, ms);
    fetch(url, { ...opts, signal: ctrl.signal })
      .then((r) => { clearTimeout(t); resolve(r); })
      .catch((e) => { clearTimeout(t); reject(e); });
  });
}

async function getSpotifyToken() {
  if (_spToken && Date.now() < _spTokenExp) return _spToken;
  try {
    const r = await _fetchWithTimeout("/api/spotify-token", {}, 5000);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.access_token) return null;
    _spToken = d.access_token;
    _spTokenExp = Date.now() + ((d.expires_in || 3600) - 60) * 1000;
    return _spToken;
  } catch { return null; }
}

// Spotifyで日本語アーティスト名で検索ヒットしない場合の英語表記マップ
// 必要に応じて随時拡充(2026-06-22 ファウンダー指摘:緑黄色社会 試聴できない)
// Spotifyの日本人アーティスト英語表記マップ(日本語名でヒットしない問題対策)
const ARTIST_ALT_NAMES = {
  // Z世代主戦場(令和)
  "緑黄色社会": "Ryokuoushoku Shakai",
  "ずっと真夜中でいいのに。": "ZUTOMAYO",
  "ヨルシカ": "Yorushika",
  "米津玄師": "Kenshi Yonezu",
  "藤井 風": "Fujii Kaze",
  "もさを。": "mosawo",
  "ヤマモトショウ": "Yamamoto Show",
  "なとり": "natori",
  "りりあ。": "lilia",
  "n-buna": "n-buna",
  "TOMOO": "TOMOO",
  // 平成主戦場
  "宇多田ヒカル": "Hikaru Utada",
  "椎名林檎": "Sheena Ringo",
  "星野源": "Hoshino Gen",
  "中島みゆき": "Miyuki Nakajima",
  "中島美嘉": "Mika Nakashima",
  "玉置浩二": "Koji Tamaki",
  "井上陽水": "Yosui Inoue",
  "松任谷由実": "Yumi Matsutoya",
  "桐谷健太": "Kentaro Kiritani",
  "槇原敬之": "Noriyuki Makihara",
  "福山雅治": "Masaharu Fukuyama",
  "西野カナ": "Kana Nishino",
  "大塚愛": "Ai Otsuka",
  "倉木麻衣": "Mai Kuraki",
  "倖田來未": "Koda Kumi",
  "浜崎あゆみ": "Ayumi Hamasaki",
  "安室奈美恵": "Namie Amuro",
  "絢香": "Ayaka",
  "一青窈": "Yo Hitoto",
  "平井堅": "Ken Hirai",
  "尾崎豊": "Yutaka Ozaki",
  "山下達郎": "Tatsuro Yamashita",
  "大滝詠一": "Eiichi Ohtaki",
  "竹内まりや": "Mariya Takeuchi",
  "杏里": "Anri",
  "松原みき": "Miki Matsubara",
  "松浦亜弥": "Aya Matsuura",
  "広瀬香美": "Kohmi Hirose",
  "三浦大知": "Daichi Miura",
  "大原櫻子": "Sakurako Ohara",
  "菅田将暉": "Suda Masaki",
  "Tani Yuuki": "Tani Yuuki",
  "瑛人": "Eito",
  "優里": "Yuuri",
  "imase": "imase",
  "Eve": "Eve",
  // 邦ロック・バンド
  "King Gnu": "King Gnu",
  "サザンオールスターズ": "Southern All Stars",
  "スピッツ": "Spitz",
  "ポルノグラフィティ": "Porno Graffitti",
  "コブクロ": "Kobukuro",
  // ボカロP・歌い手
  "DECO*27": "DECO*27",
  "40mP": "40mP",
  "みきとP": "MikitoP",
  "黒うさP": "KurousaP",
  "Kikuo": "Kikuo",
  // 男性アイドルグループ
  "嵐": "Arashi",
  "KinKi Kids": "KinKi Kids",
  "King & Prince": "King & Prince",
  "Snow Man": "Snow Man",
  "SixTONES": "SixTONES",
  "なにわ男子": "Naniwa Danshi",
  "Hey!Say!JUMP": "Hey! Say! JUMP",
  // 女性アイドル
  "乃木坂46": "Nogizaka46",
  "欅坂46": "Keyakizaka46",
  "日向坂46": "Hinatazaka46",
  "櫻坂46": "Sakurazaka46",
  "AKB48": "AKB48",
  "モーニング娘。": "Morning Musume.",
  "Perfume": "Perfume",
};

async function _searchSpotifyOnce(title, artist, token) {
  // limit=3 で取って title一致check で正しいトラックを選ぶ
  const q = encodeURIComponent(`track:${title} artist:${artist}`);
  const r = await _fetchWithTimeout(
    `https://api.spotify.com/v1/search?q=${q}&type=track&limit=3&market=JP`,
    { headers: { Authorization: `Bearer ${token}` } },
    5000
  );
  return r;
}
// title 一致確認:Spotifyが「KING」検索で「虹」を返したり、「ありがとう」検索で
// 「しわあわせ」を返したりするケースを防ぐ。正規化して完全一致 or 包含で判定。
function _normTitleForMatch(s) {
  return (s || "").toLowerCase()
    .replace(/[\s　()()【】\[\]「」、・。,.!?!?#\-_'"’]/g, "");
}
function _titleMatchOK(query, found) {
  const a = _normTitleForMatch(query);
  const b = _normTitleForMatch(found);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

async function fetchSpotifyTrack(title, artist) {
  const token = await getSpotifyToken();
  if (!token) return null;
  // 検索に使うアーティスト名候補(オリジナル → ALT表記 → titleのみ)
  const altArtist = ARTIST_ALT_NAMES[artist];
  const candidates = altArtist ? [artist, altArtist] : [artist];
  for (const cand of candidates) {
    // E: 429/5xx/401 リトライ
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await _searchSpotifyOnce(title, cand, _spToken);
        if (r.status === 401 && attempt === 0) {
          _spToken = null; _spTokenExp = 0;
          const newToken = await getSpotifyToken();
          if (!newToken) return null;
          continue;
        }
        if ((r.status === 429 || r.status >= 500) && attempt === 0) {
          await new Promise(r2 => setTimeout(r2, 800));
          continue;
        }
        if (!r.ok) break;
        const data = await r.json();
        const items = (data.tracks && data.tracks.items) || [];
        if (!items.length) break; // 次の candidate へ
        // title 一致する track を選ぶ。全部不一致なら別candidateへ
        const t = items.find(it => _titleMatchOK(title, it.name));
        if (!t) break;
        return {
          spotifyId: t.id,
          previewUrl: t.preview_url || null,
          artworkUrl: (t.album && t.album.images && t.album.images[0] && t.album.images[0].url) || null,
          spotifyUrl: t.external_urls && t.external_urls.spotify,
        };
      } catch { break; }
    }
  }
  return null;
}

async function fetchITunesTrack(title, artist) {
  try {
    const term = encodeURIComponent(`${title} ${artist}`);
    const r = await _fetchWithTimeout(
      `https://itunes.apple.com/search?term=${term}&country=jp&entity=song&limit=5`,
      {}, 5000
    );
    if (!r.ok) return null;
    const j = await r.json();
    // iTunes 結果も title一致check で正しいトラック選定
    const results = (j.results || []);
    const hit = results.find(it => _titleMatchOK(title, it.trackName)) || null;
    if (!hit) return null;
    const art = (hit.artworkUrl100 || "").replace(/100x100/g, "600x600");
    return { previewUrl: hit.previewUrl || null, artworkUrl: art || null };
  } catch { return null; }
}

async function fetchSongMeta(title, artist) {
  const key = `${title}|||${artist}`;
  if (_songMeta.has(key)) return _songMeta.get(key);
  const meta = { previewUrl: null, artworkUrl: null, spotifyUrl: null, spotifyId: null };
  // 1) Spotify Search(優先)
  const sp = await fetchSpotifyTrack(title, artist);
  if (sp) {
    meta.previewUrl = sp.previewUrl;
    meta.artworkUrl = sp.artworkUrl;
    meta.spotifyUrl = sp.spotifyUrl;
    meta.spotifyId = sp.spotifyId;
  }
  // 2) iTunes fallback(Spotifyに無い・preview_urlがnull・artworkが取れない場合)
  if (!meta.previewUrl || !meta.artworkUrl) {
    const it = await fetchITunesTrack(title, artist);
    if (it) {
      if (!meta.previewUrl) meta.previewUrl = it.previewUrl;
      if (!meta.artworkUrl) meta.artworkUrl = it.artworkUrl;
    }
  }
  if (!meta.previewUrl && !meta.artworkUrl) {
    _songMeta.set(key, null);
    return null;
  }
  _songMeta.set(key, meta);
  return meta;
}

// 結果ページ初期化時に呼ぶ:全10曲分のジャケ写/preview/Spotify URLを取得し各行に流し込む。
// (一度 lazy load 化したが、scroll-snap モードで IntersectionObserver が確実に発火しない
// 環境があり 6-10曲目のメタが未取得→「視聴できない」「ジャケ写出ない」となるバグが
// 発生。確実性を優先して全曲即時取得に戻し、並列度3制限だけ維持して
// Vercel Serverless 関数への過負荷は抑える。2026-06-22 バグ修正)
async function prefetchSongMeta() {
  if (!state.lastRecommend) return;
  // 並列度3で同時実行を制限する軽量p-limit
  const _limit = (concurrency) => {
    let active = 0;
    const queue = [];
    const next = () => {
      if (active >= concurrency || !queue.length) return;
      const { fn, resolve, reject } = queue.shift();
      active++;
      Promise.resolve().then(fn).then(
        (r) => { active--; resolve(r); next(); },
        (e) => { active--; reject(e); next(); }
      );
    };
    return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
  };
  const limit = _limit(3);
  const injectMeta = (s, meta) => {
    if (!meta) return;
    const id = `${s.title}|||${s.artist}`;
    const rows = document.querySelectorAll(`[data-song-id="${CSS.escape(id)}"]`);
    rows.forEach((row) => {
      if (meta.artworkUrl) {
        const jacket = row.querySelector(".sp-jacket");
        if (jacket) {
          jacket.style.backgroundImage = `url("${meta.artworkUrl}")`;
          const playBtn = row.querySelector(".song-play, .ps-play");
          if (playBtn) playBtn.classList.add("art-loaded");
        }
      }
      if (meta.spotifyUrl) {
        row.querySelectorAll("a.song-link.sp, a.ps-svc.sp").forEach((a) => {
          a.href = meta.spotifyUrl;
        });
      }
    });
  };
  await Promise.all(
    state.lastRecommend.map((s) =>
      limit(() => fetchSongMeta(s.title, s.artist).then((m) => injectMeta(s, m)))
    )
  );
}

function _setBtnState(btn, state) {
  // state: idle | loading | playing | error
  btn.classList.remove("loading", "playing", "error");
  if (state !== "idle") btn.classList.add(state);
  // 再生終了時は progress を 0% に戻す
  if (state !== "playing") btn.style.removeProperty("--prog");
}
// 試聴プログレス:audio の timeupdate に合わせて btn の --prog を更新
function _attachProgress(btn, audio) {
  if (!btn || !audio) return;
  const upd = () => {
    if (!audio.duration || isNaN(audio.duration)) return;
    const pct = Math.min(100, (audio.currentTime / audio.duration) * 100);
    btn.style.setProperty("--prog", pct.toFixed(2) + "%");
  };
  audio.addEventListener("timeupdate", upd);
  audio.addEventListener("loadedmetadata", upd);
}
// 確実に音を止める:pause だけだと一部ブラウザ(iOS Safari等)で間に合わずバッファが残るため、
// src を空にして load() で内部状態をリセット。古い Audio が「謎再生」しないよう参照を切る。
function _stopAudio() {
  if (_audio) {
    try { _audio.pause(); _audio.src = ""; _audio.removeAttribute("src"); _audio.load(); } catch {}
    _audio = null;
  }
  if (_activeBtn) { _setBtnState(_activeBtn, "idle"); _activeBtn = null; }
}

// fetchSongMeta の await 中に別のボタンが押されると、古い fetch が後から resolve して
// 「捨てたはずの曲」が新しい曲と並列再生される race condition があった。
// token を毎回インクリメントし、await 復帰後に自分が最新か確認する。
let _playToken = 0;

async function togglePreview(btn, title, artist) {
  if (btn.classList.contains("loading")) return; // 連打ガード(同じボタン)
  if (navigator.vibrate) navigator.vibrate(10);
  // 同じボタン2度押し→停止
  if (_activeBtn === btn && _audio && !_audio.paused) { _stopAudio(); return; }
  _stopAudio();
  const myToken = ++_playToken;       // この再生リクエストの ID
  let meta = _songMeta.get(`${title}|||${artist}`);
  if (meta === undefined) {
    _setBtnState(btn, "loading");
    meta = await fetchSongMeta(title, artist);
    if (myToken !== _playToken) return;   // 待ってる間に別の再生が始まったので自分は破棄
  }
  const url = meta && meta.previewUrl;
  if (!url) { _setBtnState(btn, "error"); setTimeout(() => _setBtnState(btn, "idle"), 1800); return; }
  if (myToken !== _playToken) return;
  const a = new Audio(url);
  a.preload = "auto";
  _audio = a;
  _activeBtn = btn;
  _setBtnState(btn, "playing");
  // 試聴シークバー:プログレスを ::before の width で表現(prev要素にdata-bind経由)
  _attachProgress(btn, a);
  a.addEventListener("ended", () => {
    // 自分がまだ "現役" なら綺麗に終わらせる(別の再生が始まっていたら何もしない)
    if (_audio === a) _stopAudio();
  });
  a.addEventListener("error", () => {
    if (_audio === a) { _stopAudio(); _setBtnState(btn, "error"); setTimeout(() => _setBtnState(btn, "idle"), 1800); }
  });
  try {
    await a.play();
    if (myToken !== _playToken) { try { a.pause(); a.src = ""; a.load(); } catch {} }
  } catch {
    if (_audio === a) { _stopAudio(); }
    _setBtnState(btn, "error");
    setTimeout(() => _setBtnState(btn, "idle"), 1800);
  }
}
// ページ遷移時に必ず止める
window.addEventListener("beforeunload", _stopAudio);

function shareResult() {
  if (navigator.share) {
    navigator.share({ title: "ラブソング診断16", text: shareText(), url: SITE_URL }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(shareText());
    alert("結果テキストをコピーしました。");
  }
}

// Q: もう一度診断する(state を全リセット → LP へ)
function restartDiagnosis() {
  navigator.vibrate?.(14);
  // 進行中ステートも結果もクリア
  clearProgress();
  state.birth = null;
  state.genres = [];
  state.artists = [];
  state.artistIds = [];
  state.qIndex = 0;
  state.answers = [];
  state.scores = {};
  state.result = null;
  state.kei = null;
  state.lastRecommend = [];
  state.normScores = null;
  // 結果ページ用 lenis を止めていた可能性があるので解除
  document.documentElement.classList.remove("snap-mode");
  if (MX.lenisStart) MX.lenisStart();
  go(renderLanding);
}

// share-card を PNG Blob に変換(savePNG / shareTo の共通)
async function createSharePNG(opts = {}) {
  const target = document.querySelector(".share-card");
  if (!target || typeof html2canvas === "undefined") return null;
  // reveal が in 状態じゃないと見えないので強制
  const prev = { opacity: target.style.opacity, transform: target.style.transform };
  target.style.opacity = "1"; target.style.transform = "none";
  try {
    const canvas = await html2canvas(target, {
      backgroundColor: opts.bg || "#ffffff",
      scale: Math.min(window.devicePixelRatio || 1, 2) * 1.5,
      useCORS: true,
      allowTaint: true,
      logging: false,
      windowWidth: document.documentElement.clientWidth,
    });
    return await new Promise(r => canvas.toBlob(r, "image/png", 0.95));
  } catch (e) {
    console.error("createSharePNG", e);
    return null;
  } finally {
    target.style.opacity = prev.opacity || "";
    target.style.transform = prev.transform || "";
  }
}

// ─── V: Stories向け 9:16 縦長シェアカード(1080×1920)───
// shareカードをoff-screen DOM で 9:16 比に再構築 → html2canvas で撮影。
// Instagram Stories / TikTok / LINE VOOM / Snapchat 等で全画面表示できる。
async function createStoriesPNG() {
  if (typeof html2canvas === "undefined") return null;
  const t = TYPE_MAP[state.result];
  if (!t) return null;
  // 1080×1920 の off-screen コンテナを生成して html2canvasで撮る
  const off = document.createElement("div");
  off.className = "stories-card";
  off.style.cssText = "position:fixed;left:-99999px;top:0;width:1080px;height:1920px;z-index:-1;";
  const c = t.color || "#ff5e8a";
  const ac = t.accent || "#ffc857";
  const dark = darken(c, 0.35);
  const kei = state.kei || "";
  const tag = (t.tagline || "").replace(/"/g, "&quot;");
  off.innerHTML = `
    <div class="st-bg" style="background:linear-gradient(165deg, ${c} 0%, ${dark} 100%);
      width:100%;height:100%;position:relative;display:flex;flex-direction:column;
      align-items:center;justify-content:center;color:#fff;
      font-family:'Zen Maru Gothic',system-ui,sans-serif;text-align:center;
      padding:120px 80px;overflow:hidden;font-feature-settings:'palt' 1;">
      <div style="position:absolute;top:18%;left:8%;width:380px;height:380px;
        background:${ac};border-radius:50%;filter:blur(80px);opacity:.55;"></div>
      <div style="position:absolute;bottom:14%;right:6%;width:340px;height:340px;
        background:#fff;border-radius:50%;filter:blur(90px);opacity:.18;"></div>
      <div style="font-size:42px;font-weight:900;letter-spacing:.08em;opacity:.95;
        margin-bottom:60px;">
        ラブソング診断<span style="background:rgba(255,255,255,.22);padding:6px 18px;
        border-radius:999px;margin-left:8px;font-size:36px;">16</span>
      </div>
      <div style="width:300px;height:300px;display:flex;align-items:center;
        justify-content:center;margin-bottom:50px;">${mascotSVG(t.parody)}</div>
      <div style="display:inline-block;font-size:36px;font-weight:900;
        background:rgba(0,0,0,.32);padding:14px 50px;border-radius:999px;
        border:1px solid rgba(255,255,255,.2);margin-bottom:40px;">${kei}</div>
      <div style="font-size:144px;font-weight:900;line-height:1.12;letter-spacing:-.04em;
        margin-bottom:60px;text-shadow:0 6px 24px rgba(0,0,0,.32);">${t.parody}</div>
      <div style="font-size:46px;font-weight:800;line-height:1.55;opacity:.95;
        padding:0 40px;margin-bottom:80px;text-shadow:0 3px 8px rgba(0,0,0,.28);
        font-family:'Yomogi',cursive;">"${tag}"</div>
      <div style="width:80px;height:2px;background:linear-gradient(90deg,transparent,
        rgba(255,255,255,.6),transparent);margin:0 auto 40px;"></div>
      <div style="font-size:32px;font-weight:800;opacity:.92;">あなたは何タイプ?</div>
      <div style="font-size:28px;font-weight:800;opacity:.85;margin-top:14px;
        letter-spacing:.04em;">lovesong-type16.vercel.app</div>
    </div>
  `;
  document.body.appendChild(off);
  try {
    const canvas = await html2canvas(off.querySelector(".st-bg"), {
      width: 1080, height: 1920, backgroundColor: c,
      scale: 1, useCORS: true, allowTaint: true, logging: false,
    });
    return await new Promise(r => canvas.toBlob(r, "image/png", 0.95));
  } catch (e) {
    console.error("createStoriesPNG", e);
    return null;
  } finally {
    off.remove();
  }
}

function _btnLoading(btn, on) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.textContent; btn.classList.add("loading"); btn.disabled = true;
    const spin = document.createElement("span"); spin.className = "spin"; spin.style.marginRight = "8px";
    btn.textContent = ""; btn.appendChild(spin); btn.appendChild(document.createTextNode("画像を準備中…")); }
  else { btn.classList.remove("loading"); btn.disabled = false; btn.textContent = btn.dataset.label || ""; }
}

// V: Stories向け縦長(9:16)PNGを保存 + OS共有シート
async function saveStoriesPNG(ev) {
  navigator.vibrate?.(20);
  const btn = ev?.currentTarget;
  _btnLoading(btn, true);
  try {
    const blob = await createStoriesPNG();
    if (!blob) { alert("画像の生成に失敗しました。スクショで保存してね。"); return; }
    const t = TYPE_MAP[state.result];
    const filename = `lovesong-${t.parody}-stories.png`;
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "ラブソング診断16", text: shareText() });
        return;
      } catch (e) { if (e.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } finally { _btnLoading(btn, false); }
}

// 結果カードを画像として保存 + OS共有シート(対応端末)
async function savePNG(ev) {
  navigator.vibrate?.(20);
  const btn = ev?.currentTarget;
  _btnLoading(btn, true);
  try {
    const blob = await createSharePNG();
    if (!blob) { alert("画像の生成に失敗しました。スクショで保存してね。"); return; }
    const t = TYPE_MAP[state.result];
    const filename = `lovesong-${t.parody}.png`;
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "ラブソング診断16", text: shareText() });
        return;
      } catch (e) { if (e.name === "AbortError") return; }
    }
    // フォールバック:ダウンロード
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } finally { _btnLoading(btn, false); }
}

// Instagram / TikTok / BeReal などWebURL投稿APIが無いSNS向け:
// 画像PNGを生成 → Web Share APIでOS共有シート(各SNSアプリが並ぶ)→ 非対応端末はダウンロード+案内
async function shareTo(targetName, ev) {
  navigator.vibrate?.(20);
  const btn = ev?.currentTarget;
  _btnLoading(btn, true);
  try {
    const blob = await createSharePNG();
    if (!blob) { alert("画像の生成に失敗しました。スクショで保存してね。"); return; }
    const t = TYPE_MAP[state.result];
    const filename = `lovesong-${t.parody}.png`;
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "ラブソング診断16", text: shareText() });
        return;
      } catch (e) { if (e.name === "AbortError") return; }
    }
    // フォールバック
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    const labels = { instagram: "Instagram", tiktok: "TikTok", bereal: "BeReal" };
    alert(`画像を保存したよ。${labels[targetName] || "SNS"} アプリで投稿してね。`);
  } finally { _btnLoading(btn, false); }
}

// ---- 起動 ----
MX.blobs();
renderLanding();
