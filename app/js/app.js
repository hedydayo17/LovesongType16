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
function renderLanding() {
  const marquee = TYPES.concat(TYPES).map(t =>
    `<span class="mq" style="--c:${t.color}">
      <span class="mq-mascot">${mascotSVG(t.parody)}</span>
      <span class="mq-label">${parodyBR(t.parody)}</span>
    </span>`).join("");
  show(`
    <section class="screen hero">
      <div class="hero-brand">ラブソング診断<span class="hero-brand-num">16</span></div>
      <h1 class="hero-title">
        <span class="ln"><span>あなたを</span></span>
        <span class="ln"><span class="grad">16の恋愛タイプ</span><span>から</span></span>
        <span class="ln"><span class="grad">ラブソング</span><span>診断。</span></span>
      </h1>
      <div class="hero-meta">
        <span class="hm">#16タイプ</span>
        <span class="hm">#所要時間3分</span>
        <span class="hm">#完全無料</span>
      </div>
      <button class="btn primary big" data-mag onclick="go(renderBirth)">診断をはじめる</button>
      <button class="btn ghost" onclick="go(()=>renderGallery('landing'))">16タイプを見る</button>
      <p class="hero-share">診断結果は #ラブソング診断16 でシェア</p>
      <div class="hero-preview">
        <div class="hp-label">↓ こんな結果が出る</div>
        <div class="marquee"><div class="marquee-track">${marquee}</div></div>
      </div>
    </section>
  `);
  MX.hero();
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
async function fetchArtistSuggestions(query, sugEl, inp) {
  const cached = _sugCache.get(query);
  if (cached) { renderSuggestions(cached, sugEl, inp); return; }
  // 連打時:同じ入力欄の古いリクエストを中断
  const idx = inp.dataset.idx;
  if (_sugAbort[idx]) _sugAbort[idx].abort();
  const ac = new AbortController(); _sugAbort[idx] = ac;
  const token = await getSpotifyToken();
  if (!token) { sugEl.hidden = true; return; }
  try {
    const q = encodeURIComponent(query);
    const r = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=artist&limit=5&market=JP`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ac.signal,
    });
    if (!r.ok) return;
    const data = await r.json();
    const items = (data.artists && data.artists.items) || [];
    const list = items.map(a => ({
      id: a.id,            // top-tracks fetch 用(/v1/artists/{id}/top-tracks)
      name: a.name,
      img: (a.images && a.images[2] && a.images[2].url)   // 64px ≦
        || (a.images && a.images[1] && a.images[1].url)   // 320px
        || (a.images && a.images[0] && a.images[0].url)   // 640px
        || null,
      followers: (a.followers && a.followers.total) || 0,
    }));
    _sugCache.set(query, list);
    renderSuggestions(list, sugEl, inp);
  } catch (e) {
    if (e.name !== "AbortError") console.warn("artist search failed:", e);
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
    return `<button class="${cls}" aria-label="${SCALE_VALUES[idx]}" onclick="answer(${idx})"></button>`;
  }).join("");
  show(`
    <section class="screen quiz">
      <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
      <div class="qhead">
        <div class="qcount">${i + 1} <span>/ ${QUESTIONS.length}</span></div>
        <div class="qremain">あと${remain}問</div>
      </div>
      <div class="qcard">
        <h2 class="qtext">${q.s}</h2>
      </div>
      <div class="scale">
        <div class="scale-labels">
          <span class="scale-end agree">${SCALE_LABEL_LEFT}</span>
          <span class="scale-end dis">${SCALE_LABEL_RIGHT}</span>
        </div>
        <div class="dots">${dots}</div>
      </div>
      ${i > 0 ? '<button class="back" onclick="goBack()">← 戻る</button>' : ''}
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
      if (state.qIndex >= QUESTIONS.length) go(finishQuiz);
      else renderQuestion();
    }, 170);
  }, 220);
}
function goBack() {
  if (state.qIndex > 0) { state.qIndex--; renderQuestion(); }
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
  renderWrapped();
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
        </div>
        <div class="reveal-stack">
          <div class="reveal rv-tag" style="--d:.05s">20問、おつかれさま。</div>
          <h1 class="reveal rv-you" style="--d:.25s">あなたは…</h1>
          <div class="reveal rv-sub" style="--d:.6s">あなたを最も表す<br><b>ラブソング型</b>は</div>
          <div class="reveal rv-dots" style="--d:.9s" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
        </div>
        <div class="reveal scroll-hint light pulse" style="--d:1.2s">↓ スワイプで結果を見る</div>
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
        <div class="reveal scroll-hint light" style="--d:.3s">↓</div>
      </section>

      <section class="panel p-desc">
        <div class="reveal w-section-label"><span class="wsl-bar"></span><span class="wsl-text">あなたの恋愛</span></div>
        <p class="reveal w-desc" style="--d:.15s">${t.description}</p>
      </section>

      <section class="panel p-traits">
        <div class="reveal w-section-label"><span class="wsl-bar"></span><span class="wsl-text">あなたの中の他のタイプ</span></div>
        <p class="reveal traits-lead" style="--d:.1s">メインは <b>${t.parody}</b>。<br>その奥にもう3つの顔がいる。</p>
        <div class="alsome-list">${traitsHTML()}</div>
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
        <div class="reveal w-section-label"><span class="wsl-bar"></span><span class="wsl-text">相性診断</span></div>
        <div class="reveal compat-block good" style="--d:.1s">
          <div class="cb-head">相性◎ 惹かれ合う</div>
          <div class="w-chips">${comp}</div>
        </div>
        <div class="reveal compat-block caution" style="--d:.3s">
          <div class="cb-head">相性△ ちょっと努力が必要</div>
          <div class="w-chips">${t.cautionMatch.map(c => `<span class="w-chip ca">${c}</span>`).join("")}</div>
        </div>
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
          <div class="sc-brand">ラブソング診断16</div>
          <div class="sc-mascot">${mascotSVG(t.parody)}</div>
          <div class="sc-kei">${state.kei || ""}</div>
          <div class="sc-parody">${parodyBR(t.parody)}</div>
          <div class="sc-tagline handwrite">「${t.tagline}」</div>
          <div class="sc-foot">あなたは何タイプ?<br><span class="sc-url">lovesong-type16.vercel.app</span></div>
        </div>
        <button class="btn save reveal" data-mag style="--d:.2s" onclick="savePNG(event)">画像で保存</button>
        <div class="share-grid reveal" style="--d:.3s">
          <button class="btn sns ig" onclick="shareTo('instagram', event)" aria-label="Instagramでシェア">Instagram</button>
          <button class="btn sns tt" onclick="shareTo('tiktok', event)" aria-label="TikTokでシェア">TikTok</button>
          <button class="btn sns br" onclick="shareTo('bereal', event)" aria-label="BeRealでシェア">BeReal</button>
          <button class="btn sns x" onclick="shareX()" aria-label="Xでシェア">X</button>
          <button class="btn sns line" onclick="shareLINE()" aria-label="LINEで送る">LINE</button>
        </div>
        <button class="btn ghost reveal" style="--d:.5s" onclick="go(()=>renderGallery('result'))">16タイプ図鑑を見る</button>
        <button class="btn ghost reveal" style="--d:.6s" onclick="scrollWrappedTop()">最初から見る ↑</button>
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
  MX.screenIn();
}

function shareText() {
  const t = TYPE_MAP[state.result];
  const kei = state.kei ? state.kei : "";
  return `私の恋愛タイプは「${kei}${t.parody}」でした!\n${t.tagline}\nラブソング診断16`;
}
function shareX() {
  navigator.vibrate?.(16);
  const url = "https://twitter.com/intent/tweet?text=" +
    encodeURIComponent(shareText()) + "&hashtags=" + encodeURIComponent("ラブソング診断16");
  window.open(url, "_blank", "noopener");
}
function shareLINE() {
  navigator.vibrate?.(16);
  const url = "https://line.me/R/msg/text/?" + encodeURIComponent(shareText());
  window.open(url, "_blank", "noopener");
}

function shareCompat() {
  navigator.vibrate?.(20);
  const t = TYPE_MAP[state.result];
  const text = `私の恋愛タイプは「${t.parody}」。あなたは何タイプ?一緒に相性チェックしよ\nラブソング診断16`;
  if (navigator.share) navigator.share({ title: "ラブソング診断16", text }).catch(() => {});
  else { navigator.clipboard?.writeText(text); alert("メッセージをコピーしました。気になる人に送ってみて。"); }
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

// ---- Mood:5クラスタへの自動分類(既存 score パターンから無料で算出)----
// 手動タグ付け不要・135曲全部に即適用。recommend は触らず、純粋に説明性UP用。
const MOOD_DEFS = [
  { name: "切ない",   types: ["沼っくま", "進撃のロマンチスト", "ミステリアス狼"], color: "#7C5CFF", emoji: "🌙" },
  { name: "エモい",   types: ["情熱ラブゾンビ", "ヤキモチモンスター", "ド直球ザウルス"], color: "#FF4D6D", emoji: "🔥" },
  { name: "前向き",   types: ["バイブス警察", "ときめきパパラッチ", "推し活ベビー"], color: "#FF8FB1", emoji: "✨" },
  { name: "穏やか",   types: ["チル仙人", "慎重うさぎ", "マブダチエイリアン"], color: "#5CB8C4", emoji: "☁️" },
  { name: "キラキラ", types: ["ピュアエンジェル", "運命マジシャン", "一途ペンギン", "同志の虎"], color: "#FFB347", emoji: "💖" },
];
function moodOf(song) {
  if (!song || !song.scores) return null;
  let best = null, bestSum = -1;
  for (const def of MOOD_DEFS) {
    const sum = def.types.reduce((s, t) => s + (song.scores[t] || 0), 0);
    if (sum > bestSum) { bestSum = sum; best = def; }
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
  // 100曲 × 16タイプ × 0-10 のキュレーション済みスコアから重み付け抽出
  //   本人タイプスコア(0-10)を主軸 [二乗してメリハリ]
  //   + 相性タイプスコア合計の 25%
  //   + ジャンル一致 +1.5 ブースト
  //   + 好きアーティスト一致 +5.0 ブースト(Step 0b の入力を本当に効かせる)
  //   + 旧 types[] レガシー互換(スコアがない曲のため)
  // 静的 curated 100+ 曲 + 好きアーティスト由来の動的曲(あれば)を統合
  const songPool = state.dynamicSongs && state.dynamicSongs.length
    ? SONGS.concat(state.dynamicSongs)
    : SONGS;
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
    // 二乗でメリハリ + 0.3 のベース(全曲ゼロ防止)
    const w = Math.max(0.3, Math.pow(primary, 1.7) + compatBonus + genreBonus + favBonus);
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
  // 好きアーティスト曲は最大3曲まで先取り保証(ユーザーが明示的に選んだ強い信号を優先)
  const favPool = weighted.filter(x => isFavArtist(x.song.artist));
  const otherPool = weighted.filter(x => !isFavArtist(x.song.artist));
  const wantFav = Math.min(3, favPool.length);
  const favPicks = sampleN(favPool, wantFav);
  const otherPicks = sampleN(otherPool, 10 - favPicks.length);
  // 結果は fav が頭・尻に偏らないよう挿入位置をシャッフルでばらす
  const picked = [...favPicks, ...otherPicks];
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
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
  state.lastRecommend = recommend(state.result);
  const list = document.getElementById("songlist");
  if (list) list.innerHTML = buildSongsHTML();
  const mb = document.getElementById("moodBreakdown");
  if (mb) mb.innerHTML = buildMoodBreakdownHTML();
  prefetchSongMeta(); // ジャケ写・preview を再取得して新しい行に流し込み
  const target = document.querySelector(".p-songs") || document.querySelector(".songs-summary");
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
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
async function getSpotifyToken() {
  if (_spToken && Date.now() < _spTokenExp) return _spToken;
  try {
    const r = await fetch("/api/spotify-token");
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.access_token) return null;
    _spToken = d.access_token;
    _spTokenExp = Date.now() + ((d.expires_in || 3600) - 60) * 1000;
    return _spToken;
  } catch { return null; }
}

async function fetchSpotifyTrack(title, artist) {
  const token = await getSpotifyToken();
  if (!token) return null;
  try {
    // フィールド指定検索でヒット率UP。market=JP で日本リージョン優先
    const q = encodeURIComponent(`track:${title} artist:${artist}`);
    const r = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=1&market=JP`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const data = await r.json();
    const t = data.tracks && data.tracks.items && data.tracks.items[0];
    if (!t) return null;
    return {
      spotifyId: t.id,
      previewUrl: t.preview_url || null,
      artworkUrl: (t.album && t.album.images && t.album.images[0] && t.album.images[0].url) || null,
      spotifyUrl: t.external_urls && t.external_urls.spotify,
    };
  } catch { return null; }
}

async function fetchITunesTrack(title, artist) {
  try {
    const term = encodeURIComponent(`${title} ${artist}`);
    const r = await fetch(`https://itunes.apple.com/search?term=${term}&country=jp&entity=song&limit=1`);
    if (!r.ok) return null;
    const j = await r.json();
    const hit = j.results && j.results[0];
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

// 結果ページ初期化時に呼ぶ:全10曲分のジャケ写/preview/Spotify URLを並列取得し各行に流し込む
// 1曲フルスクリーン panel と summary リスト両方の同じ曲に注入(data-song-id で照合)
async function prefetchSongMeta() {
  if (!state.lastRecommend) return;
  await Promise.all(state.lastRecommend.map(async (s) => {
    const meta = await fetchSongMeta(s.title, s.artist);
    if (!meta) return;
    const id = `${s.title}|||${s.artist}`;
    const rows = document.querySelectorAll(`[data-song-id="${CSS.escape(id)}"]`);
    rows.forEach((row) => {
      // ジャケ写
      if (meta.artworkUrl) {
        const jacket = row.querySelector(".sp-jacket");
        if (jacket) {
          jacket.style.backgroundImage = `url("${meta.artworkUrl}")`;
          const playBtn = row.querySelector(".song-play");
          if (playBtn) playBtn.classList.add("art-loaded");
        }
      }
      // Spotify 直リンクが取れたら検索URL→トラックURLに差し替え
      if (meta.spotifyUrl) {
        row.querySelectorAll("a.song-link.sp, a.ps-svc.sp").forEach((a) => {
          a.href = meta.spotifyUrl;
        });
      }
    });
  }));
}

function _setBtnState(btn, state) {
  // state: idle | loading | playing | error
  btn.classList.remove("loading", "playing", "error");
  if (state !== "idle") btn.classList.add(state);
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
  const t = TYPE_MAP[state.result];
  const text = `私の恋愛タイプは「${t.parody}」でした!\nラブソング診断16`;
  if (navigator.share) {
    navigator.share({ title: "ラブソング診断16", text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text);
    alert("結果テキストをコピーしました。");
  }
}

// share-card を PNG Blob に変換(savePNG / shareTo の共通)
async function createSharePNG() {
  const target = document.querySelector(".share-card");
  if (!target || typeof html2canvas === "undefined") return null;
  // reveal が in 状態じゃないと見えないので強制
  const prev = { opacity: target.style.opacity, transform: target.style.transform };
  target.style.opacity = "1"; target.style.transform = "none";
  try {
    const canvas = await html2canvas(target, {
      backgroundColor: "#ffffff",  // 完全透明だとPNGが透ける環境あり
      scale: Math.min(window.devicePixelRatio || 1, 2) * 1.5,
      useCORS: true,
      allowTaint: true,            // CORS失敗時もキャプチャ続行
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

function _btnLoading(btn, on) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.textContent; btn.classList.add("loading"); btn.disabled = true;
    const spin = document.createElement("span"); spin.className = "spin"; spin.style.marginRight = "8px";
    btn.textContent = ""; btn.appendChild(spin); btn.appendChild(document.createTextNode("画像を準備中…")); }
  else { btn.classList.remove("loading"); btn.disabled = false; btn.textContent = btn.dataset.label || ""; }
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
