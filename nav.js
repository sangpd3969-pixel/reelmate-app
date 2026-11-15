// ReelMate 프로토타입: Stitch 화면들을 버튼 문구로 서로 연결하고, 실제 사진 선택·미리보기를 붙인다.
(function () {
  try { if ("serviceWorker" in navigator) navigator.serviceWorker.register("../sw.js", { scope: "../" }); } catch (e) {}
  var S = window.SCREEN;
  var go = function (to) { location.href = to + ".html"; };
  var store = {
    get: function (k) { try { return JSON.parse(sessionStorage.getItem(k) || "null"); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };

  // [화면, 버튼 문구에 포함된 글자, 이동할 화면]  (위에서부터 먼저 맞는 것 적용, "=" = 모든 화면에서 문구가 정확히 같을 때)
  var RULES = [
    ["onboarding", "시작하기", "login"], ["onboarding", "건너뛰기", "login"], ["onboarding", "로그인", "login"],
    ["login", "카카오", "connect"], ["login", "Apple", "connect"], ["login", "Google", "connect"], ["login", "이메일", "connect"],
    ["connect", "다음 단계로", "home"], ["connect", "나중에 하기", "home"],
    ["home", "지금 만들기", "capture"], ["home", "릴스 만들기", "capture"],
    ["capture", "다음", "mood"], ["capture", "close", "home"],
    ["mood", "다음", "creating"], ["mood", "chevron_left", "capture"], ["mood", "close", "home"],
    ["creating", "백그라운드", "home"], ["creating", "close", "home"],
    ["preview", "다음", "publish"], ["preview", "다시 만들기", "creating"], ["preview", "arrow_back", "mood"],
    ["publish", "지금 올리기", "done"], ["publish", "예약하기", "schedule"], ["publish", "arrow_back", "preview"], ["publish", "close", "home"],
    ["done", "하나 더 만들기", "capture"], ["done", "게시물 보기", "library"], ["done", "close", "home"],
    ["schedule", "새 예약 추가", "capture"],
    ["mypage", "로그아웃", "onboarding"],
    ["=", "home 홈", "home"], ["=", "video_library 보관함", "library"], ["=", "calendar_today 예약", "schedule"],
    ["=", "person 내 정보", "mypage"], ["=", "add", "capture"], ["=", "arrow_back", "BACK"]
  ];

  function textOf(el) { return (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim(); }
  function match(text) {
    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      if (r[0] === "=" ? text === r[1] : (r[0] === S && text.indexOf(r[1]) !== -1)) return r[2];
    }
    return null;
  }

  // ---- 사진 선택 (촬영 화면) ----
  function pickPhotos() {
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
    inp.onchange = function () {
      var files = Array.prototype.slice.call(inp.files || [], 0, 10);
      var out = [], left = files.length;
      if (!left) return;
      files.forEach(function (f, idx) {
        var img = new Image();
        img.onload = function () {
          var w = 720, h = Math.round(img.height * 720 / img.width);
          var c = document.createElement("canvas"); c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          out[idx] = c.toDataURL("image/jpeg", 0.75);
          URL.revokeObjectURL(img.src);
          if (--left === 0) {
            store.set("photos", out);
            showPicked(out);
          }
        };
        img.src = URL.createObjectURL(f);
      });
    };
    inp.click();
  }
  function showPicked(photos) {
    // 촬영 화면의 썸네일 자리에 고른 사진을 채우고 "다음 (n)" 숫자 갱신
    var thumbs = document.querySelectorAll("img");
    for (var i = 1; i < thumbs.length && i - 1 < photos.length; i++) { thumbs[i].src = photos[i - 1]; thumbs[i].removeAttribute("srcset"); }
    document.querySelectorAll("span").forEach(function (sp) {
      if (/^다음 \(\d+\)$/.test(textOf(sp))) sp.textContent = "다음 (" + photos.length + ")";
      else if (/^\d+장 선택됨/.test(textOf(sp))) sp.textContent = textOf(sp).replace(/^\d+/, photos.length);
    });
  }

  // ---- 미리보기: 고른 사진으로 9:16 슬라이드쇼 ----
  function startSlideshow() {
    var photos = store.get("photos");
    if (!photos || !photos.length) return;
    var box = document.querySelector('section[class*="aspect-[9/16]"] .bg-cover') || document.querySelector(".bg-cover");
    if (!box) return;
    var i = 0;
    var show = function () {
      box.style.backgroundImage = "url(" + photos[i % photos.length] + ")";
      box.style.transition = "transform 3s ease-out";
      box.style.transform = "scale(1.0)";
      requestAnimationFrame(function () { box.style.transform = "scale(1.12)"; });
      i++;
    };
    show(); setInterval(show, 3000);
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("button, a, [role=button]");
    var cands = [];
    if (el) cands.push(el);
    var p = e.target;
    for (var k = 0; k < 5 && p; k++, p = p.parentElement) cands.push(p);
    // 촬영 화면: 셔터/앨범 버튼은 실제 사진 고르기
    if (S === "capture") {
      var t0 = textOf(el || e.target);
      if (/photo_library|앨범|photo_camera|auto_fix_high/.test(t0)) { e.preventDefault(); pickPhotos(); return; }
    }
    for (var j = 0; j < cands.length; j++) {
      var t = textOf(cands[j]);
      if (!t || t.length > 80) continue;
      var to = match(t);
      if (to) {
        e.preventDefault();
        if (to === "BACK") history.back(); else go(to);
        return;
      }
    }
  }, true);

  // 외부 예시 이미지가 막힌 환경(공유 링크 등)에서는 깨진 아이콘 대신 그라데이션으로 표시
  var PH = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="700"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1830"/><stop offset="1" stop-color="#3a2216"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>');
  document.addEventListener("error", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG" && t.src !== PH) { t.removeAttribute("srcset"); t.src = PH; }
  }, true);
  document.querySelectorAll("img").forEach(function (im) { if (im.complete && im.naturalWidth === 0 && im.src && im.src.indexOf("data:") !== 0) im.src = PH; });

  if (S === "capture") { var ph = store.get("photos"); if (ph) showPicked(ph); }
  if (S === "preview") startSlideshow();
  if (S === "creating") setTimeout(function () { go("preview"); }, 4000);
})();
