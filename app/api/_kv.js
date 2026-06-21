// Upstash Redis (Vercel KV) REST API ラッパ。SDK 依存ゼロで package.json 不要。
// 環境変数:
//   KV_REST_API_URL   — 例: https://xxx.upstash.io
//   KV_REST_API_TOKEN — Bearer トークン
// 未設定の場合は { configured:false } の helper を返し、呼び出し側で graceful fallback。

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK_ = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const kvConfigured = !!(URL_ && TOK_);

// 単一コマンド実行(例: ["HINCRBY", "key", "field", 1])
export async function kv(cmd) {
  if (!kvConfigured) return null;
  const r = await fetch(URL_, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TOK_}`,
    },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`KV ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.result;
}

// パイプライン実行(複数コマンドを1リクエストで)
export async function kvPipeline(cmds) {
  if (!kvConfigured || !cmds.length) return [];
  const r = await fetch(URL_ + "/pipeline", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TOK_}`,
    },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error(`KV pipeline ${r.status}: ${await r.text()}`);
  const j = await r.json();
  // 各エントリは { result: ... }
  return Array.isArray(j) ? j.map(x => x.result) : [];
}
