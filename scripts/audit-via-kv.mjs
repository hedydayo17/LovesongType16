#!/usr/bin/env node
// KV経由で全曲verify。各曲を /api/song-meta?t=...&a=... で叩く。
// - KVミスならServerless Function が Spotify検索 → KV保存
// - KVヒットなら高速で結果返却
// - rate limit影響なし(KV経由なのでクライアント側は Spotify を叩かない)

import fs from "node:fs";

const SONGS_PATH = "app/js/songs.js";
const API_URL = "https://lovesong-type16.vercel.app/api/song-meta";
const INTERVAL_MS = 250; // KV経由なので速くてOK(ただしFunction同時呼び避ける)
const OUT = "audit-kv-result.json";

const normTitle = (s) =>
  (s || "").toLowerCase().replace(/[\s　()()【】\[\]「」、・。,.!?!?#\-_'"’]/g, "");

function titleMatchOK(a, b) {
  const x = normTitle(a), y = normTitle(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
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

async function main() {
  console.log("=== KV-based full audit ===");
  const songs = parseSongs(fs.readFileSync(SONGS_PATH, "utf-8"));
  console.log(`Songs: ${songs.length}`);

  const okPreview = [];
  const okArtwork = [];
  const okAll = [];
  const notFound = [];
  const fails = [];

  for (let i = 0; i < songs.length; i++) {
    const { title, artist } = songs[i];
    const url = `${API_URL}?t=${encodeURIComponent(title)}&a=${encodeURIComponent(artist)}`;
    try {
      const r = await fetch(url);
      if (!r.ok) {
        fails.push({ title, artist, http: r.status });
        console.log(`${i+1}/${songs.length} [HTTP ${r.status}] ${title}/${artist}`);
        await new Promise(r => setTimeout(r, INTERVAL_MS));
        continue;
      }
      const d = await r.json();
      if (!d.spotifyId) {
        notFound.push({ title, artist });
        console.log(`${i+1}/${songs.length} [NOT FOUND] ${title}/${artist}`);
      } else {
        if (d.previewUrl) okPreview.push({ title, artist });
        if (d.artworkUrl) okArtwork.push({ title, artist });
        if (d.previewUrl && d.artworkUrl) okAll.push({ title, artist });
        if ((i + 1) % 50 === 0) {
          console.log(`${i+1}/${songs.length} ✓ (preview:${okPreview.length} / art:${okArtwork.length} / notFound:${notFound.length})`);
        }
      }
    } catch (e) {
      fails.push({ title, artist, error: e.message });
      console.log(`${i+1}/${songs.length} [ERROR] ${title}/${artist}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, INTERVAL_MS));
  }

  console.log("\n=== Summary ===");
  console.log(`Total:        ${songs.length}`);
  console.log(`Spotify hit:  ${songs.length - notFound.length - fails.length}`);
  console.log(` - preview有: ${okPreview.length}`);
  console.log(` - artwork有: ${okArtwork.length}`);
  console.log(` - 両方有:    ${okAll.length}`);
  console.log(`NOT FOUND:    ${notFound.length}`);
  console.log(`FAILS:        ${fails.length}`);

  fs.writeFileSync(OUT, JSON.stringify({ okPreview, okArtwork, okAll, notFound, fails }, null, 2));
  console.log(`\nWrote ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
