// Vercel Serverless Function:Spotify Client Credentials Flow でアクセストークンを発行
// クライアント側 (app.js) からは GET /api/spotify-token で取得
// Client Secret はサーバー環境変数からのみ参照(フロントには露出しない)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.status(500).json({ error: "Spotify credentials not configured on server" });
    return;
  }

  try {
    const tokenResp = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });
    const data = await tokenResp.json();
    if (!tokenResp.ok || !data.access_token) {
      res.status(tokenResp.status || 500).json({ error: "Token request failed", data });
      return;
    }
    // Spotify トークンは 3600秒有効。CDN/エッジで 50分キャッシュ(余裕の60秒分早めに失効)
    res.setHeader("Cache-Control", "s-maxage=3000, stale-while-revalidate=600");
    res.status(200).json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type || "Bearer",
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "unknown error" });
  }
}
