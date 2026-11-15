// ReelMate AI 중계 서버 (Cloudflare Worker)
// - Claude API 키를 숨기고, 지인용 접속 코드가 맞을 때만 Claude(Opus 5.5)에 사진 분석을 요청한다.
// - 사진은 저장하지 않고 Claude에 전달만 한다.
// 필요한 설정(Cloudflare 대시보드 > Settings > Variables and Secrets):
//   ANTHROPIC_API_KEY (Secret)  : Claude Console에서 만든 API 키
//   ACCESS_CODE       (Secret)  : 지인에게 알려줄 접속 코드
//   ALLOWED_ORIGIN    (Text)    : https://sangpd3969-pixel.github.io
const MODEL = "claude-opus-5-5";

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Access-Code",
    "Access-Control-Max-Age": "86400",
  };
}
function json(body, status, env) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(env) } });
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(env) });
    const url = new URL(req.url);
    if (req.method !== "POST" || url.pathname !== "/caption") return json({ error: "not found" }, 404, env);
    if (env.ALLOWED_ORIGIN && req.headers.get("Origin") !== env.ALLOWED_ORIGIN) return json({ error: "origin" }, 403, env);
    if (!env.ACCESS_CODE || req.headers.get("X-Access-Code") !== env.ACCESS_CODE) return json({ error: "접속 코드가 맞지 않아요" }, 401, env);

    let body;
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, env); }
    const images = (body.images || []).slice(0, 10);
    const mood = String(body.mood || "AI에게 맡기기").slice(0, 30);
    if (!images.length) return json({ error: "사진이 없어요" }, 400, env);

    const content = images.map((b64) => ({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: String(b64).replace(/^data:image\/\w+;base64,/, "") },
    }));
    content.push({
      type: "text",
      text:
        `위 사진 ${images.length}장으로 인스타 릴스를 만든다. 분위기: "${mood}" ` +
        `("AI에게 맡기기"면 사진에 맞는 분위기를 직접 고른다).\n` +
        `사진 순서대로 각 장면 자막을 한국어로 1개씩, 각 16자 이내로 쓰고, 영상 제목(20자 이내)과 해시태그 5개를 만든다.\n` +
        `사진에 보이는 것만 근거로 쓰고, 사람 이름이나 보이지 않는 사실은 지어내지 않는다.\n` +
        `반드시 JSON만 출력: {"title":"...","captions":["..."],"hashtags":["#..."]}`,
    });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 600, messages: [{ role: "user", content }] }),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: (data.error && data.error.message) || "AI 오류" }, 502, env);
    const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    const m = text.match(/\{[\s\S]*\}/);
    let out;
    try { out = JSON.parse(m ? m[0] : text); } catch { return json({ error: "AI 응답 해석 실패" }, 502, env); }
    out.captions = (out.captions || []).slice(0, images.length);
    while (out.captions.length < images.length) out.captions.push("");
    return json({ title: out.title || "", captions: out.captions, hashtags: out.hashtags || [], usage: data.usage }, 200, env);
  },
};
