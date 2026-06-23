#!/usr/bin/env node
// 全715曲を Spotify Search API で実検証して、
// NOT FOUND / TITLE MISMATCH の曲を audit-result.json に出力する。
//
// 実行: node scripts/audit-spotify-full.mjs
//   - 本番の /api/spotify-token から token 取得
//   - 各曲を 700-1000ms 間隔で叩く(rate limit回避)
//   - 429時は Retry-After ヘッダ尊重して待つ
//   - ALT_NAMES マップで2回目の検索も試す
//
// 出力:
//   audit-result.json:{ ok, notFound, titleMismatch, fails }
//   各曲ごとに spotify返却の title/artist も記録(目視で「これは別曲返ってる」と判定可能)
//
// 全715曲 × 700ms = 約8.5分

import fs from "node:fs";

const SONGS_PATH = "app/js/songs.js";
const TOKEN_URL = "https://lovesong-type16.vercel.app/api/spotify-token";
const ALT_NAMES_PATH = "app/js/app.js"; // ARTIST_ALT_NAMES が定義されてる
const INTERVAL_MS = 700;
const OUT = "audit-result.json";

const normTitle = (s) =>
  (s || "").toLowerCase().replace(/[\s　()()【】\[\]「」、・。,.!?!?#\-_'"’]/g, "");

function titleMatchOK(query, found) {
  const a = normTitle(query);
  const b = normTitle(found);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function parseSongs(src) {
  const songs = [];
  const re = /title:\s*"([^"]+)",\s*artist:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    songs.push({ title: m[1], artist: m[2] });
  }
  return songs;
}

function parseAltNames(src) {
  const m = src.match(/const ARTIST_ALT_NAMES\s*=\s*\{([^}]+)\}/s);
  if (!m) return {};
  const map = {};
  const re = /"([^"]+)":\s*"([^"]+)"/g;
  let mm;
  while ((mm = re.exec(m[1])) !== null) {
    map[mm[1]] = mm[2];
  }
  return map;
}

async function searchSpotify(title, artist, token) {
  const q = encodeURIComponent(`track:${title} artist:${artist}`);
  const url = `https://api.spotify.com/v1/search?q=${q}&type=track&limit=3&market=JP`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 429) {
      const wait = parseInt(r.headers.get("retry-after") || "5", 10);
      console.log(`  [429] Retry-After: ${wait}s`);
      await new Promise((res) => setTimeout(res, (wait + 1) * 1000));
      continue;
    }
    if (r.status === 401) {
      throw new Error("401_unauthorized");
    }
    if (!r.ok) {
      return { httpError: r.status };
    }
    const d = await r.json();
    return { items: d.tracks?.items || [] };
  }
  return { httpError: 429 };
}

async function main() {
  console.log("=== Spotify full audit ===");

  const songsSrc = fs.readFileSync(SONGS_PATH, "utf-8");
  const songs = parseSongs(songsSrc);
  console.log(`Songs: ${songs.length}`);

  const altSrc = fs.readFileSync(ALT_NAMES_PATH, "utf-8");
  const ALT = parseAltNames(altSrc);
  console.log(`ALT_NAMES: ${Object.keys(ALT).length}`);

  // token
  const tr = await fetch(TOKEN_URL);
  if (!tr.ok) { console.error("token fetch failed:", tr.status); process.exit(1); }
  const { access_token } = await tr.json();
  if (!access_token) { console.error("no token"); process.exit(1); }
  console.log("token ok");

  const ok = [];
  const notFound = [];
  const titleMismatch = [];
  const fails = [];

  for (let i = 0; i < songs.length; i++) {
    const { title, artist } = songs[i];
    let result;
    try {
      result = await searchSpotify(title, artist, access_token);
      // ALT_NAMES でリトライ
      if ((!result.items || !result.items.length) && ALT[artist]) {
        await new Promise(r => setTimeout(r, 300));
        result = await searchSpotify(title, ALT[artist], access_token);
      }
    } catch (e) {
      console.error(`  [ERROR] ${e.message}`);
      fails.push({ title, artist, error: e.message });
      continue;
    }
    if (result.httpError) {
      fails.push({ title, artist, http: result.httpError });
      console.log(`${i+1}/${songs.length} [HTTP ${result.httpError}] ${title}/${artist}`);
      continue;
    }
    const items = result.items || [];
    if (!items.length) {
      notFound.push({ title, artist });
      console.log(`${i+1}/${songs.length} [NOT FOUND] ${title}/${artist}`);
    } else {
      const matched = items.find((it) => titleMatchOK(title, it.name));
      if (!matched) {
        titleMismatch.push({
          title, artist,
          spotifyTitle: items[0].name,
          spotifyArtist: items[0].artists[0]?.name,
        });
        console.log(`${i+1}/${songs.length} [MISMATCH] ${title}/${artist} -> ${items[0].name}/${items[0].artists[0]?.name}`);
      } else {
        ok.push({ title, artist, spotifyId: matched.id, preview: !!matched.preview_url });
        if ((i + 1) % 50 === 0) console.log(`${i+1}/${songs.length} ✓`);
      }
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }

  console.log(`\n=== Summary ===`);
  console.log(`OK:            ${ok.length}`);
  console.log(`NOT FOUND:     ${notFound.length}`);
  console.log(`TITLE MISMATCH:${titleMismatch.length}`);
  console.log(`HTTP FAILS:    ${fails.length}`);

  fs.writeFileSync(OUT, JSON.stringify({ ok, notFound, titleMismatch, fails }, null, 2));
  console.log(`\nWrote ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
