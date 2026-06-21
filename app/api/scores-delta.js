// GET /api/scores-delta
// 全曲の (songId, typeKey) ペアの up/down 集計から、recommend スコアへの補正値を返す。
//
// 補正式:
//   netVotes = up - down * 1.5            // downvote は若干強め(嫌悪は本気)
//   delta    = sign(netVotes) * pow(|netVotes|, 0.6) * 0.45
//   |delta| < 0.2 なら0扱い(ノイズ削減)
//
//   この式の挙動:
//     5 upvote   → delta ≈ +1.16
//    10 upvote   → delta ≈ +1.79
//    50 upvote   → delta ≈ +4.51
//   1 down only  → delta ≈ -0.55
//   3 down only  → delta ≈ -1.04
//
// レスポンス: { "title|||artist": { "進撃のロマンチスト": +0.84, ... }, ... }
// 5分 CDN キャッシュ(stale-while-revalidate で常に新鮮)

import { kv, kvPipeline, kvConfigured } from "./_kv.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "GET only" }); return; }
  if (!kvConfigured) {
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({ delta: {}, _note: "kv not configured" });
    return;
  }

  try {
    // 全 songId の列挙
    const songIds = (await kv(["SMEMBERS", "fb:idx"])) || [];
    if (!songIds.length) {
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
      res.status(200).json({ delta: {} });
      return;
    }
    // 各曲の HGETALL をパイプラインで並列取得
    const hashes = await kvPipeline(songIds.map(id => ["HGETALL", `fb:${id}`]));
    const delta = {};
    songIds.forEach((id, i) => {
      const h = hashes[i] || {};
      const byType = {};
      // フィールド名 "<typeKey>:up" / "<typeKey>:down" をタイプ単位で集計
      for (const [field, valStr] of Object.entries(h)) {
        const idx = field.lastIndexOf(":");
        if (idx < 0) continue;
        const typeKey = field.slice(0, idx);
        const which   = field.slice(idx + 1); // "up" | "down"
        if (which !== "up" && which !== "down") continue;
        const v = parseInt(valStr, 10);
        if (!Number.isFinite(v) || v <= 0) continue;
        if (!byType[typeKey]) byType[typeKey] = { up: 0, down: 0 };
        byType[typeKey][which] += v;
      }
      for (const [typeKey, c] of Object.entries(byType)) {
        const net = c.up - c.down * 1.5;
        const mag = Math.pow(Math.abs(net), 0.6) * 0.45;
        const d   = (net >= 0 ? 1 : -1) * mag;
        if (Math.abs(d) < 0.2) continue; // ノイズ削減
        if (!delta[id]) delta[id] = {};
        delta[id][typeKey] = Math.round(d * 100) / 100; // 小数2桁
      }
    });
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({ delta });
  } catch (e) {
    res.status(500).json({ error: e.message || "kv error" });
  }
}
