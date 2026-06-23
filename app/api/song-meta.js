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
  // 自由形式クエリ(フィールド指定なし)で検索ヒット率を最大化。
  // 結果から title一致 + artist一致 を確認して採用。
  // 旧:`track:${title} artist:${artist}` は Spotify登録名が厳密一致しないと hit しないため、
  //    「ナイトダンサー/imase」「白雪姫/back number」等の実在曲も NOT FOUND になっていた。
  const q = encodeURIComponent(`${title} ${artist}`);
  const r = await fetch(
    `https://api.spotify.com/v1/search?q=${q}&type=track&limit=10&market=JP`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) return { httpError: r.status };
  const d = await r.json();
  return { items: d.tracks?.items || [] };
}

// iTunes Search API(CORSはあるが、サーバから叩く分には問題なし)
// 主に preview_url 取得用(Spotifyが2024年11月以降preview廃止傾向のため)
async function searchITunes(title, artist) {
  const term = encodeURIComponent(`${title} ${artist}`);
  const r = await fetch(
    `https://itunes.apple.com/search?term=${term}&country=jp&entity=song&limit=5`
  );
  if (!r.ok) return null;
  const d = await r.json();
  return d.results || [];
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

  // v2(新ロジック)と v1(旧)両方をcheck:v2優先、なければ v1 fallback
  // v1 にはartwork等は入ってるが旧検索ロジックの結果なので、preview/artworkが空でも
  // 新ロジックで再検索する余地を残す。Spotify rate limit中も v1のartworkは使えるのが利点
  const keyV2 = `meta:v2:${title}|||${artist}`;
  const keyV1 = `meta:${title}|||${artist}`;

  // 1) KV check(v2優先 → v1 fallback)
  //    v1 fallbackは preview が含まれてれば即返却、preview無しなら下の新ロジックに進む
  //    (v1時代は preview なし、v2 で iTunes fallback で preview取得を試みる)
  let cachedV1Partial = null;
  try {
    const cached = await kv.get(keyV2);
    if (cached) {
      res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
      res.status(200).json({ ...cached, cached: true });
      return;
    }
    const v1 = await kv.get(keyV1);
    if (v1) {
      if (v1.previewUrl) {
        // v1 で preview もあれば即返却
        res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
        res.status(200).json({ ...v1, cached: true });
        return;
      }
      // preview無し v1 は artwork等を引き継ぎつつ、preview補完を試みる
      cachedV1Partial = v1;
    }
  } catch (e) {
    console.warn("[song-meta] KV unavailable:", e?.message);
  }
  const key = keyV2;

  // 2) Spotify検索(自由形式クエリ + title一致 + artist一致 で正しい track選定)
  const token = await getSpotifyToken();
  const normArtist = (s) => (s||"").toLowerCase().replace(/[\s.,'"&\-_!?()]/g, "");
  const userArtNorm = normArtist(artist);
  let spotifyTrack = null;
  if (token) {
    try {
      const result = await searchSpotify(title, artist, token);
      if (result.httpError === 429) {
        res.status(429).json({ error: "rate limited" });
        return;
      }
      const items = result.items || [];
      // タイトル一致 + アーティスト一致(部分一致でOK)
      spotifyTrack = items.find((it) => {
        if (!titleMatchOK(title, it.name)) return false;
        const arts = (it.artists || []).map(a => normArtist(a.name));
        return arts.some(a => a.includes(userArtNorm) || userArtNorm.includes(a));
      });
    } catch (e) {
      console.warn("[song-meta] spotify search failed:", e?.message);
    }
  }

  let meta = spotifyTrack ? {
    spotifyId: spotifyTrack.id,
    previewUrl: spotifyTrack.preview_url || null,
    artworkUrl: spotifyTrack.album?.images?.[0]?.url || null,
    spotifyUrl: spotifyTrack.external_urls?.spotify || null,
  } : { spotifyId: null, previewUrl: null, artworkUrl: null, spotifyUrl: null };
  // v1 partial があれば、空のフィールドだけ補完(Spotifyが再検索で見つけられなかった場合の保険)
  if (cachedV1Partial) {
    if (!meta.spotifyId && cachedV1Partial.spotifyId) meta.spotifyId = cachedV1Partial.spotifyId;
    if (!meta.artworkUrl && cachedV1Partial.artworkUrl) meta.artworkUrl = cachedV1Partial.artworkUrl;
    if (!meta.spotifyUrl && cachedV1Partial.spotifyUrl) meta.spotifyUrl = cachedV1Partial.spotifyUrl;
  }

  // 2b) iTunes fallback:preview_url または artworkUrl が空の場合 (Spotify が
  //     2024年11月以降 preview を廃止傾向のため、サーバ側で iTunes も叩く)
  if (!meta.previewUrl || !meta.artworkUrl) {
    try {
      const results = (await searchITunes(title, artist)) || [];
      const it = results.find((r) => {
        if (!titleMatchOK(title, r.trackName)) return false;
        const a = normArtist(r.artistName || "");
        return a.includes(userArtNorm) || userArtNorm.includes(a);
      });
      if (it) {
        if (!meta.previewUrl && it.previewUrl) meta.previewUrl = it.previewUrl;
        if (!meta.artworkUrl && it.artworkUrl100) {
          meta.artworkUrl = (it.artworkUrl100 || "").replace(/100x100/g, "600x600");
        }
      }
    } catch (e) {
      console.warn("[song-meta] itunes search failed:", e?.message);
    }
  }

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
