#!/usr/bin/env node
// NOT FOUND曲を iTunes で「title-only」で再検索 → 結果に artistマッチがあるか確認

import fs from "node:fs";

const NF_PATH = "audit-kv-result.json";
const INTERVAL_MS = 250;

const normTitle = (s) =>
  (s || "").toLowerCase().replace(/[\s　()()【】\[\]「」、・。,.!?!?#\-_'"’～~]/g, "");
const normArtist = (s) =>
  (s || "").toLowerCase().replace(/[\s.,'"&\-_!?()()・、 ]/g, "");

function titleSimilar(query, found) {
  const a = normTitle(query);
  const b = normTitle(found);
  if (!a || !b) return false;
  return a === b || (a.length >= 3 && b.includes(a)) || (b.length >= 3 && a.includes(b));
}
function artistSimilar(a, b) {
  const x = normArtist(a), y = normArtist(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

async function searchITunes(title) {
  // title だけで検索 → 結果から artist一致を find
  const term = encodeURIComponent(title);
  const url = `https://itunes.apple.com/search?term=${term}&country=jp&entity=song&limit=25`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const d = await r.json();
  return d.results || [];
}

async function main() {
  const audit = JSON.parse(fs.readFileSync(NF_PATH, "utf-8"));
  const nfList = audit.notFound || [];
  console.log(`NOT FOUND: ${nfList.length} 件を iTunes title-only 再検索`);

  const hit = [];      // 正しい曲発見、修正不要 or タイトル微修正
  const wrong = [];    // iTunes hit はあるが artist違い(削除候補)
  const noHit = [];    // iTunes 0件(削除確定)

  for (let i = 0; i < nfList.length; i++) {
    const { title, artist } = nfList[i];
    try {
      const results = await searchITunes(title);
      if (!results.length) {
        noHit.push({ title, artist });
        console.log(`${i+1}/${nfList.length} [NO HIT] ${title}/${artist}`);
        await new Promise(r => setTimeout(r, INTERVAL_MS));
        continue;
      }
      // title一致 + artist一致 を find
      const match = results.find(r => titleSimilar(title, r.trackName) && artistSimilar(artist, r.artistName));
      if (match) {
        hit.push({
          title, artist,
          newTitle: normTitle(title) !== normTitle(match.trackName) ? match.trackName : null,
          itunesArtist: match.artistName,
        });
        const mark = normTitle(title) !== normTitle(match.trackName) ? `→ "${match.trackName}"` : "✓";
        console.log(`${i+1}/${nfList.length} [HIT] ${title}/${artist} ${mark}`);
      } else {
        // titleはあるがartist違う = この曲はそのアーティストの曲じゃない可能性高い
        const top = results[0];
        wrong.push({ title, artist, itunesTitle: top.trackName, itunesArtist: top.artistName });
        console.log(`${i+1}/${nfList.length} [WRONG] ${title}/${artist} (iTunes top: ${top.trackName}/${top.artistName})`);
      }
    } catch (e) {
      noHit.push({ title, artist, error: e.message });
      console.log(`${i+1}/${nfList.length} [ERR] ${title}/${artist}`);
    }
    await new Promise(r => setTimeout(r, INTERVAL_MS));
  }

  console.log(`\n=== Summary ===`);
  console.log(`HIT(残す or 修正): ${hit.length}`);
  console.log(`WRONG(別アーティスト): ${wrong.length}`);
  console.log(`NO HIT:            ${noHit.length}`);

  fs.writeFileSync("fix-nf-v2.json", JSON.stringify({ hit, wrong, noHit }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
