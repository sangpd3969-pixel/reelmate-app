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
    const request = String(body.request || "").slice(0, 500);
    const keep = Array.isArray(body.captions) ? body.captions.slice(0, 10).map((c) => String(c).slice(0, 40)) : null;
    if (!images.length) return json({ error: "사진이 없어요" }, 400, env);

    const content = images.map((b64) => ({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: String(b64).replace(/^data:image\/\w+;base64,/, "") },
    }));
    content.push({
      type: "text",
      text:
        `너는 인스타 릴스 편집자다. 위 사진 ${images.length}장(순서대로)으로 9:16 세로 릴스를 만든다.\n` +
        `분위기: "${mood}" ("AI에게 맡기기"면 사진에 맞게 직접 고른다).\n` +
        (request ? `사용자 보정·구도 요청: """${request}"""\n이 요청을 최우선으로 반영한다.\n` : `별도 요청 없음: 사진이 가장 좋아 보이도록 자연스럽게 보정한다.\n`) +
        (keep ? `사용자가 정한 자막(요청에서 자막 변경을 말하지 않으면 그대로 사용): ${JSON.stringify(keep)}\n` : "") +
        `할 일:\n` +
        `1) 사진별 자막(한국어, 16자 이내), 영상 제목(20자 이내), 해시태그 5개.\n` +
        `2) 사진별 보정값 edits. 값 범위: brightness, contrast, saturation, vibrance, temperature(+따뜻/-차갑), tint(+자홍/-초록), exposure 는 -1~1, vignette, sharpen 은 0~1. 과하지 않게(보통 ±0.4 이내, 요청이 강하면 더).\n` +
        `   framing: "fill"(9:16 화면을 꽉 채우게 자름) 또는 "fit"(사진 전체를 보이고 흐린 배경). 인물·주제가 잘리지 않게 고른다.\n` +
        `   focus: fill일 때 화면 중심이 될 위치 {"x":0~1,"y":0~1} (사진 왼쪽 위가 0,0). 주제가 사진 가운데가 아니면 반드시 지정.\n` +
        `   zoom: "in" | "out" | "none".\n` +
        `3) video: slideSeconds(1.5~5, 사진 1장 보여줄 초), captionPosition("bottom"|"middle"|"top", 주제를 가리지 않는 곳).\n` +
        `사진에 보이는 것만 근거로 쓰고, 사람 이름이나 보이지 않는 사실은 지어내지 않는다.\n` +
        `반드시 JSON만 출력: {"title":"","captions":[""],"hashtags":["#"],"edits":[{"brightness":0,"contrast":0,"saturation":0,"vibrance":0,"temperature":0,"tint":0,"exposure":0,"vignette":0,"sharpen":0,"framing":"fit","focus":{"x":0.5,"y":0.5},"zoom":"in"}],"video":{"slideSeconds":3,"captionPosition":"bottom"},"note":"적용한 보정 요약 한 문장"}`,
    });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages: [{ role: "user", content }] }),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: (data.error && data.error.message) || "AI 오류" }, 502, env);
    const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    const m = text.match(/\{[\s\S]*\}/);
    let out;
    try { out = JSON.parse(m ? m[0] : text); } catch { return json({ error: "AI 응답 해석 실패" }, 502, env); }
    out.captions = (out.captions || []).slice(0, images.length);
    while (out.captions.length < images.length) out.captions.push("");
    out.edits = (Array.isArray(out.edits) ? out.edits : []).slice(0, images.length);
    while (out.edits.length < images.length) out.edits.push({});
    return json({ title: out.title || "", captions: out.captions, hashtags: out.hashtags || [], edits: out.edits,
      video: out.video || {}, note: out.note || "", usage: data.usage }, 200, env);
  },
};
