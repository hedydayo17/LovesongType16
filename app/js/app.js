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
function show(html) { MX.killScroll(); app().innerHTML = html; window.scrollTo(0, 0); }

// 画面遷移(ワイプ付き)。GSAP無ければ即実行
function go(fn) { MX.wipe(fn); }

// ---- ランディング(ヒーロー):摩擦ゼロの入口。16P/ラブタイプ流に「即スタート」を強調 ----
function renderLanding() {
  const marquee = TYPES.concat(TYPES).map(t =>
    `<span class="mq" style="--c:${t.color}"><span class="mq-dot" style="background:${t.color}"></span>${t.parody}</span>`).join("");
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

// ---- Step 0: 生年月日 ----
function renderBirth() {
  show(`
    <section class="screen">
      <div class="step-tag">はじめに</div>
      <h2 class="title">生年月日を教えてください</h2>
      <p class="lead">あなたの世代に響く選曲に使います。<br>結果カードには表示されません。</p>
      <div class="card-input">
        <label class="field-label">生年月日</label>
        <div class="birth-row">
          <input id="by" class="birth-in" type="number" inputmode="numeric" placeholder="2000" min="1900" max="2025">
          <span class="sep">/</span>
          <input id="bm" class="birth-in sm" type="number" inputmode="numeric" placeholder="01" min="1" max="12">
          <span class="sep">/</span>
          <input id="bd" class="birth-in sm" type="number" inputmode="numeric" placeholder="01" min="1" max="31">
        </div>
        <p class="note">診断の精度向上に使います。結果カードには表示されません。</p>
        <p id="birthErr" class="err"></p>
      </div>
      <button class="btn primary" onclick="submitBirth()">次へ</button>
    </section>
  `);
  MX.screenIn();
}

function submitBirth() {
  const y = parseInt($("#by").value, 10);
  const m = parseInt($("#bm").value, 10);
  const d = parseInt($("#bd").value, 10);
  const err = $("#birthErr");
  if (!y || !m || !d || y < 1900 || y > 2025 || m < 1 || m > 12 || d < 1 || d > 31) {
    err.textContent = "生年月日を正しく入力してください。";
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
      <p class="lead">最大3組まで(思いつかなければスキップでOK)。</p>
      <div class="card-input">
        <input class="text-in" id="a1" type="text" placeholder="アーティスト 1">
        <input class="text-in" id="a2" type="text" placeholder="アーティスト 2">
        <input class="text-in" id="a3" type="text" placeholder="アーティスト 3">
      </div>
      <div class="btn-row">
        <button class="btn ghost" onclick="startQuiz()">スキップ</button>
        <button class="btn primary" onclick="submitArtists()">診断スタート</button>
      </div>
    </section>
  `);
  MX.screenIn();
}
function submitArtists() {
  state.artists = ["a1", "a2", "a3"].map(id => $("#" + id).value.trim()).filter(Boolean);
  startQuiz();
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

function finishQuiz() {
  // 集計: 各設問の回答位置 → スコア倍率 × タイプ重み
  TYPES.forEach(t => state.scores[t.key] = 0);
  state.answers.forEach((pos, qIdx) => {
    const val = SCALE_VALUES[pos];
    const w = QUESTIONS[qIdx].w;
    for (const k in w) state.scores[k] += w[k] * val;
  });
  // 最高点 → 同点は TIE_PRIORITY で確定
  const max = Math.max(...Object.values(state.scores));
  const top = TYPES.map(t => t.key).filter(k => state.scores[k] === max);
  state.result = top.length === 1 ? top[0]
    : TIE_PRIORITY.find(k => top.includes(k));
  // 「系」を判定:各系のスコア合計が最大のもの(64通りのレア感)
  let bestKei = null, bestSum = -Infinity;
  for (const name in KEI) {
    const sum = KEI[name].types.reduce((s, k) => s + (state.scores[k] || 0), 0);
    if (sum > bestSum) { bestSum = sum; bestKei = name; }
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

  app().innerHTML = `
    <div class="wrapped" id="wrapped" style="--c:${t.color};--ac:${t.accent}">

      <section class="panel p-intro">
        <div class="reveal w-kicker">ラブソング診断16</div>
        <div class="reveal w-build" style="--d:.1s">あなたの</div>
        <div class="reveal w-build" style="--d:.25s">恋愛タイプは</div>
        <div class="reveal w-build big" style="--d:.4s">…?</div>
        <div class="reveal scroll-hint" style="--d:.9s">スクロール ↓</div>
      </section>

      <section class="panel p-type" style="background:
        linear-gradient(165deg, var(--c), color-mix(in srgb, var(--c) 45%, #000 55%))">
        <div class="hero-card reveal">
          <span class="sticker s1"></span><span class="sticker s2"></span><span class="sticker s3"></span>
          <div class="hc-brand">ラブソング診断16</div>
          <div class="hc-kei">${state.kei || ""}</div>
          <div class="type-mascot">${mascotSVG(t.parody)}</div>
          <div class="w-type">${t.type}</div>
          <h1 class="w-parody">${t.parody}</h1>
          <p class="hc-catch handwrite">「${t.tagline}」</p>
        </div>
        <div class="reveal scroll-hint light" style="--d:.3s">↓</div>
      </section>

      <section class="panel p-tagline">
        <div class="reveal w-quote-mark">"</div>
        <p class="reveal w-tagline" style="--d:.15s">${t.tagline}</p>
      </section>

      <section class="panel p-desc">
        <div class="reveal w-section-label">あなたの恋愛</div>
        <p class="reveal w-desc" style="--d:.15s">${t.description}</p>
      </section>

      <section class="panel p-traits">
        <div class="reveal w-section-label">あなたの恋愛傾向</div>
        <div class="trait-list">${traitsHTML()}</div>
      </section>

      <section class="panel p-strengths">
        <div class="reveal w-section-label">恋愛の強み</div>
        <ul class="w-list">
          ${t.strengths.map((s, i) => `<li class="reveal" style="--d:${.1 + i * .12}s"><span class="li-no">0${i + 1}</span>${s}</li>`).join("")}
        </ul>
        <div class="reveal w-loved" style="--d:.5s"><span class="w-loved-label">愛されポイント</span>${t.loved}</div>
      </section>

      <section class="panel p-ideal">
        <div class="reveal w-section-label">こんな恋がしたい</div>
        <p class="reveal w-ideal" style="--d:.12s">${t.ideal}</p>
        <div class="reveal w-aruaru-label" style="--d:.3s">${t.parody} あるある</div>
        <div class="w-aruaru">
          ${t.aruaru.map((a, i) => `<span class="aru reveal" style="--d:${.4 + i * .12}s">${a}</span>`).join("")}
        </div>
      </section>

      <section class="panel p-compat">
        <div class="reveal w-section-label">相性診断</div>
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

      <section class="panel p-songs-intro">
        <div class="reveal w-section-label">そんなあなたへ</div>
        <div class="reveal w-songs-count" style="--d:.15s">10</div>
        <div class="reveal w-songs-label" style="--d:.3s">あなた専用のプレイリスト</div>
        ${IS_MOCK ? '<p class="reveal mock-note" style="--d:.5s">※ サンプル選曲。各曲の▶ボタンで30秒試聴/Spotify・Apple Music・YouTubeでフル尺。</p>' : ''}
        <div class="song-marquee"><div class="song-marquee-track">${songMarquee()}</div></div>
        <div class="reveal scroll-hint" style="--d:.9s">↓</div>
      </section>

      <section class="panel p-songs">
        <div class="reveal w-songs-head">${t.parody} のための10曲</div>
        <div class="songlist" id="songlist">${buildSongsHTML()}</div>
      </section>

      <section class="panel p-share">
        <div class="reveal share-card" style="background:
          linear-gradient(165deg, ${t.color}, ${darken(t.color, 0.45)})">
          <div class="sc-brand">ラブソング診断16</div>
          <div class="sc-mascot">${mascotSVG(t.parody)}</div>
          <div class="sc-kei">${state.kei || ""}</div>
          <div class="sc-type">${t.type}</div>
          <div class="sc-parody">${t.parody}</div>
          <div class="sc-tagline handwrite">「${t.tagline}」</div>
        </div>
        <button class="btn primary reveal" data-mag style="--d:.2s" onclick="reshuffleSongs()">別の10曲を見る ↻</button>
        <button class="btn save reveal" style="--d:.3s" onclick="savePNG(event)">画像で保存(SNSに貼れる)</button>
        <div class="share-row reveal" style="--d:.4s">
          <button class="btn sns x" onclick="shareX()">Xでシェア</button>
          <button class="btn sns line" onclick="shareLINE()">LINEで送る</button>
        </div>
        <button class="btn ghost reveal" style="--d:.5s" onclick="go(()=>renderGallery('result'))">16タイプ図鑑を見る</button>
        <button class="btn ghost reveal" style="--d:.6s" onclick="scrollWrappedTop()">最初から見る ↑</button>
      </section>

    </div>
  `;
  observeReveals();   // 本文リビールは必ず表示(CSS+IO)
  MX.result();        // GSAPは飾り(文字/カウント/バー/視差/紙吹雪)だけ
  MX.magnetize(document);
}

function scrollWrappedTop() {
  MX.scrollTo(document.querySelector(".p-intro") || 0);
}

// ---- 16タイプ図鑑(探索・再訪の導線。from = "landing" | "result") ----
function renderGallery(from) {
  const cards = TYPES.map(t => `
    <button class="g-card" style="--c:${t.color}" onclick="go(()=>renderTypeDetail('${t.key}','${from}'))">
      <div class="g-mascot">${mascotSVG(t.parody)}</div>
      <div class="g-parody">${t.parody}</div>
      <div class="g-type">${t.type}</div>
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
        <h1 class="td-parody">${t.parody}</h1>
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
function recommend(typeKey) {
  const t = TYPE_MAP[typeKey];
  // 重み付け: 本人タイプ一致=5 / 相性タイプ一致=2 / ジャンル一致=+2 / ベース0.3
  const weighted = SONGS.map(song => {
    let w = 0.3;
    if (song.types.includes(typeKey)) w += 5;
    if (song.types.some(x => t.compatible.includes(x))) w += 2;
    if (state.genres.length && state.genres.includes(song.genre)) w += 2;
    return { song, w };
  });
  // 重み付きランダム抽出(非復元)で10曲。再シャッフルで毎回変化
  const pool = [...weighted];
  const picked = [];
  while (picked.length < 10 && pool.length) {
    const total = pool.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) { r -= pool[idx].w; if (r <= 0) break; }
    picked.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0].song);
  }
  return picked;
}

function buildSongsHTML() {
  return state.lastRecommend.map((s, i) => songRow(s, i)).join("");
}

// 恋愛傾向の%バー(上位5タイプ)。スコアを0-100に正規化
function traitsHTML() {
  const max = Math.max(...Object.values(state.scores), 1);
  const top = Object.entries(state.scores)
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  return top.map(([k, v]) => {
    const pct = Math.max(8, Math.round((v / max) * 100));
    const c = TYPE_MAP[k].color;
    return `
      <div class="trait reveal">
        <div class="trait-top"><span>${k}</span><span class="trait-pct">${pct}%</span></div>
        <div class="trait-bar"><i data-w="${pct}" style="--bc:${c};width:${pct}%"></i></div>
      </div>`;
  }).join("");
}

// p-songs-intro の横マーキー(曲名がどんどん流れる)
function songMarquee() {
  const titles = SONGS.slice().sort(() => Math.random() - .5).slice(0, 14).map(s => s.title);
  const row = titles.map(t => `<span class="sm-item">${t}</span>`).join("");
  return row + row; // ループ用に2倍
}

// 再シャッフルは曲リストだけ差し替え(スクロール位置を保つ)
function reshuffleSongs() {
  state.lastRecommend = recommend(state.result);
  const list = document.getElementById("songlist");
  if (list) list.innerHTML = buildSongsHTML();
  MX.scrollTo(document.querySelector(".p-songs"));
}

function songRow(s, i) {
  const id = fbId(s);
  const fb = getFeedback(id);
  const q = encodeURIComponent(`${s.title} ${s.artist}`);
  const spotify = `https://open.spotify.com/search/${q}`;
  const apple = `https://music.apple.com/jp/search?term=${q}`;
  const yt = `https://music.youtube.com/search?q=${q}`;
  const safeT = (s.title || "").replace(/'/g, "\\'");
  const safeA = (s.artist || "").replace(/'/g, "\\'");
  return `
    <div class="song reveal" data-song-id="${id}" style="--d:${Math.min(i, 8) * .05}s">
      <button class="song-play" type="button" aria-label="30秒試聴" onclick="togglePreview(this, '${safeT}', '${safeA}')">
        <span class="sp-num">${i + 1}</span>
        <span class="sp-icon" aria-hidden="true"></span>
      </button>
      <div class="song-meta">
        <div class="song-title">${s.title}</div>
        <div class="song-artist">${s.artist} ・ ${s.genre}</div>
        <div class="song-links">
          <a class="song-link sp" href="${spotify}" target="_blank" rel="noopener" aria-label="Spotifyでフル尺">Spotify</a>
          <a class="song-link am" href="${apple}" target="_blank" rel="noopener" aria-label="Apple Musicでフル尺">Apple</a>
          <a class="song-link yt" href="${yt}" target="_blank" rel="noopener" aria-label="YouTubeでフル尺">YouTube</a>
        </div>
      </div>
      <div class="song-fb">
        <button class="fb up ${fb === 'up' ? 'on' : ''}" onclick="vote('${id}','up',this)">good</button>
        <button class="fb down ${fb === 'down' ? 'on' : ''}" onclick="vote('${id}','down',this)">bad</button>
      </div>
    </div>`;
}

// ---- 30秒試聴(iTunes Search API: 認証不要・CORS可・previewUrl が .m4a 直リンク) ----
// ボタン単一・1曲ずつ排他再生・キャッシュあり・失敗時はリンク3兄弟に逃がす
let _audio = null;
let _activeBtn = null;
const _previewCache = new Map(); // key: "title|||artist" → previewUrl | null
function _setBtnState(btn, state) {
  // state: idle | loading | playing | error
  btn.classList.remove("loading", "playing", "error");
  if (state !== "idle") btn.classList.add(state);
}
function _stopAudio() {
  if (_audio) { try { _audio.pause(); } catch {} _audio = null; }
  if (_activeBtn) { _setBtnState(_activeBtn, "idle"); _activeBtn = null; }
}
async function togglePreview(btn, title, artist) {
  if (btn.classList.contains("loading")) return; // 連打ガード
  if (navigator.vibrate) navigator.vibrate(10);
  // 同じボタン2度押し→停止
  if (_activeBtn === btn && _audio && !_audio.paused) { _stopAudio(); return; }
  _stopAudio();
  const key = `${title}|||${artist}`;
  let url = _previewCache.get(key);
  if (url === undefined) {
    _setBtnState(btn, "loading");
    try {
      const term = encodeURIComponent(`${title} ${artist}`);
      const r = await fetch(`https://itunes.apple.com/search?term=${term}&country=jp&entity=song&limit=1`);
      const j = await r.json();
      url = j.results && j.results[0] && j.results[0].previewUrl ? j.results[0].previewUrl : null;
      _previewCache.set(key, url);
    } catch { _previewCache.set(key, null); url = null; }
  }
  if (!url) { _setBtnState(btn, "error"); setTimeout(() => _setBtnState(btn, "idle"), 1800); return; }
  _audio = new Audio(url);
  _audio.preload = "auto";
  _activeBtn = btn;
  _setBtnState(btn, "playing");
  _audio.addEventListener("ended", () => { if (_activeBtn === btn) { _setBtnState(btn, "idle"); _activeBtn = null; _audio = null; } });
  _audio.addEventListener("error", () => { _setBtnState(btn, "error"); _audio = null; _activeBtn = null; setTimeout(() => _setBtnState(btn, "idle"), 1800); });
  try { await _audio.play(); } catch { _setBtnState(btn, "error"); _audio = null; _activeBtn = null; setTimeout(() => _setBtnState(btn, "idle"), 1800); }
}
// ページ遷移時に必ず止める
window.addEventListener("beforeunload", _stopAudio);

// ---- Feedback(localStorage, Day1から収集) ----
function fbId(s) { return `${state.result}::${s.title}::${s.artist}`; }
function fbStore() {
  try { return JSON.parse(localStorage.getItem("ongaku_fb") || "{}"); }
  catch { return {}; }
}
function getFeedback(id) { return fbStore()[id] || null; }
function vote(id, dir, el) {
  const store = fbStore();
  store[id] = store[id] === dir ? null : dir;  // 再タップで取り消し
  localStorage.setItem("ongaku_fb", JSON.stringify(store));
  const row = el.closest(".song-fb");
  row.querySelectorAll(".fb").forEach(b => b.classList.remove("on"));
  if (store[id]) el.classList.add("on");
}

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

// 結果カードをPNG化 → Web Share APIで画像を共有(iOS等) or ダウンロード
async function savePNG(ev) {
  navigator.vibrate?.(20);
  const btn = ev?.currentTarget;
  const target = document.querySelector(".share-card");
  if (!target || typeof html2canvas === "undefined") {
    alert("保存できませんでした。ページを再読み込みしてください。"); return;
  }
  // ボタンに loading 表示(スピナー付き)— DOM操作で組み立て(XSS安全)
  const origChildren = btn ? Array.from(btn.childNodes) : null;
  if (btn) {
    btn.disabled = true; btn.classList.add("loading");
    while (btn.firstChild) btn.removeChild(btn.firstChild);
    const spin = document.createElement("span");
    spin.className = "spin";
    btn.appendChild(spin);
    btn.appendChild(document.createTextNode("画像を準備中…"));
  }

  // reveal が in 状態じゃないと見えないので強制的に表示状態に
  const prev = { opacity: target.style.opacity, transform: target.style.transform };
  target.style.opacity = "1"; target.style.transform = "none";

  try {
    const t = TYPE_MAP[state.result];
    // 背景色は share-card のグラデ計算結果(canvas にも転写されるよう backgroundColor: null)
    const canvas = await html2canvas(target, {
      backgroundColor: null,
      scale: Math.min(window.devicePixelRatio || 1, 2) * 1.5, // 高解像度
      useCORS: true, logging: false, allowTaint: false,
      windowWidth: document.documentElement.clientWidth,
    });

    // canvas → blob
    const blob = await new Promise(res => canvas.toBlob(res, "image/png", 0.95));
    if (!blob) throw new Error("blob failed");
    const filename = `ongaku-${t.parody}.png`;
    const file = new File([blob], filename, { type: "image/png" });

    // 1) Web Share API(iOS/Android 対応端末) — ユーザーがSNS選んでそのまま画像投稿可
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "ラブソング診断16",
          text: shareText(),
        });
        return;
      } catch (e) {
        if (e.name === "AbortError") return; // ユーザーがキャンセル
        // それ以外はフォールバックに進む
      }
    }

    // 2) フォールバック:ダウンロード
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (e) {
    console.error("savePNG", e);
    alert("画像の生成に失敗しました。スクショで保存してください。");
  } finally {
    target.style.opacity = prev.opacity || "";
    target.style.transform = prev.transform || "";
    if (btn) {
      btn.disabled = false; btn.classList.remove("loading");
      while (btn.firstChild) btn.removeChild(btn.firstChild);
      if (origChildren) origChildren.forEach(n => btn.appendChild(n));
    }
  }
}

// ---- 起動 ----
MX.blobs();
renderLanding();
