// Vercel Serverless Function:曲メタ(preview/artwork/spotifyUrl)取得 + Vercel KV永続キャッシュ
//
// GET /api/song-meta?t=<title>&a=<artist>
//   → Vercel KV check → なければ Spotify検索 → KV保存 → 返却
//
// 効果:
//   - 同曲は Spotify を1回しか叩かない(2回目以降は KV から数msで返却)
//   - 全710曲のキャッシュが揃えば Spotify rate limit から永久脱出
//   - 将来10,000曲スケールへの基盤
//
// 環境変数(Vercel側で自動設定):
//   - SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET
//   - KV_REST_API_URL / KV_REST_API_TOKEN(KVを有効化すると自動付与)

import { kv } from "@vercel/kv";

const normTitle = (s) =>
  (s || "").toLowerCase().replace(/[\s　()()【】\[\]「」、・。,.!?!?#\-_'"’]/g, "");

function titleMatchOK(query, found) {
  const a = normTitle(query);
  const b = normTitle(found);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

// Spotify Client Credentials token をモジュール内でキャッシュ(関数インスタンスの間)
let _spToken = null;
let _spTokenExp = 0;
async function getSpotifyToken() {
  if (_spToken && Date.now() < _spTokenExp) return _spToken;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) return null;
  const d = await r.json();
  if (!d.access_token) return null;
  _spToken = d.access_token;
  _spTokenExp = Date.now() + ((d.expires_in || 3600) - 60) * 1000;
  return _spToken;
}

async function searchSpotify(title, artist, token) {
  const q = encodeURIComponent(`track:${title} artist:${artist}`);
  const r = await fetch(
    `https://api.spotify.com/v1/search?q=${q}&type=track&limit=3&market=JP`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) return { httpError: r.status };
  const d = await r.json();
  return { items: d.tracks?.items || [] };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const title = String(req.query.t || "").trim();
  const artist = String(req.query.a || "").trim();
  if (!title || !artist) {
    res.status(400).json({ error: "missing t or a" });
    return;
  }

  const key = `meta:${title}|||${artist}`;

  // 1) KV check
  try {
    const cached = await kv.get(key);
    if (cached) {
      // ブラウザ側でも 1日キャッシュ(stale-while-revalidate で常に新鮮)
      res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
      res.status(200).json({ ...cached, cached: true });
      return;
    }
  } catch (e) {
    // KV未設定 or 接続エラー → 直接Spotifyに fallback
    console.warn("[song-meta] KV unavailable:", e?.message);
  }

  // 2) Spotify検索
  const token = await getSpotifyToken();
  if (!token) {
    res.status(500).json({ error: "spotify token unavailable" });
    return;
  }
  let result;
  try {
    result = await searchSpotify(title, artist, token);
  } catch (e) {
    res.status(500).json({ error: e.message });
    return;
  }
  if (result.httpError === 429) {
    res.status(429).json({ error: "rate limited" });
    return;
  }
  if (result.httpError) {
    res.status(result.httpError).json({ error: `spotify http ${result.httpError}` });
    return;
  }
  // title一致check + title一致するtrackを採用
  const items = result.items || [];
  const t = items.find((it) => titleMatchOK(title, it.name));
  const meta = t
    ? {
        spotifyId: t.id,
        previewUrl: t.preview_url || null,
        artworkUrl: t.album?.images?.[0]?.url || null,
        spotifyUrl: t.external_urls?.spotify || null,
      }
    : { spotifyId: null, previewUrl: null, artworkUrl: null, spotifyUrl: null };

  // 3) KV保存(NOT FOUND も「キャッシュ済」として保存して再検索を避ける)
  try {
    // 30日 TTL(将来データ更新時に自動破棄)
    await kv.set(key, meta, { ex: 60 * 60 * 24 * 30 });
  } catch (e) {
    console.warn("[song-meta] KV write failed:", e?.message);
  }

  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  res.status(200).json(meta);
}
