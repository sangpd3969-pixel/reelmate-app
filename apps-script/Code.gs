// ReelMate AI 중계 서버 (Google Apps Script 웹앱)
// - Claude API 키를 숨기고, 지인용 접속 코드가 맞을 때만 Claude Opus 5.5에 사진 분석을 요청한다.
// - 사진은 저장하지 않고 Claude에 전달만 한다.
// 스크립트 속성(프로젝트 설정 > 스크립트 속성)에 직접 입력:
//   ANTHROPIC_API_KEY : Claude Console에서 만든 API 키
//   ACCESS_CODE       : 지인에게 알려줄 접속 코드
var MODEL = 'claude-opus-5-5';

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return out_({ ok: true, service: 'ReelMate AI' });
}

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var KEY = props.getProperty('ANTHROPIC_API_KEY');
    var CODE = props.getProperty('ACCESS_CODE');
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!CODE || String(body.code || '') !== CODE) return out_({ status: 401, error: '접속 코드가 맞지 않아요' });
    if (!KEY) return out_({ status: 500, error: '서버에 API 키가 설정되지 않았어요' });

    var images = (body.images || []).slice(0, 10);
    var mood = String(body.mood || 'AI에게 맡기기').slice(0, 30);
    var request = String(body.request || '').slice(0, 500);
    var keep = Array.isArray(body.captions) ? body.captions.slice(0, 10).map(function (c) { return String(c).slice(0, 40); }) : null;
    if (!images.length) return out_({ status: 400, error: '사진이 없어요' });

    var content = images.map(function (b64) {
      return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: String(b64).replace(/^data:image\/\w+;base64,/, '') } };
    });
    content.push({
      type: 'text',
      text:
        '너는 인스타 릴스 편집자다. 위 사진 ' + images.length + '장(순서대로)으로 9:16 세로 릴스를 만든다.\n' +
        '분위기: "' + mood + '" ("AI에게 맡기기"면 사진에 맞게 직접 고른다).\n' +
        (request ? '사용자 보정·구도 요청: """' + request + '"""\n이 요청을 최우선으로 반영한다.\n' : '별도 요청 없음: 사진이 가장 좋아 보이도록 자연스럽게 보정한다.\n') +
        (keep ? '사용자가 정한 자막(요청에서 자막 변경을 말하지 않으면 그대로 사용): ' + JSON.stringify(keep) + '\n' : '') +
        '할 일:\n' +
        '1) 사진별 자막(한국어, 16자 이내), 영상 제목(20자 이내), 해시태그 5개.\n' +
        '2) 사진별 보정값 edits. 값 범위: brightness, contrast, saturation, vibrance, temperature(+따뜻/-차갑), tint(+자홍/-초록), exposure 는 -1~1, vignette, sharpen 은 0~1. 과하지 않게(보통 ±0.4 이내, 요청이 강하면 더).\n' +
        '   framing: "fill"(9:16 화면을 꽉 채우게 자름) 또는 "fit"(사진 전체를 보이고 흐린 배경). 인물·주제가 잘리지 않게 고른다.\n' +
        '   focus: fill일 때 화면 중심이 될 위치 {"x":0~1,"y":0~1} (사진 왼쪽 위가 0,0). 주제가 사진 가운데가 아니면 반드시 지정.\n' +
        '   zoom: "in" | "out" | "none".\n' +
        '3) video: slideSeconds(1.5~5, 사진 1장 보여줄 초), captionPosition("bottom"|"middle"|"top", 주제를 가리지 않는 곳).\n' +
        '사진에 보이는 것만 근거로 쓰고, 사람 이름이나 보이지 않는 사실은 지어내지 않는다.\n' +
        '반드시 JSON만 출력: {"title":"","captions":[""],"hashtags":["#"],"edits":[{"brightness":0,"contrast":0,"saturation":0,"vibrance":0,"temperature":0,"tint":0,"exposure":0,"vignette":0,"sharpen":0,"framing":"fit","focus":{"x":0.5,"y":0.5},"zoom":"in"}],"video":{"slideSeconds":3,"captionPosition":"bottom"},"note":"적용한 보정 요약 한 문장"}'
    });

    var r = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({ model: MODEL, max_tokens: 2000, messages: [{ role: 'user', content: content }] }),
      muteHttpExceptions: true
    });
    var data = JSON.parse(r.getContentText() || '{}');
    if (r.getResponseCode() !== 200) return out_({ status: 502, error: (data.error && data.error.message) || 'AI 오류' });
    var text = (data.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
    var m = text.match(/\{[\s\S]*\}/);
    var o;
    try { o = JSON.parse(m ? m[0] : text); } catch (err) { return out_({ status: 502, error: 'AI 응답 해석 실패' }); }
    o.captions = (o.captions || []).slice(0, images.length);
    while (o.captions.length < images.length) o.captions.push('');
    o.edits = (Array.isArray(o.edits) ? o.edits : []).slice(0, images.length);
    while (o.edits.length < images.length) o.edits.push({});
    return out_({ status: 200, title: o.title || '', captions: o.captions, hashtags: o.hashtags || [], edits: o.edits,
      video: o.video || {}, note: o.note || '', usage: data.usage });
  } catch (err) {
    return out_({ status: 500, error: String(err && err.message || err) });
  }
}
