#!/usr/bin/env node
// Spotify が4時間banされた状況で、MusicBrainz API(無料、無認証、1req/sec rate limit)
// で全715曲の実在verify。タイトル+アーティストで検索 → ヒットしなければ「実在
// しない/誤データ」と判定。
//
// MusicBrainz は世界最大のオープン音楽データベース(Spotifyより網羅性は劣るが、
// 実在性確認には十分)。
//
// 出力: audit-mb-result.json { ok, notFound }
// 実行時間: 715 × 1.1秒 = 約13分

import fs from "node:fs";

const SONGS_PATH = "app/js/songs.js";
const OUT = "audit-mb-result.json";
const INTERVAL_MS = 1100; // MusicBrainz の rate limit を尊重
const USER_AGENT = "lovesong-type16-audit/1.0 (https://lovesong-type16.vercel.app)";

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

async function searchMB(title, artist) {
  // MusicBrainz Lucene query syntax
  const q = `recording:"${title}" AND artist:"${artist}"`;
  const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(q)}&fmt=json&limit=5`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" }
    });
    if (r.status === 503 || r.status === 429) {
      console.log("  [throttle] waiting 3s");
      await new Promise((res) => setTimeout(res, 3000));
      continue;
    }
    if (!r.ok) return { httpError: r.status };
    const d = await r.json();
    return { recordings: d.recordings || [] };
  }
  return { httpError: 503 };
}

async function main() {
  console.log("=== MusicBrainz full audit ===");

  const src = fs.readFileSync(SONGS_PATH, "utf-8");
  const songs = parseSongs(src);
  console.log(`Songs: ${songs.length}`);

  const ok = [];
  const notFound = [];
  const fails = [];

  for (let i = 0; i < songs.length; i++) {
    const { title, artist } = songs[i];
    let result;
    try {
      result = await searchMB(title, artist);
    } catch (e) {
      fails.push({ title, artist, error: e.message });
      console.log(`${i+1}/${songs.length} [ERROR] ${title}/${artist}`);
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
      continue;
    }
    if (result.httpError) {
      fails.push({ title, artist, http: result.httpError });
      console.log(`${i+1}/${songs.length} [HTTP ${result.httpError}] ${title}/${artist}`);
    } else {
      const rec = result.recordings || [];
      // title一致 + artist credit に含まれるか
      const matched = rec.find((r) => {
        const titleOK = titleMatchOK(title, r.title);
        const artistsOnRec = (r["artist-credit"] || []).map(c => (c.artist?.name || c.name || "").toLowerCase());
        const artistOK = artistsOnRec.some(a => a.includes(artist.toLowerCase()) || artist.toLowerCase().includes(a));
        return titleOK && artistOK;
      });
      if (matched) {
        ok.push({ title, artist, mbid: matched.id });
        if ((i + 1) % 50 === 0) console.log(`${i+1}/${songs.length} ✓ (${ok.length} ok, ${notFound.length} notFound)`);
      } else {
        notFound.push({
          title, artist,
          topResult: rec[0] ? `${rec[0].title}/${(rec[0]["artist-credit"]||[])[0]?.artist?.name || "?"}` : null,
        });
        console.log(`${i+1}/${songs.length} [NOT FOUND] ${title}/${artist}` + (rec[0] ? ` -> ${rec[0].title}/${(rec[0]["artist-credit"]||[])[0]?.artist?.name || "?"}` : ""));
      }
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }

  console.log(`\n=== Summary ===`);
  console.log(`OK:        ${ok.length} / ${songs.length}`);
  console.log(`NOT FOUND: ${notFound.length}`);
  console.log(`FAILS:     ${fails.length}`);

  fs.writeFileSync(OUT, JSON.stringify({ ok, notFound, fails }, null, 2));
  console.log(`\nWrote ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
