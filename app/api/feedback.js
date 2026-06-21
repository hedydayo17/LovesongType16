// POST /api/feedback
// body: { songId: "title|||artist", typeKey: "進撃のロマンチスト", vote: "up"|"down" }
//
// 設計:
//   - 各 (songId, typeKey) ペアの up/down カウンタを Hash で管理(1曲1キー)
//   - キー : fb:{songId}  値 : { "<typeKey>:up": N, "<typeKey>:down": N, ... }
//   - 全 songId は SET "fb:idx" に登録 → /api/scores-delta で列挙
//   - 投票の取り消し/切替は client 側で計算して同じエンドポイントに -1 を表すため
//     `weight` を追加で受け取れるようにする(±1)
//   - 不正リクエストは 400 / KV 未接続は 503 / 例外は 500

import { kv, kvPipeline, kvConfigured } from "./_kv.js";

const ALLOWED_TYPES = new Set([
  "バイブス警察","運命マジシャン","進撃のロマンチスト","一途ペンギン",
  "ヤキモチモンスター","推し活ベビー","チル仙人","慎重うさぎ",
  "同志の虎","マブダチエイリアン","ミステリアス狼","ド直球ザウルス",
  "ときめきパパラッチ","情熱ラブゾンビ","沼っくま","ピュアエンジェル"
]);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  if (!kvConfigured) { res.status(503).json({ error: "feedback storage not configured" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== "object") { res.status(400).json({ error: "invalid body" }); return; }

  const songId  = String(body.songId  || "").trim();
  const typeKey = String(body.typeKey || "").trim();
  const voteStr = String(body.vote    || "").trim();
  let weight    = Number(body.weight); // 通常は +1。投票取り消し時は -1
  if (!Number.isFinite(weight)) weight = 1;
  if (weight !== 1 && weight !== -1) { res.status(400).json({ error: "weight must be ±1" }); return; }

  if (!songId || songId.length > 200) { res.status(400).json({ error: "invalid songId" }); return; }
  if (!ALLOWED_TYPES.has(typeKey))    { res.status(400).json({ error: "invalid typeKey" }); return; }
  if (voteStr !== "up" && voteStr !== "down") { res.status(400).json({ error: "vote must be up/down" }); return; }

  const songKey = `fb:${songId}`;
  const field   = `${typeKey}:${voteStr}`;

  try {
    const [count] = await kvPipeline([
      ["HINCRBY", songKey, field, weight],
      ["SADD",    "fb:idx", songId],
    ]);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, songId, typeKey, vote: voteStr, count });
  } catch (e) {
    res.status(500).json({ error: e.message || "kv error" });
  }
}
