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
        return St.set("draftPhotos", out).then(function () { return St.set("remake", null); }).then(function () { showPicked(out); toast(out.length + "장을 휴대폰에 저장했어요"); });
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

  // ---------- AI(Claude Opus 5.5): 자막 + 보정값 + 구도 (중계 서버 경유) ----------
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
  function AiError(msg, kind) { var e = new Error(msg); e.kind = kind; return e; }
  // AI 계획 받기 (실패하면 예외 → 다시 시도 화면)
  function aiPlan(photos, mood, request, keepCaps) {
    if (!CFG.AI_ENDPOINT) return Promise.reject(AiError("AI 서버가 아직 연결되지 않았어요.", "setup"));
    return St.get("accessCode").then(function (code) {
      if (!code) throw AiError("AI 접속 코드가 없어요. '내 정보'에서 코드를 넣어주세요.", "code");
      return Promise.all(photos.map(function (p) { return shrink(p, 1000); })).then(function (imgs) {
        return fetch(CFG.AI_ENDPOINT, {
          method: "POST", headers: { "Content-Type": "application/json", "X-Access-Code": code },
          body: JSON.stringify({ images: imgs.filter(Boolean), mood: mood, request: request || "", captions: keepCaps || null })
        }).catch(function () { throw AiError("인터넷 연결을 확인해주세요.", "network"); })
          .then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
              if (r.status === 401) throw AiError(j.error || "접속 코드가 맞지 않아요.", "code");
              if (!r.ok) throw AiError(j.error || "AI 응답 오류 (" + r.status + ")", "server");
              if (!j.captions || !j.captions.length) throw AiError("AI가 자막을 만들지 못했어요.", "server");
              return j;
            });
          });
      });
    });
  }
  function setStep(text) {
    var el = null;
    document.querySelectorAll("p,span,div,h1,h2").forEach(function (x) { if (!el && x.children.length === 0 && /생성 중|렌더링 중/.test(textOf(x))) el = x; });
    if (el) el.textContent = text;
  }
  function showRetry(err) {
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:10000;background:rgba(11,11,15,.94);display:flex;align-items:center;justify-content:center;padding:24px";
    var codeBtn = err.kind === "code" || err.kind === "setup" ? '<button id="rm-code-go" style="width:100%;margin-top:10px;padding:14px;border-radius:999px;border:1px solid #2E2E3E;background:#181820;color:#fff;font:700 15px sans-serif">접속 코드 넣으러 가기</button>' : "";
    ov.innerHTML = '<div style="width:100%;max-width:360px;background:#181820;border:1px solid #2E2E3E;border-radius:24px;padding:24px;color:#fff;font-family:sans-serif;text-align:center">' +
      '<div style="font-size:40px">⚠️</div><div style="font:800 18px sans-serif;margin:8px 0">AI 연결에 실패했어요</div>' +
      '<div style="color:#A2A2BA;font-size:14px;line-height:1.5;margin-bottom:18px">' + String(err.message).replace(/</g, "&lt;") + '</div>' +
      '<button id="rm-retry" style="width:100%;padding:14px;border-radius:999px;border:0;color:#fff;font:800 15px sans-serif;background:linear-gradient(135deg,#FF3D7F,#FF8A3D)">다시 시도</button>' + codeBtn +
      '<button id="rm-back" style="width:100%;margin-top:10px;padding:12px;border:0;background:none;color:#A2A2BA;font:600 14px sans-serif">이전으로</button></div>';
    document.body.appendChild(ov);
    ov.querySelector("#rm-retry").onclick = function () { ov.remove(); makeReel(); };
    ov.querySelector("#rm-back").onclick = function () { history.back(); };
    var cg = ov.querySelector("#rm-code-go"); if (cg) cg.onclick = function () { go("mypage"); };
  }

  // ---------- 제작 중: AI 계획 → 보정·구도 적용 → 영상 만들기 ----------
  function makeReel() {
    var bigNum = null;
    document.querySelectorAll("span,div,p").forEach(function (el) { if (!bigNum && el.children.length === 0 && /^\d{1,3}$/.test(textOf(el))) bigNum = el; });
    if (bigNum) bigNum.textContent = "0";
    return Promise.all([St.get("draftPhotos"), St.get("draftMood"), St.get("draftRequest"), St.get("remake")]).then(function (r) {
      var photos = r[0] || [], mood = r[1] || "AI에게 맡기기", remake = r[3] || null;
      var request = remake ? (remake.request || "") : (r[2] || "");
      if (!photos.length) { toast("먼저 사진을 골라주세요"); setTimeout(function () { go("capture"); }, 1200); return; }
      setStep("Claude가 사진을 분석하고 보정 계획을 세우는 중...");
      return aiPlan(photos, mood, request, remake ? remake.captions : null).then(function (ai) {
        setStep("요청대로 보정하고 영상을 만드는 중...");
        var title = ai.title || (mood + " 릴스");
        var caps = ai.captions;
        return R.render(photos, caps, title, { edits: ai.edits, video: ai.video }, function (p) { if (bigNum) bigNum.textContent = Math.round(p * 100); })
          .then(function (out) {
            return R.thumbOf(photos[0]).then(function (thumb) {
              var proj = { id: "p" + Date.now(), createdAt: Date.now(), title: title, mood: mood, captions: caps, hashtags: ai.hashtags || [],
                request: request, edits: ai.edits, note: ai.note || "",
                photos: photos, thumb: thumb, video: out.blob, mime: out.mime, duration: out.duration, videoPlan: ai.video };
              return St.saveProject(proj).then(function () { return St.set("remake", null); })
                .then(function () { return St.set("currentId", proj.id); }).then(function () { go("preview"); });
            });
          });
      });
    }).catch(function (e) { showRetry(e.kind ? e : AiError(e.message || "영상 만들기에 실패했어요", "render")); });
  }

  // 요청 입력칸 (분위기 화면 / 미리보기 화면)
  function requestBox(id, title, hint, value, onInput) {
    var box = document.createElement("div");
    box.style.cssText = "margin:12px 16px;padding:14px;border-radius:16px;background:#181820;border:1px solid #2E2E3E;color:#fff;font:14px sans-serif";
    box.innerHTML = '<div style="font-weight:800;margin-bottom:6px">' + title + '</div>' +
      '<div style="color:#A2A2BA;font-size:12px;margin-bottom:8px">' + hint + '</div>' +
      '<textarea id="' + id + '" rows="3" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid #2E2E3E;background:#0B0B0F;color:#fff;font:14px sans-serif;resize:vertical"></textarea>';
    var ta = box.querySelector("textarea"); ta.value = value || "";
    ta.placeholder = "예) 따뜻하고 필름 느낌으로, 인물을 화면 가운데에, 전체적으로 조금 밝게, 자막은 위쪽에";
    ta.addEventListener("input", function () { onInput(ta.value); });
    ta.addEventListener("click", function (e) { e.stopPropagation(); }, true);
    return box;
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
      if (p.note) toast("적용한 보정: " + p.note);
      var anchor = document.querySelector("input");
      var holder = anchor ? anchor.closest("section,div") : null;
      var rb = requestBox("rm-req2", "✏️ 수정 요청 (AI가 다시 보정)", "바꾸고 싶은 색감·구도·속도를 적고 '다시 만들기'를 누르세요. 위 자막 칸을 고치면 그 자막을 유지해요.", "", function () {});
      if (holder && holder.parentNode) holder.parentNode.insertBefore(rb, holder.nextSibling); else (document.querySelector("main") || document.body).appendChild(rb);
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
        var rq = document.querySelector("#rm-req2");
        var req = rq && rq.value.trim() ? rq.value.trim() : "";
        St.get("currentId").then(function (id) { return St.getProject(id); }).then(function (p) {
          var full = [p && p.request, req].filter(Boolean).join(" / 추가 요청: ");
          return St.set("draftPhotos", p ? p.photos : null).then(function () { return St.set("draftMood", p ? p.mood : null); })
            .then(function () { return St.set("remake", { request: full, captions: caps }); });
        }).then(function () { go("creating"); });
      }
      else go(to);
      return;
    }
  }, true);

  // 외부 예시 이미지가 막힌 환경에서는 깨진 아이콘 대신 그라데이션
  var PH = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="700"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1830"/><stop offset="1" stop-color="#3a2216"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>');
  document.addEventListener("error", function (e) { var t = e.target; if (t && t.tagName === "IMG" && t.src !== PH) { t.removeAttribute("srcset"); t.src = PH; } }, true);

  if (S === "capture") St.get("draftPhotos").then(function (ph) { if (ph && ph.length) showPicked(ph); });
  if (S === "creating") makeReel();
  if (S === "mood") St.get("draftRequest").then(function (v) {
    var box = requestBox("rm-req", "🎨 보정·구도 요청 (선택)", "원하는 색감, 구도, 분위기, 속도를 자유롭게 적으면 Claude가 그대로 보정해요.", v, function (t) { St.set("draftRequest", t); });
    var main = document.querySelector("main") || document.body;
    var btn = null; document.querySelectorAll("button").forEach(function (b) { if (/다음/.test(textOf(b))) btn = b; });
    var host = btn ? btn.parentElement : null;
    if (host && host.parentNode) host.parentNode.insertBefore(box, host); else main.appendChild(box);
  });
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
