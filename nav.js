// ReelMate: Stitch 화면 연결 + 휴대폰 저장 + 휴대폰에서 영상 만들기 (reel.js 사용)
(function () {
  try { if ("serviceWorker" in navigator) navigator.serviceWorker.register("../sw.js", { scope: "../" }); } catch (e) {}
  var S = window.SCREEN, R = window.Reel, St = R.Store;
  var go = function (to) { location.href = to + ".html"; };
  var qs = function (k) { return new URLSearchParams(location.search).get(k); };
  function textOf(el) { return (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim(); }
  function toast(msg) {
    var d = document.createElement("div");
    d.textContent = msg;
    d.style.cssText = "position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:9999;background:rgba(24,24,32,.95);color:#fff;padding:12px 18px;border-radius:999px;font:600 14px sans-serif;border:1px solid #2E2E3E;max-width:86%;text-align:center";
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2600);
  }
  function pill(label, onClick, bottom) {
    var b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = "position:fixed;right:16px;bottom:" + (bottom || 96) + "px;z-index:9998;padding:12px 18px;border-radius:999px;border:0;color:#fff;font:700 14px sans-serif;background:linear-gradient(135deg,#FF3D7F,#FF8A3D);box-shadow:0 8px 24px rgba(255,61,127,.35)";
    b.onclick = function (e) { e.stopPropagation(); e.preventDefault(); onClick(); };
    document.body.appendChild(b); return b;
  }

  // [화면, 버튼 문구, 이동할 화면]  "=" = 모든 화면에서 문구가 정확히 같을 때
  var RULES = [
    ["onboarding", "시작하기", "login"], ["onboarding", "건너뛰기", "login"], ["onboarding", "로그인", "login"],
    ["login", "카카오", "connect"], ["login", "Apple", "connect"], ["login", "Google", "connect"], ["login", "이메일", "connect"],
    ["connect", "다음 단계로", "home"], ["connect", "나중에 하기", "home"],
    ["home", "지금 만들기", "capture"], ["home", "릴스 만들기", "capture"],
    ["capture", "다음", "NEXT_CAPTURE"], ["capture", "close", "home"],
    ["mood", "다음", "creating"], ["mood", "chevron_left", "capture"], ["mood", "close", "home"],
    ["creating", "백그라운드", "home"], ["creating", "close", "home"],
    ["preview", "다음", "PUBLISH"], ["preview", "다시 만들기", "REMAKE"], ["preview", "arrow_back", "mood"],
    ["publish", "지금 올리기", "done"], ["publish", "예약하기", "schedule"], ["publish", "arrow_back", "BACK"], ["publish", "close", "home"],
    ["done", "하나 더 만들기", "capture"], ["done", "게시물 보기", "library"], ["done", "close", "home"],
    ["schedule", "새 예약 추가", "capture"],
    ["mypage", "로그아웃", "onboarding"],
    ["=", "home 홈", "home"], ["=", "video_library 보관함", "library"], ["=", "calendar_today 예약", "schedule"],
    ["=", "person 내 정보", "mypage"], ["=", "add", "capture"], ["=", "arrow_back", "BACK"]
  ];
  function match(text) {
    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      if (r[0] === "=" ? text === r[1] : (r[0] === S && text.indexOf(r[1]) !== -1)) return r[2];
    }
    return null;
  }

  // ---------- 촬영/선택: 고른 사진을 휴대폰 저장소에 ----------
  function pickPhotos() {
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
    inp.onchange = function () {
      var files = Array.prototype.slice.call(inp.files || [], 0, 10);
      if (!files.length) return;
      Promise.all(files.map(function (f) {
        return new Promise(function (res) {
          var img = new Image();
          img.onload = function () {
            var w = Math.min(1080, img.width), h = Math.round(img.height * w / img.width);
            var c = document.createElement("canvas"); c.width = w; c.height = h;
            c.getContext("2d").drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(img.src); res(c.toDataURL("image/jpeg", 0.85));
          };
          img.onerror = function () { res(null); };
          img.src = URL.createObjectURL(f);
        });
      })).then(function (out) {
        out = out.filter(Boolean);
        return St.set("draftPhotos", out).then(function () { showPicked(out); toast(out.length + "장을 휴대폰에 저장했어요"); });
      });
    };
    inp.click();
  }
  function showPicked(photos) {
    var thumbs = document.querySelectorAll("img");
    for (var i = 1; i < thumbs.length && i - 1 < photos.length; i++) { thumbs[i].src = photos[i - 1]; thumbs[i].removeAttribute("srcset"); }
    document.querySelectorAll("span").forEach(function (sp) {
      var t = textOf(sp);
      if (/^다음 \(\d+\)$/.test(t)) sp.textContent = "다음 (" + photos.length + ")";
      else if (/^\d+장 선택됨/.test(t)) sp.textContent = t.replace(/^\d+/, photos.length);
    });
  }

  // ---------- AI(Claude Opus 5.5) 자막: 중계 서버 경유 ----------
  var CFG = window.REELMATE_CONFIG || {};
  (function () { var c = qs("code"); if (c) St.set("accessCode", c); })();
  function shrink(dataUrl, maxEdge) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        var s = Math.min(1, maxEdge / Math.max(im.width, im.height));
        var c = document.createElement("canvas"); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", 0.8));
      };
      im.onerror = function () { res(null); };
      im.src = dataUrl;
    });
  }
  function aiCaptions(photos, mood) {
    if (!CFG.AI_ENDPOINT) return Promise.resolve(null);
    return St.get("accessCode").then(function (code) {
      if (!code) { toast("AI 자막은 '내 정보'에서 접속 코드를 넣으면 켜져요"); return null; }
      return Promise.all(photos.map(function (p) { return shrink(p, 1000); })).then(function (imgs) {
        return fetch(CFG.AI_ENDPOINT, {
          method: "POST", headers: { "Content-Type": "application/json", "X-Access-Code": code },
          body: JSON.stringify({ images: imgs.filter(Boolean), mood: mood })
        }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "AI 오류"); return j; }); });
      });
    }).catch(function (e) { toast("AI 자막 실패: " + e.message + " (기본 자막 사용)"); return null; });
  }

  // ---------- 제작 중: 실제로 영상 만들기 ----------
  function makeReel(captionsOverride) {
    var bigNum = null;
    document.querySelectorAll("span,div,p").forEach(function (el) { if (!bigNum && el.children.length === 0 && /^\d{1,3}$/.test(textOf(el))) bigNum = el; });
    return Promise.all([St.get("draftPhotos"), St.get("draftMood")]).then(function (r) {
      var photos = r[0] || [], mood = r[1] || "AI에게 맡기기";
      if (!photos.length) { toast("먼저 사진을 골라주세요"); setTimeout(function () { go("capture"); }, 1200); return; }
      var d = new Date(), title = mood.replace("AI에게 맡기기", "오늘의 기록") + " · " + (d.getMonth() + 1) + "월 " + d.getDate() + "일";
      var hashtags = [];
      var aiStep = captionsOverride ? Promise.resolve(null) : aiCaptions(photos, mood);
      return aiStep.then(function (ai) {
        var caps = captionsOverride || (ai && ai.captions && ai.captions.length ? ai.captions : R.captionsFor(mood, photos.length));
        if (ai && ai.title) title = ai.title;
        if (ai && ai.hashtags) hashtags = ai.hashtags;
        if (captionsOverride) return St.get("remakeTitle").then(function (t) { if (t) title = t; return caps; });
        return caps;
      }).then(function (caps) {
      return R.render(photos, caps, title, function (p) { if (bigNum) bigNum.textContent = Math.round(p * 100); })
        .then(function (out) {
          return R.thumbOf(photos[0]).then(function (thumb) {
            var proj = { id: "p" + Date.now(), createdAt: Date.now(), title: title, mood: mood, captions: caps, hashtags: hashtags,
              photos: photos, thumb: thumb, video: out.blob, mime: out.mime, duration: out.duration };
            return St.saveProject(proj).then(function () { return St.set("currentId", proj.id); }).then(function () { go("preview"); });
          });
        });
      });
    }).catch(function (e) { toast(e.message || "영상 만들기에 실패했어요"); });
  }

  // ---------- 미리보기: 만든 영상 재생 + 휴대폰에 저장 ----------
  function setupPreview() {
    var id = qs("id");
    (id ? Promise.resolve(id) : St.get("currentId")).then(function (cid) { return cid ? St.getProject(cid) : null; }).then(function (p) {
      if (!p) return;
      St.set("currentId", p.id);
      var box = document.querySelector('section[class*="aspect-[9/16]"]');
      if (box) {
        if (getComputedStyle(box).position === "static") box.style.position = "relative";
        var v = document.createElement("video");
        v.src = URL.createObjectURL(p.video); v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
        v.setAttribute("playsinline", ""); v.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:30;background:#000";
        box.appendChild(v); v.play().catch(function () {});
      }
      var h1 = document.querySelector("h1"); if (h1) h1.textContent = p.title;
      var inp = document.querySelector("input");
      if (inp) { inp.value = p.captions.join(" / "); inp.placeholder = "자막을 ' / '로 나눠 고친 뒤 '다시 만들기'"; }
      pill("📥 휴대폰에 저장", function () { R.exportVideo(p); }, 96);
    });
  }

  // ---------- 보관함: 휴대폰에 저장된 릴스 목록 ----------
  function setupLibrary() {
    St.allProjects().then(function (list) {
      var main = document.querySelector("main") || document.body;
      var sec = document.createElement("section");
      sec.style.cssText = "margin:12px 0 4px";
      var h = document.createElement("div");
      h.style.cssText = "color:#fff;font:700 16px sans-serif;margin:4px 0 10px";
      h.textContent = "📱 내 휴대폰에 저장된 릴스 (" + list.length + ")";
      sec.appendChild(h);
      if (!list.length) {
        var e = document.createElement("div"); e.style.cssText = "color:#A2A2BA;font:14px sans-serif;padding:8px 0 16px";
        e.textContent = "아직 만든 릴스가 없어요. 가운데 + 버튼으로 만들어 보세요."; sec.appendChild(e);
      } else {
        var g = document.createElement("div"); g.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px";
        list.forEach(function (p) {
          var a = document.createElement("a"); a.href = "preview.html?id=" + p.id;
          a.style.cssText = "position:relative;display:block;aspect-ratio:9/16;border-radius:12px;overflow:hidden;background:#181820";
          a.innerHTML = '<img src="' + p.thumb + '" style="width:100%;height:100%;object-fit:cover"><div style="position:absolute;left:0;right:0;bottom:0;padding:6px;background:linear-gradient(transparent,rgba(0,0,0,.8));color:#fff;font:600 11px sans-serif">' +
            p.title.replace(/</g, "&lt;") + "</div>";
          g.appendChild(a);
        });
        sec.appendChild(g);
      }
      var note = document.createElement("div"); note.style.cssText = "color:#5E5E76;font:12px sans-serif;margin:-6px 0 14px";
      note.textContent = "아래는 디자인 예시 화면이에요."; sec.appendChild(note);
      main.insertBefore(sec, main.querySelector("section") || main.firstChild);
    });
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("button, a, [role=button]");
    if (el && el.getAttribute("href") && el.getAttribute("href").indexOf("preview.html?id=") === 0) return;
    var cands = []; if (el) cands.push(el);
    for (var k = 0, p = e.target; k < 5 && p; k++, p = p.parentElement) cands.push(p);
    if (S === "capture") {
      var t0 = textOf(el || e.target);
      if (/photo_library|앨범|photo_camera|auto_fix_high/.test(t0)) { e.preventDefault(); pickPhotos(); return; }
    }
    if (S === "mood") {
      for (var m = 0; m < cands.length; m++) {
        var tm = textOf(cands[m]);
        for (var key in R.MOODS) if (tm.indexOf(key) === 0 && tm.length < 60) { St.set("draftMood", key); toast("'" + key + "' 분위기 선택"); break; }
      }
    }
    for (var j = 0; j < cands.length; j++) {
      var t = textOf(cands[j]);
      if (!t || t.length > 80) continue;
      var to = match(t);
      if (!to) continue;
      e.preventDefault();
      if (to === "BACK") history.back();
      else if (to === "NEXT_CAPTURE") St.get("draftPhotos").then(function (ph) { if (ph && ph.length) go("mood"); else { toast("'앨범 전체보기'로 사진을 먼저 골라주세요"); pickPhotos(); } });
      else if (to === "PUBLISH") St.get("currentId").then(function (id) { location.href = "publish.html" + (id ? "?id=" + id : ""); });
      else if (to === "REMAKE") {
        var inp = document.querySelector("input");
        var caps = inp && inp.value ? inp.value.split("/").map(function (s) { return s.trim(); }) : null;
        var h1 = document.querySelector("h1");
        St.set("remakeCaps", caps).then(function () { return St.set("remakeTitle", h1 ? textOf(h1) : null); }).then(function () { go("creating"); });
      }
      else go(to);
      return;
    }
  }, true);

  // 외부 예시 이미지가 막힌 환경에서는 깨진 아이콘 대신 그라데이션
  var PH = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="700"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1830"/><stop offset="1" stop-color="#3a2216"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>');
  document.addEventListener("error", function (e) { var t = e.target; if (t && t.tagName === "IMG" && t.src !== PH) { t.removeAttribute("srcset"); t.src = PH; } }, true);

  if (S === "capture") St.get("draftPhotos").then(function (ph) { if (ph && ph.length) showPicked(ph); });
  if (S === "creating") St.get("remakeCaps").then(function (caps) { St.set("remakeCaps", null); return makeReel(caps || null); });
  if (S === "preview") setupPreview();
  if (S === "library") setupLibrary();
  if (S === "mypage") St.get("accessCode").then(function (code) {
    var box = document.createElement("div");
    box.style.cssText = "margin:12px 16px;padding:14px;border-radius:16px;background:#181820;border:1px solid #2E2E3E;color:#fff;font:14px sans-serif";
    box.innerHTML = '<div style="font-weight:700;margin-bottom:8px">🤖 AI 자막 접속 코드</div>' +
      '<div style="color:#A2A2BA;font-size:12px;margin-bottom:10px">앱을 공유해 준 사람에게 받은 코드를 넣으면 Claude가 사진을 보고 자막을 써줘요.</div>' +
      '<div style="display:flex;gap:8px"><input id="rm-code" type="password" placeholder="접속 코드" style="flex:1;padding:10px 12px;border-radius:12px;border:1px solid #2E2E3E;background:#0B0B0F;color:#fff">' +
      '<button id="rm-save" style="padding:10px 16px;border-radius:12px;border:0;color:#fff;font-weight:700;background:linear-gradient(135deg,#FF3D7F,#FF8A3D)">저장</button></div>';
    var main = document.querySelector("main") || document.body;
    main.insertBefore(box, main.firstChild);
    var inp = box.querySelector("#rm-code"); if (code) inp.value = code;
    box.querySelector("#rm-save").onclick = function (e) { e.stopPropagation(); St.set("accessCode", inp.value.trim()).then(function () { toast(inp.value.trim() ? "접속 코드를 저장했어요" : "접속 코드를 지웠어요"); }); };
  });
  if (S === "publish") St.get("currentId").then(function (id) { return id && St.getProject(id); }).then(function (p) {
    if (p) pill("📥 휴대폰에 저장", function () { R.exportVideo(p); }, 150);
  });
})();
