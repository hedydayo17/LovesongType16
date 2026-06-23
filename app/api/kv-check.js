// KV接続テスト用エンドポイント
// GET /api/kv-check で env vars と KV読み書きの動作を確認
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const debug = {
    env: {
      KV_REST_API_URL: !!process.env.KV_REST_API_URL,
      KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
      KV_URL: !!process.env.KV_URL,
      // 他のprefix付きenvも一応check
      keys: Object.keys(process.env).filter(k => /KV|REDIS|UPSTASH/i.test(k)),
    },
    ops: {},
  };
  try {
    const testKey = "kv-check:test";
    const value = { ok: true, ts: Date.now() };
    await kv.set(testKey, value, { ex: 60 });
    debug.ops.set = "ok";
    const got = await kv.get(testKey);
    debug.ops.get = got;
    debug.ops.match = JSON.stringify(got) === JSON.stringify(value);
  } catch (e) {
    debug.ops.error = e?.message || String(e);
    debug.ops.errorName = e?.name;
  }
  res.status(200).json(debug);
}
