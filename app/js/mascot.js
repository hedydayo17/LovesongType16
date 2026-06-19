// ============================================================
// mascot.js — 16タイプのキャラ絵(手続き的SVG・全身/表情/アウトライン)
// ラブタイプ64寄せ:体+手足+顔+タイプ別トッパー、ステッカー風の縁取り
// mascotSVG(parodyKey) → SVG文字列
// ============================================================
(() => {
  function darken(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r * (1 - f)); g = Math.round(g * (1 - f)); b = Math.round(b * (1 - f));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }
  function lighten(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r + (255 - r) * f); g = Math.round(g + (255 - g) * f); b = Math.round(b + (255 - b) * f);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  const CFG = {
    "バイブス警察":     { topper: "cap",     eyes: "sparkle" },
    "運命マジシャン":   { topper: "hat",     eyes: "sparkle" },
    "ロマンチスト":     { topper: "heart",   eyes: "dot" },
    "一途ペンギン":     { topper: "beak",    eyes: "dot" },
    "ヤキモチモンスター": { topper: "horns",  eyes: "dot" },
    "推し活ベビー":     { topper: "bow",     eyes: "sparkle" },
    "チル仙人":         { topper: "leaf",    eyes: "closed" },
    "慎重うさぎ":       { topper: "bunny",   eyes: "dot" },
    "同志予報士":       { topper: "star",    eyes: "dot" },
    "マブダチエイリアン": { topper: "antenna", eyes: "big" },
    "ミステリアス狼":   { topper: "wolf",    eyes: "dot" },
    "ド直球ザウルス":   { topper: "spikes",  eyes: "dot" },
    "ときめきパパラッチ": { topper: "sparkleTop", eyes: "sparkle" },
    "情熱ラブゾンビ":   { topper: "flame",   eyes: "dot" },
    "沼っくま":         { topper: "bearears", eyes: "dot" },
    "ピュアエンジェル": { topper: "halo",    eyes: "sparkle" }
  };

  function topperSVG(kind, c, dk, out) {
    const st = `stroke="${out}" stroke-width="2.2"`;
    switch (kind) {
      case "bearears": return `<circle cx="28" cy="22" r="12" fill="${dk}" ${st}/><circle cx="72" cy="22" r="12" fill="${dk}" ${st}/>`;
      case "bunny": return `<ellipse cx="35" cy="8" rx="7.5" ry="20" fill="${c}" ${st}/><ellipse cx="65" cy="8" rx="7.5" ry="20" fill="${c}" ${st}/><ellipse cx="35" cy="10" rx="3" ry="12" fill="#ffd1e0"/><ellipse cx="65" cy="10" rx="3" ry="12" fill="#ffd1e0"/>`;
      case "wolf": return `<path d="M20 28 L24 4 L42 22 Z" fill="${dk}" ${st}/><path d="M80 28 L76 4 L58 22 Z" fill="${dk}" ${st}/>`;
      case "horns": return `<path d="M30 22 Q24 4 37 12 Z" fill="${dk}" ${st}/><path d="M70 22 Q76 4 63 12 Z" fill="${dk}" ${st}/>`;
      case "spikes": return `<path d="M32 20 L40 4 L48 20 L56 4 L64 20 L72 4 L78 22 Z" fill="${dk}" ${st}/>`;
      case "cap": return `<path d="M24 26 Q50 2 76 26 Z" fill="${dk}" ${st}/><rect x="22" y="24" width="56" height="8" rx="4" fill="${dk}" ${st}/><circle cx="50" cy="14" r="4.5" fill="#ffd86b"/>`;
      case "hat": return `<path d="M50 -6 L32 28 L68 28 Z" fill="${dk}" ${st}/><circle cx="50" cy="4" r="3.5" fill="#ffd86b"/><circle cx="43" cy="18" r="2.4" fill="#fff"/><circle cx="57" cy="22" r="2" fill="#fff"/>`;
      case "halo": return `<ellipse cx="50" cy="6" rx="22" ry="6.5" fill="none" stroke="#ffd86b" stroke-width="4.5"/>`;
      case "heart": return `<path d="M50 6 C45 -2 34 1 34 10 C34 18 50 28 50 28 C50 28 66 18 66 10 C66 1 55 -2 50 6 Z" fill="#ff5e8a" ${st}/>`;
      case "bow": return `<path d="M50 18 L32 8 L32 28 Z" fill="#ff5e8a" ${st}/><path d="M50 18 L68 8 L68 28 Z" fill="#ff5e8a" ${st}/><circle cx="50" cy="18" r="6" fill="${dk}" ${st}/>`;
      case "flame": return `<path d="M50 -4 C42 10 58 12 50 28 C66 20 64 6 50 -4 Z" fill="#ff8a3d" ${st}/>`;
      case "leaf": return `<path d="M50 0 Q38 16 50 30 Q62 16 50 0 Z" fill="#5fc98f" ${st}/>`;
      case "antenna": return `<line x1="38" y1="18" x2="30" y2="0" stroke="${dk}" stroke-width="3.5"/><line x1="62" y1="18" x2="70" y2="0" stroke="${dk}" stroke-width="3.5"/><circle cx="29" cy="-2" r="5" fill="#ffd86b" ${st}/><circle cx="71" cy="-2" r="5" fill="#ffd86b" ${st}/>`;
      case "star": return star(50, 8, 11);
      case "sparkleTop": return star(32, 8, 7) + star(70, 10, 8) + star(50, 0, 5);
      case "beak": return ``; // くちばしは顔側に描く
      default: return "";
    }
  }
  function star(cx, cy, r) {
    let pts = "";
    for (let i = 0; i < 10; i++) {
      const ang = Math.PI / 5 * i - Math.PI / 2;
      const rad = i % 2 ? r * .45 : r;
      pts += `${(cx + Math.cos(ang) * rad).toFixed(1)},${(cy + Math.sin(ang) * rad).toFixed(1)} `;
    }
    return `<polygon points="${pts}" fill="#ffd86b"/>`;
  }
  function eyesSVG(kind) {
    const ink = "#3a2b3a";
    switch (kind) {
      case "closed": return `<path d="M34 60 Q40 66 46 60" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M54 60 Q60 66 66 60" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      case "sparkle": return `<circle cx="39" cy="60" r="6.5" fill="${ink}"/><circle cx="61" cy="60" r="6.5" fill="${ink}"/><circle cx="36.5" cy="57.5" r="2.2" fill="#fff"/><circle cx="58.5" cy="57.5" r="2.2" fill="#fff"/>`;
      case "big": return `<circle cx="39" cy="60" r="8.5" fill="#fff" stroke="#3a2b3a" stroke-width="1.5"/><circle cx="61" cy="60" r="8.5" fill="#fff" stroke="#3a2b3a" stroke-width="1.5"/><circle cx="40" cy="61" r="4.2" fill="${ink}"/><circle cx="62" cy="61" r="4.2" fill="${ink}"/>`;
      default: return `<circle cx="39" cy="60" r="6" fill="${ink}"/><circle cx="61" cy="60" r="6" fill="${ink}"/><circle cx="37" cy="58" r="2" fill="#fff"/><circle cx="59" cy="58" r="2" fill="#fff"/>`;
    }
  }

  window.mascotSVG = function (parodyKey) {
    const t = (typeof TYPE_MAP !== "undefined") ? TYPE_MAP[parodyKey] : null;
    const c = t ? t.color : "#ff5e8a";
    const dk = darken(c, .2), bel = lighten(c, .74), out = darken(c, .34);
    const cfg = CFG[parodyKey] || { topper: "", eyes: "dot" };
    const beak = cfg.topper === "beak" ? `<path d="M44 70 L56 70 L50 80 Z" fill="#ffb13d" stroke="${out}" stroke-width="1.6"/>` : "";
    return `
<svg class="mascot-svg" viewBox="-8 -10 116 134" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${parodyKey}">
  ${topperSVG(cfg.topper, c, dk, out)}
  <ellipse cx="34" cy="106" rx="10" ry="6.5" fill="${dk}" stroke="${out}" stroke-width="2.2"/>
  <ellipse cx="66" cy="106" rx="10" ry="6.5" fill="${dk}" stroke="${out}" stroke-width="2.2"/>
  <ellipse cx="13" cy="74" rx="9" ry="13" fill="${c}" stroke="${out}" stroke-width="2.4"/>
  <ellipse cx="87" cy="74" rx="9" ry="13" fill="${c}" stroke="${out}" stroke-width="2.4"/>
  <ellipse cx="50" cy="62" rx="39" ry="40" fill="${c}" stroke="${out}" stroke-width="2.6"/>
  <ellipse cx="50" cy="70" rx="25" ry="23" fill="${bel}"/>
  ${eyesSVG(cfg.eyes)}
  ${beak}
  <ellipse cx="30" cy="71" rx="5.5" ry="3.8" fill="#ff7aa0" opacity=".55"/>
  <ellipse cx="70" cy="71" rx="5.5" ry="3.8" fill="#ff7aa0" opacity=".55"/>
  ${beak ? "" : `<path d="M44 73 Q50 79 56 73" stroke="#3a2b3a" stroke-width="2.6" fill="none" stroke-linecap="round"/>`}
</svg>`;
  };
})();
