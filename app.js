// ReelMate 앱 화면 전체 (모든 버튼이 실제로 동작하도록 한 파일에서 관리)
(function () {
  "use strict";
  var VERSION = "v11";
  var S = window.SCREEN, R = window.Reel, St = R.Store, C = window.REELMATE_CONFIG || {};
  try { if ("serviceWorker" in navigator) navigator.serviceWorker.register("../sw.js", { scope: "../" }); } catch (e) {}

  // ---------- 공통 도우미 ----------
  var isAndroid = /Android/i.test(navigator.userAgent);
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ic(name, fill) { return '<span class="ms' + (fill ? " fill" : "") + '">' + name + "</span>"; }
  function qs(k) { return new URLSearchParams(location.search).get(k); }
  function go(page, q) { location.href = page + ".html" + (q ? "?" + new URLSearchParams(q) : ""); }
  function back(fallback) { if (history.length > 1 && document.referrer && document.referrer.indexOf(location.host) !== -1) history.back(); else go(fallback || "home"); }
  function toast(msg, ms) {
    $$(".toast").forEach(function (t) { t.remove(); });
    var d = document.createElement("div"); d.className = "toast"; d.textContent = msg;
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, ms || 2600);
  }
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function sheet(html, opts) {
    opts = opts || {};
    var d = el('<div class="dim' + (opts.center ? " center" : "") + '"><div class="sheet">' + (opts.center ? "" : '<div class="grab"></div>') + html + "</div></div>");
    d.addEventListener("click", function (e) { if (e.target === d && !opts.sticky) d.remove(); });
    document.body.appendChild(d);
    d.close = function () { d.remove(); };
    return d;
  }
  function confirmBox(title, msg, okText, danger) {
    return new Promise(function (res) {
      var d = sheet('<h3>' + esc(title) + '</h3><p class="muted" style="margin:0 0 18px">' + esc(msg) + '</p>' +
        '<div class="btns"><button class="btn ghost small" data-no>취소</button><button class="btn small' + (danger ? " danger" : "") + '" data-ok>' + esc(okText || "확인") + "</button></div>", { center: true });
      $("[data-no]", d).onclick = function () { d.close(); res(false); };
      $("[data-ok]", d).onclick = function () { d.close(); res(true); };
    });
  }
  function fmtDate(ms, withTime) {
    var d = new Date(ms), p = function (n) { return (n < 10 ? "0" : "") + n; };
    var s = d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate());
    if (withTime) s += " " + ["일", "월", "화", "수", "목", "금", "토"][d.getDay()] + " " + p(d.getHours()) + ":" + p(d.getMinutes());
    return s;
  }
  function fmtDur(s) { s = Math.round(s || 0); return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }
  function copyText(txt) {
    var ok = false, ta = document.createElement("textarea");
    ta.value = txt; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
    document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, txt.length);
    try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove();
    if (!ok && navigator.clipboard) { navigator.clipboard.writeText(txt).catch(function () {}); ok = true; }
    return ok;
  }
  function itemsOf(p) { return p.items || p.photos || []; }
  function isVideo(it) { return it && typeof it === "object" && it.type === "video"; }
  function thumbSrc(it) { return isVideo(it) ? it.thumb : (typeof it === "string" ? it : it.src); }

  // ---------- 로그인 사용자 · 설정 ----------
  function getUser() { return St.get("user"); }
  function getPrefs() { return St.get("prefs").then(function (p) { return p || { mood: "AI에게 맡기기", style: "basic" }; }); }
  function setPrefs(patch) { return getPrefs().then(function (p) { for (var k in patch) p[k] = patch[k]; return St.set("prefs", p); }); }
  function getSchedules() { return St.get("schedules").then(function (s) { return s || []; }); }

  // ---------- SNS 앱 (휴대폰에 깔린 앱으로 공유) ----------
  var APPS = {
    instagram: { name: "Instagram", desc: "릴스 · 스토리", host: "www.instagram.com", pkg: "com.instagram.android", ios: "instagram://app",
      icon: '<div class="appic" style="background:linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)">' + ic("photo_camera", 1) + "</div>" },
    youtube: { name: "YouTube", desc: "쇼츠", host: "www.youtube.com", pkg: "com.google.android.youtube", ios: "youtube://",
      icon: '<div class="appic" style="background:#FF0000">' + ic("play_arrow", 1) + "</div>" },
    facebook: { name: "Facebook", desc: "릴스 · 스토리", host: "www.facebook.com", pkg: "com.facebook.katana", ios: "fb://",
      icon: '<div class="appic" style="background:#1877F2"><b style="font:900 26px sans-serif">f</b></div>' }
  };
  var st = document.createElement("style");
  st.textContent = ".appic{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;flex:none}.appic .ms{font-size:24px}";
  document.head.appendChild(st);
  function getChannels() { return St.get("channels").then(function (c) { return c || ["instagram", "youtube"]; }); }
  function openApp(key) {
    var a = APPS[key], web = "https://" + a.host + "/";
    if (isAndroid) location.href = "intent://" + a.host + "/#Intent;scheme=https;package=" + a.pkg + ";S.browser_fallback_url=" + encodeURIComponent(web) + ";end";
    else if (isIOS) {
      var t = setTimeout(function () { if (!document.hidden) toast(a.name + " 앱이 안 열리면 설치돼 있는지 확인해 주세요"); }, 1800);
      document.addEventListener("visibilitychange", function () { if (document.hidden) clearTimeout(t); }, { once: true });
      location.href = a.ios;
    } else window.open(web, "_blank");
  }

  // ---------- 화면 틀 ----------
  var root = document.getElementById("app");
  function topbar(o) {
    var left = o.back ? '<button class="icon-btn" data-back>' + ic(o.closeIcon ? "close" : "arrow_back") + "</button>" : "";
    var mid = o.logo ? '<div class="logo"><i>' + ic("movie", 1) + "</i>ReelMate</div>" : "<h1>" + esc(o.title || "") + "</h1>";
    var right = (o.step ? '<span class="step">' + esc(o.step) + "</span>" : "") + (o.right || "");
    var h = el('<header class="top">' + left + mid + right + "</header>");
    var b = $("[data-back]", h); if (b) b.onclick = function () { typeof o.back === "function" ? o.back() : back(o.back === true ? "home" : o.back); };
    return h;
  }
  function bottomNav(on) {
    var tabs = [["home", "home", "홈"], ["library", "video_library", "보관함"], ["capture", "add", ""], ["schedule", "calendar_month", "예약"], ["mypage", "person", "내 정보"]];
    return el('<nav class="nav">' + tabs.map(function (t) {
      if (t[0] === "capture") return '<a class="plus" href="capture.html" aria-label="새 릴스">' + ic("add") + "</a>";
      return '<a href="' + t[0] + '.html"' + (on === t[0] ? ' class="on"' : "") + ">" + ic(t[1]) + t[2] + "</a>";
    }).join("") + "</nav>");
  }
  function mount(o, html) {
    root.innerHTML = "";
    if (o.top) root.appendChild(topbar(o.top));
    var page = el('<main class="page' + (o.nav ? "" : " nonav") + '">' + html + "</main>");
    root.appendChild(page);
    if (o.nav) root.appendChild(bottomNav(o.nav));
    if (o.dock) { var d = el('<div class="dock">' + o.dock + "</div>"); root.appendChild(d); }
    return page;
  }
  function avatarHtml(u) {
    if (u && u.photo) return '<span class="avatar"><img src="' + esc(u.photo) + '" referrerpolicy="no-referrer" alt=""></span>';
    return '<span class="avatar">' + esc(((u && u.name) || "나").slice(0, 1)) + "</span>";
  }

  // ---------- 사진·영상 고르기 ----------
  var MAX_ITEMS = 10;
  function imageFromFile(f) {
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1440 / Math.max(img.width, img.height)), w = Math.round(img.width * s), h = Math.round(img.height * s);
        var c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h); URL.revokeObjectURL(img.src); res(c.toDataURL("image/jpeg", 0.88));
      };
      img.onerror = function () { res(null); };
      img.src = URL.createObjectURL(f);
    });
  }
  function videoFromFile(f) {
    return new Promise(function (res) {
      var v = document.createElement("video"), url = URL.createObjectURL(f), done = false;
      v.muted = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.preload = "auto";
      var fail = function () { if (!done) { done = true; URL.revokeObjectURL(url); res(null); } };
      v.onloadedmetadata = function () { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); } catch (e) { fail(); } };
      v.onseeked = function () {
        if (done) return; done = true;
        var s = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight)), c = document.createElement("canvas");
        c.width = Math.round(v.videoWidth * s) || 360; c.height = Math.round(v.videoHeight * s) || 640;
        c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
        var dur = v.duration; URL.revokeObjectURL(url);
        res({ type: "video", blob: f, thumb: c.toDataURL("image/jpeg", 0.8), duration: isFinite(dur) ? dur : 5 });
      };
      v.onerror = fail; setTimeout(fail, 15000);
      v.src = url;
    });
  }
  function pickFiles(kind, onAdd) {
    var inp = document.createElement("input");
    inp.type = "file";
    if (kind === "photo") { inp.accept = "image/*"; inp.setAttribute("capture", "environment"); }
    else if (kind === "video") { inp.accept = "video/*"; inp.setAttribute("capture", "environment"); }
    else { inp.accept = "image/*,video/*"; inp.multiple = true; }
    inp.style.display = "none"; document.body.appendChild(inp);
    inp.onchange = function () {
      var files = Array.prototype.slice.call(inp.files || []); inp.remove();
      if (!files.length) return;
      toast("불러오는 중...", 8000);
      Promise.all(files.map(function (f) {
        if (/^video\//.test(f.type)) {
          if (f.size > 300 * 1024 * 1024) { toast("300MB가 넘는 영상은 넣을 수 없어요"); return null; }
          return videoFromFile(f);
        }
        return imageFromFile(f);
      })).then(function (out) {
        out = out.filter(Boolean);
        $$(".toast").forEach(function (t) { t.remove(); });
        if (!out.length) { toast("파일을 읽지 못했어요. 다른 사진·영상으로 해 주세요"); return; }
        onAdd(out);
      });
    };
    inp.click();
  }

  // ---------- AI (Claude Opus 5.5, 중계 서버 경유) ----------
  (function () { var c = qs("code"); if (c && S !== "mypage") St.set("accessCode", c); })();
  function shrink(dataUrl, maxEdge) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        var s = Math.min(1, maxEdge / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", 0.8));
      };
      im.onerror = function () { res(null); };
      im.src = dataUrl;
    });
  }
  function AiError(msg, kind) { var e = new Error(msg); e.kind = kind; return e; }
  function aiPlan(items, mood, request, keepCaps) {
    if (!C.AI_ENDPOINT) return Promise.reject(AiError("AI 서버가 아직 연결되지 않았어요.", "setup"));
    return St.get("accessCode").then(function (code) {
      if (!code) throw AiError("AI 접속 코드가 없어요. '내 정보'에서 코드를 넣어 주세요.", "code");
      var vids = []; items.forEach(function (it, i) { if (isVideo(it)) vids.push(i + 1); });
      var req = (request || "") + (vids.length ? "\n(참고: " + vids.join(", ") + "번째는 동영상의 한 장면이다. 동영상은 framing 'fill' 권장)" : "");
      return Promise.all(items.map(function (it) { return shrink(thumbSrc(it), 1000); })).then(function (imgs) {
        return fetch(C.AI_ENDPOINT, {
          method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ code: code, images: imgs.filter(Boolean), mood: mood, request: req, captions: keepCaps || null })
        }).catch(function () { throw AiError("인터넷 연결을 확인해 주세요.", "network"); }).then(function (r) {
          return r.json().catch(function () { return { status: r.status || 500, error: "AI 서버 응답을 읽지 못했어요" }; }).then(function (j) {
            var s = j.status || r.status;
            if (s === 401) throw AiError(j.error || "접속 코드가 맞지 않아요.", "code");
            if (s !== 200 || !r.ok) throw AiError(j.error || "AI 응답 오류 (" + s + ")", "server");
            if (!j.captions || !j.captions.length) throw AiError("AI가 자막을 만들지 못했어요.", "server");
            return j;
          });
        });
      });
    });
  }

  // ---------- 로그인 ----------
  var REDIRECT = location.origin + location.pathname.replace(/[^/]*$/, "") + "login.html";
  function startGoogle() {
    if (!C.GOOGLE_CLIENT_ID) return toast("Google 로그인은 아직 준비 중이에요");
    location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
      client_id: C.GOOGLE_CLIENT_ID, redirect_uri: REDIRECT, response_type: "token", scope: "openid email profile", state: "google", prompt: "select_account" });
  }
  function startKakao() {
    if (!C.KAKAO_REST_KEY) return toast("카카오 로그인은 아직 준비 중이에요");
    location.href = "https://kauth.kakao.com/oauth/authorize?" + new URLSearchParams({ client_id: C.KAKAO_REST_KEY, redirect_uri: REDIRECT, response_type: "code", state: "kakao" });
  }
  function afterLogin(u) {
    history.replaceState(null, "", location.pathname);
    return St.set("user", u).then(function () { toast((u.name || "회원") + "님, 반가워요!"); setTimeout(function () { go("connect", { first: 1 }); }, 900); });
  }
  function finishLogin() {
    var h = new URLSearchParams(location.hash.slice(1)), q = new URLSearchParams(location.search);
    var fail = function (m) { history.replaceState(null, "", location.pathname); toast(m, 4000); };
    if (h.get("state") === "google") {
      if (!h.get("access_token")) { fail("Google 로그인을 취소했어요"); return true; }
      fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: "Bearer " + h.get("access_token") } })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (u) { return afterLogin({ provider: "google", name: u.name, email: u.email, photo: u.picture }); })
        .catch(function () { fail("Google 로그인에 실패했어요. 다시 눌러 주세요"); });
      return true;
    }
    if (q.get("state") === "kakao") {
      if (!q.get("code")) { fail("카카오 로그인을 취소했어요"); return true; }
      fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: new URLSearchParams({ grant_type: "authorization_code", client_id: C.KAKAO_REST_KEY, redirect_uri: REDIRECT, code: q.get("code") })
      }).then(function (r) { return r.json(); }).then(function (t) {
        if (!t.access_token) throw 0;
        return fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: "Bearer " + t.access_token } }).then(function (r) { return r.json(); });
      }).then(function (u) {
        var p = (u.kakao_account && u.kakao_account.profile) || u.properties || {};
        return afterLogin({ provider: "kakao", name: p.nickname || "카카오 회원", photo: p.profile_image_url || p.profile_image || "" });
      }).catch(function () { fail("카카오 로그인에 실패했어요. 다시 눌러 주세요"); });
      return true;
    }
    return false;
  }

  // ================= 화면들 =================
  var P = {};

  // 1. 첫 화면
  P.onboarding = function () {
    getUser().then(function (u) {
      var card = function (st, icon, label) {
        return '<div style="position:absolute;top:10px;width:32%;aspect-ratio:9/16;border-radius:20px;box-shadow:0 18px 40px rgba(0,0,0,.5);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;font-size:13px;' + st + '">' + ic(icon, 1) + "<b>" + label + "</b></div>";
      };
      mount({}, '<div style="padding-top:calc(28px + var(--safe-t))"><div class="logo" style="justify-content:center;font-size:22px"><i>' + ic("movie", 1) + '</i>ReelMate</div></div>' +
        '<div style="position:relative;height:300px;margin:26px 0 8px">' +
        card("left:6%;transform:rotate(-9deg);background:linear-gradient(160deg,#6228d7,#ee2a7b)", "photo_camera", "Reels") +
        card("left:34%;top:-6px;z-index:2;background:linear-gradient(160deg,#FF3D7F,#FF8A3D)", "auto_awesome", "AI 자동 편집") +
        card("left:62%;transform:rotate(9deg);background:linear-gradient(160deg,#ff0000,#ff7a59)", "play_arrow", "Shorts") + "</div>" +
        '<h2 class="title" style="text-align:center;font-size:28px">찍기만 하세요</h2>' +
        '<p class="lead" style="text-align:center">사진·짧은 영상을 고르면 AI가 보정하고 자막을 넣어<br>릴스·쇼츠·스토리 영상을 만들어 드려요.</p>' +
        '<div class="card">' + [["사진·영상 고르기", "최대 10개, 카메라로 바로 찍어도 돼요"], ["AI가 보정·자막", "원하는 색감·구도를 말로 요청할 수 있어요"], ["내 SNS 앱으로 올리기", "인스타그램·유튜브·페이스북 앱으로 바로 공유"]].map(function (s, i) {
          return '<div class="row" style="padding:7px 0"><span class="avatar" style="background:rgba(255,61,127,.14);border:0;color:#FF7AA6">' + (i + 1) + '</span><div class="grow"><b style="font-size:15px">' + s[0] + '</b><div class="tiny">' + s[1] + "</div></div></div>";
        }).join("") + "</div>");
      root.appendChild(el('<div class="dock">' + (u ? '<button class="btn" data-go>' + esc(u.name) + "님으로 계속하기 " + ic("arrow_forward") + '</button><button class="pill-btn" data-login style="display:block;margin:10px auto 0;background:none;border:0;color:var(--sub)">다른 계정으로 로그인</button>'
        : '<button class="btn" data-login>시작하기 ' + ic("arrow_forward") + "</button>") + "</div>"));
      var g = $("[data-go]"); if (g) g.onclick = function () { go("home"); };
      $("[data-login]").onclick = function () { go("login"); };
    });
  };

  // 2. 로그인
  P.login = function () {
    var kakao = C.KAKAO_REST_KEY ? '<button class="btn" data-kakao style="background:#FEE500;color:#191919;box-shadow:none">' +
      '<svg width="22" height="22" viewBox="0 0 24 24"><path fill="#191919" d="M12 3C6.48 3 2 6.48 2 10.77c0 2.78 1.88 5.23 4.75 6.55-.15.54-.99 3.47-1.03 3.69-.05.27.1.27.21.19.14-.09 2.27-1.54 3.2-2.18.61.09 1.24.14 1.87.14 5.52 0 10-3.48 10-7.77S17.52 3 12 3z"/></svg>카카오로 시작하기</button>' : "";
    mount({ top: { back: "onboarding", title: "" } },
      '<div style="text-align:center;margin:18px 0 34px"><div class="logo" style="justify-content:center;font-size:26px"><i style="width:44px;height:44px;border-radius:13px">' + ic("movie", 1) + "</i>ReelMate</div>" +
      '<p class="lead" style="margin:12px 0 0">1분 만에 만드는 나만의 AI 숏폼</p></div>' +
      '<div id="lg-state"></div>' +
      '<div style="display:flex;flex-direction:column;gap:12px">' + kakao +
      '<button class="btn ghost" data-google style="background:#fff;color:#1f1f1f;border:0"><svg width="20" height="20" viewBox="0 0 24 24"><path d="M23.75 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.67-5.17 3.67-9.17z" fill="#4285F4"/><path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" fill="#34A853"/><path d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" fill="#FBBC05"/><path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" fill="#EA4335"/></svg>Google 계정으로 로그인</button>' +
      '<button class="pill-btn" data-guest style="background:none;border:0;color:var(--sub);font-size:14px;padding:12px">로그인 없이 시작하기 ›</button></div>' +
      '<p class="tiny" style="text-align:center;margin-top:26px">로그인하면 이름·사진만 화면에 표시해요. 모든 데이터는 이 휴대폰에만 저장돼요.<br><a href="../privacy.html" style="text-decoration:underline">개인정보처리방침·이용약관</a> · ReelMate ' + VERSION + "</p>" +
      '<p class="tiny" style="text-align:center">카카오톡 안에서 열면 Google 로그인이 막혀요. 크롬·사파리로 열어 주세요.</p>');
    var k = $("[data-kakao]"); if (k) k.onclick = startKakao;
    $("[data-google]").onclick = startGoogle;
    $("[data-guest]").onclick = function () { St.set("user", { provider: "guest", name: "게스트" }).then(function () { go("connect", { first: 1 }); }); };
    if (finishLogin()) { toast("로그인 확인 중...", 3000); return; }
    getUser().then(function (u) {
      if (!u) return;
      var box = $("#lg-state");
      box.innerHTML = '<div class="card row" style="border-color:var(--pink);margin-bottom:16px">' + avatarHtml(u) +
        '<div class="grow"><b>' + esc(u.name) + '</b>님으로 로그인돼 있어요<div class="tiny">' + ({ google: "Google 계정", kakao: "카카오 계정", guest: "로그인 없이 사용 중" }[u.provider] || "") + ' · 다른 계정은 아래 버튼으로</div></div>' +
        '<button class="pill-btn grad" data-cont>계속</button></div>';
      $("[data-cont]", box).onclick = function () { go("home"); };
    });
  };

  // 3. 올릴 SNS 앱 고르기
  P.connect = function () {
    var from = qs("from"), first = qs("first");
    mount({ top: { back: from || (first ? "login" : "mypage"), title: "올릴 SNS 앱" }, dock: '<button class="btn" data-done>' + (first ? "다음 단계로 " + ic("arrow_forward") : "완료") + "</button>" },
      '<h2 class="title">어떤 앱에 올릴까요?</h2><p class="lead">휴대폰에 깔린 앱에 <b style="color:#fff">이미 로그인된 내 계정</b>으로 올라가요. 릴스를 다 만들면 고른 앱으로 영상이 바로 넘어가고, 글·해시태그는 자동 복사돼요.</p><div id="apps"></div>' +
      '<p class="tiny" style="margin-top:14px">ReelMate는 SNS 비밀번호나 계정 정보를 받지 않아요. 마지막 [게시] 버튼은 각 앱에서 직접 눌러요.</p>');
    function draw() {
      getChannels().then(function (sel) {
        $("#apps").innerHTML = Object.keys(APPS).map(function (k) {
          var a = APPS[k], on = sel.indexOf(k) !== -1;
          return '<div class="card" style="' + (on ? "border-color:var(--pink)" : "") + '"><div class="row">' + a.icon + '<div class="grow"><b style="font-size:16px">' + a.name + '</b><div class="tiny">' + a.desc + "</div></div>" +
            '<span class="chip' + (on ? " on" : "") + '">' + (on ? "사용 중" : "사용 안 함") + "</span></div>" +
            '<div class="btns" style="margin-top:12px"><button class="btn ghost small" data-open="' + k + '">앱 열어보기</button><button class="btn small' + (on ? " ghost" : "") + '" data-tg="' + k + '">' + (on ? "빼기" : "사용하기") + "</button></div></div>";
        }).join("");
        $$("[data-open]").forEach(function (b) { b.onclick = function () { openApp(b.dataset.open); }; });
        $$("[data-tg]").forEach(function (b) {
          b.onclick = function () { var k = b.dataset.tg, i = sel.indexOf(k); if (i === -1) sel.push(k); else sel.splice(i, 1); St.set("channels", sel).then(draw); };
        });
      });
    }
    draw();
    $("[data-done]").onclick = function () {
      getChannels().then(function (sel) {
        if (!sel.length) return toast("올릴 앱을 하나 이상 골라 주세요");
        if (from) go(from, qs("id") ? { id: qs("id") } : null); else go(first ? "home" : "mypage");
      });
    };
  };

  // 4. 홈
  var MOOD_INFO = [["AI에게 맡기기", "🤖", "사진을 보고 AI가 알아서"], ["감성", "🌙", "차분하고 몽환적인 톤"], ["신나게", "⚡", "빠른 템포, 밝은 색감"],
    ["공연·이벤트", "🎤", "화려하고 웅장하게"], ["여행·브이로그", "✈️", "여유로운 시네마틱 톤"], ["맛집·카페", "☕", "따뜻한 색, 음식은 선명하게"]];
  P.home = function () {
    Promise.all([getUser(), St.allProjects(), St.get("accessCode"), getChannels(), getSchedules()]).then(function (r) {
      var u = r[0], list = r[1], code = r[2], ch = r[3], sch = r[4];
      var now = Date.now(), due = sch.filter(function (s) { return !s.done && s.at <= now; });
      mount({ top: { logo: true, right: '<a href="mypage.html" aria-label="내 정보">' + avatarHtml(u) + "</a>" }, nav: "home" },
        '<h2 class="title" style="font-size:22px">안녕하세요, ' + esc(u ? u.name : "게스트") + "님 👋</h2>" +
        '<p class="lead" style="margin-bottom:14px">오늘은 어떤 순간을 릴스로 만들까요?</p>' +
        (code ? "" : '<div class="card row" style="border-color:rgba(255,138,61,.5);margin-bottom:12px">' + ic("key") + '<div class="grow"><b>AI 접속 코드를 넣어 주세요</b><div class="tiny">앱을 공유해 준 사람에게 받은 코드가 있어야 AI가 릴스를 만들어요.</div></div><button class="pill-btn grad" data-code>넣기</button></div>') +
        due.map(function (s) { return '<div class="card row" style="border-color:var(--pink);margin-bottom:12px">' + ic("alarm", 1) + '<div class="grow"><b>올릴 시간이에요!</b><div class="tiny">' + fmtDate(s.at, true) + (s.memo ? " · " + esc(s.memo) : "") + '</div></div><button class="pill-btn grad" data-due="' + s.id + '">올리기</button></div>'; }).join("") +
        '<a href="capture.html" class="card" style="display:block;background:linear-gradient(135deg,rgba(255,61,127,.22),rgba(255,138,61,.16));border-color:rgba(255,61,127,.45);padding:20px">' +
        '<div class="row"><div class="grow"><div class="chip pink" style="margin-bottom:10px">' + ic("auto_awesome", 1) + ' Claude AI</div><b style="font-size:20px;display:block">새 릴스 만들기</b><div class="muted" style="margin-top:4px">사진·짧은 영상 최대 10개 → AI가 보정·자막</div></div>' +
        '<span style="width:56px;height:56px;border-radius:18px;background:var(--grad);display:flex;align-items:center;justify-content:center">' + ic("add") + "</span></div></a>" +
        '<div class="sec"><h3>분위기로 바로 시작</h3></div><div style="display:flex;gap:8px;overflow-x:auto;margin:0 -16px;padding:0 16px 4px">' +
        MOOD_INFO.map(function (m) { return '<button class="pill-btn" data-mood="' + m[0] + '" style="padding:10px 14px">' + m[1] + " " + m[0] + "</button>"; }).join("") + "</div>" +
        '<div class="sec"><h3>최근 만든 릴스</h3>' + (list.length ? '<a href="library.html">전체보기 ›</a>' : "") + "</div>" +
        (list.length ? '<div class="grid3">' + list.slice(0, 6).map(function (p) {
          return '<a class="thumb" href="preview.html?id=' + p.id + '"><img src="' + p.thumb + '" alt=""><span class="badge">' + fmtDur(p.duration) + '</span><div class="cap">' + esc(p.title) + "</div></a>";
        }).join("") + "</div>" : '<div class="card empty">' + ic("movie") + "<div>아직 만든 릴스가 없어요.<br>위의 <b>새 릴스 만들기</b>를 눌러 보세요.</div></div>") +
        '<div class="card row" style="margin-top:16px">' + ic("send") + '<div class="grow"><b>올릴 앱</b><div class="tiny">' + (ch.map(function (k) { return APPS[k].name; }).join(", ") || "아직 안 골랐어요") + '</div></div><a class="pill-btn" href="connect.html?from=home">바꾸기</a></div>');
      var c = $("[data-code]"); if (c) c.onclick = function () { go("mypage", { code: "open" }); };
      $$("[data-due]").forEach(function (b) {
        b.onclick = function () { var s = sch.filter(function (x) { return x.id === b.dataset.due; })[0]; s.done = true; St.set("schedules", sch).then(function () { go("publish", { id: s.projectId }); }); };
      });
      $$("[data-mood]").forEach(function (b) { b.onclick = function () { St.set("draftMood", b.dataset.mood).then(function () { go("capture"); }); }; });
    });
  };

  // 5. 사진·영상 고르기
  P.capture = function () {
    var items = [];
    mount({ top: { back: "home", closeIcon: true, title: "사진·영상 고르기", step: "1 / 3" }, dock: '<button class="btn" data-next disabled>다음 ' + ic("arrow_forward") + "</button>" },
      '<div class="grid3" style="margin:6px 0 16px">' +
      [["photo", "photo_camera", "사진 찍기"], ["video", "videocam", "영상 찍기"], ["album", "photo_library", "앨범에서"]].map(function (b) {
        return '<button class="card" data-pick="' + b[0] + '" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 6px;font-weight:700;font-size:14px">' +
          '<span style="width:46px;height:46px;border-radius:14px;background:' + (b[0] === "album" ? "var(--grad)" : "var(--card2)") + ';display:flex;align-items:center;justify-content:center">' + ic(b[1], 1) + "</span>" + b[2] + "</button>";
      }).join("") + "</div>" +
      '<div class="sec" style="margin-top:6px"><h3 id="cnt"></h3><button class="link hide" data-clear style="color:var(--sub);font-size:13px;font-weight:600">모두 지우기</button></div>' +
      '<div id="picked"></div><p class="tiny" style="margin-top:12px">· 순서대로 영상이 만들어져요. ◀ ▶로 순서를 바꿀 수 있어요.<br>· 동영상은 앞부분 최대 8초만 써요. 소리는 들어가지 않아요(음악은 SNS 앱에서 붙여요).</p>');
    function save() { return St.set("draftItems", items); }
    function draw() {
      $("#cnt").textContent = "고른 사진·영상 " + items.length + " / " + MAX_ITEMS;
      $("[data-clear]").classList.toggle("hide", !items.length);
      var nx = $("[data-next]"); nx.disabled = !items.length;
      nx.innerHTML = "다음" + (items.length ? " (" + items.length + ")" : "") + " " + ic("arrow_forward");
      var round = "border-radius:50%;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;color:#fff";
      $("#picked").innerHTML = items.length ? '<div class="grid3">' + items.map(function (it, i) {
        return '<div class="thumb"><img src="' + thumbSrc(it) + '" alt=""><span class="badge">' + (i + 1) + (isVideo(it) ? " · 🎬 " + fmtDur(Math.min(8, it.duration)) : "") + "</span>" +
          '<button data-del="' + i + '" aria-label="빼기" style="position:absolute;top:5px;right:5px;width:26px;height:26px;' + round + '">✕</button>' +
          '<div style="position:absolute;bottom:5px;left:5px;right:5px;display:flex;justify-content:space-between">' +
          '<button data-mv="' + i + ',-1" aria-label="앞으로" style="width:30px;height:30px;' + round + (i ? "" : ";visibility:hidden") + '">◀</button>' +
          '<button data-mv="' + i + ',1" aria-label="뒤로" style="width:30px;height:30px;' + round + (i < items.length - 1 ? "" : ";visibility:hidden") + '">▶</button></div></div>';
      }).join("") + "</div>" : '<div class="card empty">' + ic("add_photo_alternate") + "<div>위 버튼으로 사진이나 짧은 영상을 골라 주세요.</div></div>";
      $$("[data-del]").forEach(function (b) { b.onclick = function () { items.splice(+b.dataset.del, 1); save(); draw(); }; });
      $$("[data-mv]").forEach(function (b) {
        b.onclick = function () { var a = b.dataset.mv.split(","), i = +a[0], j = i + +a[1]; var t = items[i]; items[i] = items[j]; items[j] = t; save(); draw(); };
      });
    }
    $$("[data-pick]").forEach(function (b) {
      b.onclick = function () {
        if (items.length >= MAX_ITEMS) return toast("최대 " + MAX_ITEMS + "개까지 고를 수 있어요");
        pickFiles(b.dataset.pick, function (add) {
          var room = MAX_ITEMS - items.length;
          items = items.concat(add.slice(0, room)); save().then(draw);
          toast(add.length > room ? "최대 " + MAX_ITEMS + "개라서 " + room + "개만 넣었어요" : add.length + "개를 넣었어요");
        });
      };
    });
    $("[data-clear]").onclick = function () { confirmBox("모두 지울까요?", "고른 사진·영상을 목록에서 빼요. 휴대폰 앨범의 원본은 그대로예요.", "모두 지우기", true).then(function (ok) { if (ok) { items = []; save(); draw(); } }); };
    $("[data-next]").onclick = function () { if (items.length) go("mood"); };
    St.get("draftItems").then(function (d) {
      if (d && d.length) items = d;
      else return St.get("draftPhotos").then(function (ph) { if (ph && ph.length) items = ph; });
    }).then(draw);
  };

  // 6. 분위기·요청
  function styleSample(k, on) {
    var css = { basic: "color:#fff;text-shadow:0 2px 6px #000", box: "background:#fff;color:#111;padding:2px 8px;border-radius:6px", yellow: "color:#FFE14D;-webkit-text-stroke:1px #000;text-shadow:0 0 2px #000", neon: "color:#fff;text-shadow:0 0 8px #FF3D7F,0 0 14px #FF3D7F" }[k];
    return '<button class="opt' + (on ? " on" : "") + '" data-style="' + k + '" style="padding:12px;text-align:center"><div style="height:46px;border-radius:10px;background:linear-gradient(135deg,#3a2a4a,#4a3020);display:flex;align-items:center;justify-content:center"><span style="font-weight:900;font-size:15px;' + css + '">자막 예시</span></div><small style="margin-top:6px">' + R.STYLES[k] + "</small></button>";
  }
  P.mood = function () {
    Promise.all([St.get("draftItems"), St.get("draftMood"), St.get("draftRequest"), St.get("draftOpts"), getPrefs(), St.get("draftPhotos")]).then(function (r) {
      var items = (r[0] && r[0].length ? r[0] : r[5]) || [], mood = r[1] || r[4].mood, request = r[2] || "", opts = r[3] || { style: r[4].style, captions: true, title: true };
      if (!items.length) { toast("먼저 사진·영상을 골라 주세요"); return setTimeout(function () { go("capture"); }, 900); }
      var chips = ["따뜻한 필름 느낌", "더 밝고 화사하게", "인물을 화면 가운데에", "빠른 템포로", "자막은 위쪽에", "흑백 감성", "선명하고 쨍하게"];
      mount({ top: { back: "capture", title: "분위기·요청", step: "2 / 3" }, dock: '<button class="btn" data-make>' + ic("auto_awesome", 1) + " AI로 릴스 만들기</button>" },
        '<div class="sec" style="margin-top:4px"><h3>어떤 분위기로 만들까요?</h3></div><div class="grid2">' +
        MOOD_INFO.map(function (m) { return '<button class="opt' + (m[0] === mood ? " on" : "") + '" data-mood="' + m[0] + '"><span class="ck">' + ic("check") + '</span><span class="em">' + m[1] + "</span><b>" + m[0] + "</b><small>" + m[2] + "</small></button>"; }).join("") + "</div>" +
        '<div class="sec"><h3>원하는 보정·구도 (선택)</h3></div>' +
        '<textarea class="field" id="req" placeholder="예) 따뜻하고 필름 느낌으로, 인물을 가운데에, 전체적으로 조금 밝게">' + esc(request) + "</textarea>" +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' + chips.map(function (c) { return '<button class="pill-btn" data-chip="' + c + '">+ ' + c + "</button>"; }).join("") + "</div>" +
        '<div class="sec"><h3>자막 스타일</h3></div><div class="grid2" id="styles"></div>' +
        '<div class="list" style="margin-top:14px">' +
        '<div class="item"><div class="grow">자막 넣기<div class="tiny">AI가 장면마다 짧은 자막을 써요</div></div><button class="switch' + (opts.captions !== false ? " on" : "") + '" data-sw="captions" aria-label="자막 넣기"></button></div>' +
        '<div class="item"><div class="grow">첫 화면에 제목 넣기</div><button class="switch' + (opts.title !== false ? " on" : "") + '" data-sw="title" aria-label="제목 넣기"></button></div></div>');
      function drawStyles() { $("#styles").innerHTML = Object.keys(R.STYLES).map(function (k) { return styleSample(k, k === (opts.style || "basic")); }).join(""); $$("[data-style]").forEach(function (b) { b.onclick = function () { opts.style = b.dataset.style; St.set("draftOpts", opts); drawStyles(); }; }); }
      drawStyles();
      $$("[data-mood]").forEach(function (b) { b.onclick = function () { mood = b.dataset.mood; St.set("draftMood", mood); $$("[data-mood]").forEach(function (x) { x.classList.toggle("on", x === b); }); }; });
      var ta = $("#req"); ta.oninput = function () { St.set("draftRequest", ta.value); };
      $$("[data-chip]").forEach(function (b) { b.onclick = function () { ta.value = (ta.value.trim() ? ta.value.trim() + ", " : "") + b.dataset.chip; ta.oninput(); }; });
      $$("[data-sw]").forEach(function (b) { b.onclick = function () { b.classList.toggle("on"); opts[b.dataset.sw] = b.classList.contains("on"); St.set("draftOpts", opts); }; });
      $("[data-make]").onclick = function () {
        St.set("draftItems", items).then(function () { return St.set("draftMood", mood); }).then(function () { return St.set("draftOpts", opts); })
          .then(function () { return St.set("draftRequest", ta.value); }).then(function () { return St.set("job", { mode: "ai" }); }).then(function () { go("creating"); });
      };
    });
  };

  // 7. 만드는 중
  P.creating = function () {
    var cancelled = false, hiddenDuring = false, renderingNow = false, lock = null;
    mount({ top: { back: function () { confirmBox("만들기를 멈출까요?", "지금까지 진행한 내용은 저장되지 않아요.", "멈추기", true).then(function (ok) { if (ok) { cancelled = true; back("mood"); } }); }, closeIcon: true, title: "릴스 만드는 중" } },
      '<div style="text-align:center;margin:26px 0 20px"><div style="position:relative;width:150px;height:150px;margin:0 auto">' +
      '<svg width="150" height="150" viewBox="0 0 150 150" style="transform:rotate(-90deg)"><defs><linearGradient id="gr"><stop offset="0" stop-color="#FF3D7F"/><stop offset="1" stop-color="#FF8A3D"/></linearGradient></defs><circle cx="75" cy="75" r="66" stroke="#1F1F27" stroke-width="12" fill="none"/><circle id="ring" cx="75" cy="75" r="66" stroke="url(#gr)" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="415" stroke-dashoffset="415" style="transition:stroke-dashoffset .3s"/></svg>' +
      '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:900" id="pct">0%</div></div>' +
      '<p class="lead" id="msg" style="margin:16px 0 0">준비하는 중...</p></div>' +
      '<div class="card" id="steps"></div>' +
      '<div class="card row" style="margin-top:12px">' + ic("light_mode") + '<div class="grow tiny" style="color:var(--sub)">영상은 이 휴대폰 안에서 실제 길이만큼 재생하며 만들어요. <b style="color:#fff">화면을 끄거나 다른 앱으로 가면 멈춰요.</b></div></div>');
    var STEPS = ["사진·영상 분석", "AI 보정·구도·자막", "영상 만들기", "휴대폰에 저장"];
    function setStep(n, msg) {
      $("#steps").innerHTML = STEPS.map(function (s, i) {
        var cls = i < n ? "done" : i === n ? "now" : "";
        return '<div class="stepl ' + cls + '"><span class="dot">' + (i < n ? ic("check") : i === n ? '<span class="ms spin">progress_activity</span>' : i + 1) + "</span><b>" + s + "</b></div>";
      }).join("");
      if (msg) $("#msg").textContent = msg;
    }
    function setPct(p) { p = Math.max(0, Math.min(100, Math.round(p))); $("#pct").textContent = p + "%"; $("#ring").style.strokeDashoffset = 415 - 415 * p / 100; }
    document.addEventListener("visibilitychange", function () { if (document.hidden && renderingNow) hiddenDuring = true; });
    try { if (navigator.wakeLock) navigator.wakeLock.request("screen").then(function (l) { lock = l; }).catch(function () {}); } catch (e) {}
    function fail(err) {
      if (cancelled) return;
      var codeBtn = err.kind === "code" || err.kind === "setup" ? '<button class="btn ghost" data-code style="margin-top:10px">접속 코드 넣으러 가기</button>' : "";
      var d = sheet('<div style="text-align:center;font-size:40px">⚠️</div><h3 style="text-align:center">' + (err.kind === "render" ? "영상 만들기에 실패했어요" : "AI 연결에 실패했어요") + '</h3><p class="muted" style="text-align:center;margin:0 0 18px">' + esc(err.message) + "</p>" +
        '<button class="btn" data-retry>다시 시도</button>' + codeBtn + '<button class="pill-btn" data-bk style="display:block;margin:12px auto 0;background:none;border:0;color:var(--sub)">이전으로</button>', { center: true, sticky: true });
      $("[data-retry]", d).onclick = function () { d.close(); run(); };
      var c = $("[data-code]", d); if (c) c.onclick = function () { go("mypage", { code: "open" }); };
      $("[data-bk]", d).onclick = function () { back("mood"); };
    }
    function doRender(items, caps, title, opt) {
      renderingNow = true; hiddenDuring = false;
      return R.render(items, caps, title, opt, function (p) { setPct(45 + p * 50); })
        .then(function (out) { renderingNow = false; return out; }, function (e) { renderingNow = false; throw AiError(e.message || "영상 만들기에 실패했어요", "render"); });
    }
    function finish(proj) {
      setStep(3, "휴대폰에 저장하는 중..."); setPct(98);
      return St.saveProject(proj).then(function () { return St.set("currentId", proj.id); }).then(function () {
        setPct(100); if (lock) try { lock.release(); } catch (e) {}
        if (cancelled) return;
        if (hiddenDuring) {
          var d = sheet('<h3>화면이 꺼졌었어요</h3><p class="muted" style="margin:0 0 16px">만드는 중에 화면이 꺼지거나 다른 앱으로 가서 영상 일부가 멈췄을 수 있어요. 미리보기에서 확인하고, 이상하면 <b>바뀐 내용으로 다시 만들기</b>를 눌러 주세요(AI 비용 없음).</p><button class="btn" data-ok>미리보기 보기</button>', { center: true, sticky: true });
          $("[data-ok]", d).onclick = function () { go("preview", { id: proj.id }); };
          return;
        }
        go("preview", { id: proj.id });
      });
    }
    function run() {
      St.get("job").then(function (job) {
        job = job || { mode: "ai" };
        if (job.mode === "local") {
          // AI를 다시 부르지 않고, 고친 자막·순서·스타일로만 다시 만들기 (비용 없음)
          return St.getProject(job.projectId).then(function (p) {
            if (!p) throw AiError("릴스를 찾지 못했어요.", "render");
            setStep(2, "고친 내용으로 영상을 다시 만드는 중..."); setPct(45);
            var items = itemsOf(p);
            return doRender(items, p.captionsOn === false ? [] : p.captions, p.title, { edits: p.edits, video: p.videoPlan, style: p.style, showTitle: p.showTitle !== false }).then(function (out) {
              p.video = out.blob; p.mime = out.mime; p.duration = out.duration; p.updatedAt = Date.now();
              return R.thumbOf(items[0]).then(function (th) { p.thumb = th; return finish(p); });
            });
          });
        }
        var src = job.projectId ? St.getProject(job.projectId) : null;
        return Promise.all([St.get("draftItems"), St.get("draftMood"), St.get("draftRequest"), St.get("draftOpts"), src, getPrefs()]).then(function (r) {
          var old = r[4], items = old ? itemsOf(old) : (r[0] || []), mood = old ? old.mood : (r[1] || r[5].mood);
          var opts = old ? { style: old.style, captions: old.captionsOn !== false, title: old.showTitle !== false } : (r[3] || { style: r[5].style, captions: true, title: true });
          var request = old ? job.request || "" : (r[2] || "");
          if (!items.length) { toast("먼저 사진·영상을 골라 주세요"); return setTimeout(function () { go("capture"); }, 1000); }
          setStep(0, "Claude가 사진·영상을 살펴보는 중..."); setPct(5);
          var tick = setInterval(function () { var cur = parseInt($("#pct").textContent, 10) || 0; if (cur < 38) setPct(cur + 1); }, 450);
          return aiPlan(items, mood, request, job.keepCaps || null).then(function (ai) {
            clearInterval(tick);
            if (cancelled) return;
            setStep(1, ai.note ? "보정: " + ai.note : "요청대로 보정·구도를 맞추는 중..."); setPct(42);
            var title = ai.title || mood + " 릴스", caps = ai.captions;
            setTimeout(function () { setStep(2, "영상을 만드는 중... 화면을 켜 두세요"); }, 700);
            return doRender(items, opts.captions === false ? [] : caps, title, { edits: ai.edits, video: ai.video, style: opts.style, showTitle: opts.title !== false }).then(function (out) {
              return R.thumbOf(items[0]).then(function (thumb) {
                var proj = old || { id: "p" + Date.now(), createdAt: Date.now() };
                proj.title = title; proj.mood = mood; proj.captions = caps; proj.hashtags = ai.hashtags || []; proj.request = request; proj.edits = ai.edits;
                proj.note = ai.note || ""; proj.items = items; delete proj.photos; proj.thumb = thumb; proj.video = out.blob; proj.mime = out.mime; proj.duration = out.duration;
                proj.videoPlan = ai.video; proj.style = opts.style || "basic"; proj.captionsOn = opts.captions !== false; proj.showTitle = opts.title !== false;
                proj.caption = null; proj.updatedAt = Date.now();
                var clear = old ? Promise.resolve() : St.set("draftItems", null).then(function () { return St.set("draftPhotos", null); }).then(function () { return St.set("draftRequest", ""); });
                return clear.then(function () { return finish(proj); });
              });
            });
          }, function (e) { clearInterval(tick); throw e; });
        });
      }).catch(function (e) { fail(e.kind ? e : AiError(e.message || "실패했어요", "render")); });
    }
    setStep(0); run();
  };

  // 8. 미리보기·수정
  function deleteProject(id) {
    return St.deleteProject(id).then(getSchedules).then(function (s) { return St.set("schedules", s.filter(function (x) { return x.projectId !== id; })); });
  }
  P.preview = function () {
    var id = qs("id");
    (id ? Promise.resolve(id) : St.get("currentId")).then(function (cid) { return cid && St.getProject(cid); }).then(function (p) {
      if (!p) { mount({ top: { back: "home", title: "미리보기" }, nav: "library" }, '<div class="empty">' + ic("movie") + "<div>릴스를 찾지 못했어요.</div></div>"); return; }
      St.set("currentId", p.id);
      var items = itemsOf(p).slice(), caps = (p.captions || []).slice(), edits = (p.edits || []).slice(), dirty = false;
      while (caps.length < items.length) caps.push("");
      mount({ top: { back: "home", title: "미리보기", right: '<button class="icon-btn" data-more aria-label="더보기">' + ic("more_vert") + "</button>" },
        dock: '<div class="btns"><button class="btn ghost" data-save style="flex:.8">' + ic("download") + ' 저장</button><button class="btn" data-next>올리기 ' + ic("arrow_forward") + "</button></div>" },
        '<div style="position:relative;margin:0 auto;width:min(100%,calc(58vh * 9 / 16));aspect-ratio:9/16;border-radius:22px;overflow:hidden;background:#000">' +
        '<video id="vid" playsinline muted loop autoplay style="width:100%;height:100%;object-fit:contain"></video>' +
        '<button id="pp" aria-label="재생/정지" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"></button>' +
        '<span style="position:absolute;top:10px;left:10px;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:800;background:rgba(0,0,0,.6)">' + fmtDur(p.duration) + " · 소리 없음</span></div>" +
        (p.note ? '<div class="card row" style="margin-top:12px">' + ic("auto_awesome", 1) + '<div class="grow tiny" style="color:var(--sub)">AI 보정: ' + esc(p.note) + "</div></div>" : "") +
        '<div class="sec"><h3>제목</h3></div><input class="field" id="title" value="' + esc(p.title) + '">' +
        '<div class="sec"><h3>장면별 자막 · 순서</h3></div><div id="scenes"></div>' +
        '<div class="sec"><h3>자막 스타일</h3></div><div class="grid2" id="styles"></div>' +
        '<div class="list" style="margin-top:12px"><div class="item"><div class="grow">자막 넣기</div><button class="switch' + (p.captionsOn !== false ? " on" : "") + '" data-sw="captionsOn" aria-label="자막 넣기"></button></div>' +
        '<div class="item"><div class="grow">첫 화면에 제목 넣기</div><button class="switch' + (p.showTitle !== false ? " on" : "") + '" data-sw="showTitle" aria-label="제목 넣기"></button></div></div>' +
        '<button class="btn hide" id="local" style="margin-top:14px">' + ic("refresh") + " 바뀐 내용으로 다시 만들기 (AI 비용 없음)</button>" +
        '<div class="sec"><h3>AI에게 수정 요청</h3></div><textarea class="field" id="req" placeholder="예) 더 따뜻하게, 2번 사진은 인물을 크게, 전체적으로 빠르게"></textarea>' +
        '<button class="btn ghost" id="airemake" style="margin-top:10px">' + ic("auto_awesome", 1) + " AI에게 다시 맡기기</button>" +
        '<p class="tiny" style="margin-top:8px">AI에게 다시 맡기면 보정·구도를 새로 정해요. 위에서 고친 자막은 그대로 지켜요.</p>');
      var v = $("#vid"); v.src = URL.createObjectURL(p.video); v.play().catch(function () {});
      var pp = $("#pp");
      function ppIcon() { pp.innerHTML = v.paused ? '<span style="width:64px;height:64px;border-radius:50%;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center"><span class="ms fill" style="font-size:40px">play_arrow</span></span>' : ""; }
      pp.onclick = function () { if (v.paused) v.play(); else v.pause(); };
      v.onplay = v.onpause = ppIcon; ppIcon();
      function markDirty() { dirty = true; $("#local").classList.remove("hide"); }
      function drawScenes() {
        $("#scenes").innerHTML = items.map(function (it, i) {
          return '<div class="card row" style="padding:10px;gap:10px"><div class="thumb" style="width:44px;flex:none;border-radius:8px"><img src="' + thumbSrc(it) + '" alt=""></div>' +
            '<input class="field" data-cap="' + i + '" value="' + esc(caps[i] || "") + '" placeholder="자막 없음" style="padding:10px 12px;font-size:14px">' +
            '<div style="display:flex;flex-direction:column;gap:2px"><button class="icon-btn" data-up="' + i + '" aria-label="위로" style="height:26px' + (i ? "" : ";visibility:hidden") + '">' + ic("keyboard_arrow_up") + '</button><button class="icon-btn" data-dn="' + i + '" aria-label="아래로" style="height:26px' + (i < items.length - 1 ? "" : ";visibility:hidden") + '">' + ic("keyboard_arrow_down") + "</button></div></div>";
        }).join("");
        $$("[data-cap]").forEach(function (f) { f.oninput = function () { caps[+f.dataset.cap] = f.value; markDirty(); }; });
        function swap(i, j) { [items, caps, edits].forEach(function (a) { var t = a[i]; a[i] = a[j]; a[j] = t; }); markDirty(); drawScenes(); }
        $$("[data-up]").forEach(function (b) { b.onclick = function () { var i = +b.dataset.up; swap(i, i - 1); }; });
        $$("[data-dn]").forEach(function (b) { b.onclick = function () { var i = +b.dataset.dn; swap(i, i + 1); }; });
      }
      drawScenes();
      var style = p.style || "basic";
      function drawStyles() { $("#styles").innerHTML = Object.keys(R.STYLES).map(function (k) { return styleSample(k, k === style); }).join(""); $$("[data-style]").forEach(function (b) { b.onclick = function () { if (style !== b.dataset.style) { style = b.dataset.style; markDirty(); drawStyles(); } }; }); }
      drawStyles();
      var flags = { captionsOn: p.captionsOn !== false, showTitle: p.showTitle !== false };
      $$("[data-sw]").forEach(function (b) { b.onclick = function () { b.classList.toggle("on"); flags[b.dataset.sw] = b.classList.contains("on"); markDirty(); }; });
      $("#title").oninput = markDirty;
      function collect() {
        p.items = items; delete p.photos; p.captions = caps.map(function (c) { return String(c || "").trim(); }); p.edits = edits; p.style = style;
        p.captionsOn = flags.captionsOn; p.showTitle = flags.showTitle; p.title = $("#title").value.trim() || p.title;
        return St.saveProject(p);
      }
      $("#local").onclick = function () { collect().then(function () { return St.set("job", { mode: "local", projectId: p.id }); }).then(function () { go("creating"); }); };
      $("#airemake").onclick = function () {
        var req = $("#req").value.trim();
        if (!req) return toast("AI에게 바라는 수정 내용을 적어 주세요");
        collect().then(function () {
          var full = [p.request, req].filter(Boolean).join(" / 추가 요청: ");
          return St.set("job", { mode: "ai", projectId: p.id, request: full, keepCaps: p.captions });
        }).then(function () { go("creating"); });
      };
      function guardDirty(fn) {
        if (!dirty) return fn();
        confirmBox("고친 내용이 아직 영상에 없어요", "지금 영상은 고치기 전 버전이에요. 먼저 '다시 만들기'를 할까요?", "다시 만들기").then(function (ok) { if (ok) $("#local").onclick(); else fn(); });
      }
      $("[data-save]").onclick = function () { R.exportVideo(p); };
      $("[data-next]").onclick = function () { guardDirty(function () { collect().then(function () { go("publish", { id: p.id }); }); }); };
      $("[data-more]").onclick = function () {
        var d = sheet('<h3>' + esc(p.title) + '</h3><div class="list"><button class="item" data-a="save">' + ic("download") + '<span class="grow">휴대폰에 저장·공유</span></button><button class="item" data-a="sch">' + ic("calendar_month") + '<span class="grow">올릴 시간 예약</span></button><button class="item" data-a="del" style="color:var(--red)">' + ic("delete") + '<span class="grow">이 릴스 삭제</span></button></div>');
        $$("[data-a]", d).forEach(function (b) {
          b.onclick = function () {
            d.close();
            if (b.dataset.a === "save") R.exportVideo(p);
            if (b.dataset.a === "sch") go("schedule", { new: p.id });
            if (b.dataset.a === "del") confirmBox("릴스를 삭제할까요?", "이 휴대폰에서 지워지고 되돌릴 수 없어요.", "삭제", true).then(function (ok) { if (ok) deleteProject(p.id).then(function () { go("library"); }); });
          };
        });
      };
    });
  };

  // 9. 올리기
  function captionOf(p) {
    if (p.caption) return p.caption;
    var tags = (p.hashtags || []).map(function (h) { h = String(h).trim(); return h.charAt(0) === "#" ? h : "#" + h; }).join(" ");
    return [p.title, tags].filter(Boolean).join("\n\n");
  }
  P.publish = function () {
    var id = qs("id");
    (id ? Promise.resolve(id) : St.get("currentId")).then(function (cid) { return cid && St.getProject(cid); }).then(function (p) {
      if (!p) { toast("올릴 릴스를 먼저 골라 주세요"); return setTimeout(function () { go("library"); }, 900); }
      getChannels().then(function (ch) {
        var tags = (p.hashtags || []).map(function (h) { h = String(h).trim(); return h.charAt(0) === "#" ? h : "#" + h; });
        mount({ top: { back: function () { go("preview", { id: p.id }); }, title: "올리기", step: "3 / 3" },
          dock: '<div class="btns"><button class="btn ghost" data-sch style="flex:.7">' + ic("schedule") + ' 예약</button><button class="btn" data-share>' + ic("send", 1) + " 지금 올리기</button></div>" },
          '<div class="card row"><div class="thumb" style="width:64px;flex:none;border-radius:10px"><img src="' + p.thumb + '" alt=""></div><div class="grow"><b>' + esc(p.title) + '</b><div class="tiny">' + fmtDur(p.duration) + " · 9:16 세로 · " + fmtDate(p.createdAt) + "</div></div></div>" +
          '<div class="sec"><h3>게시 글 · 해시태그</h3><button class="link" data-copy style="color:var(--sub);font-size:13px;font-weight:700">복사</button></div>' +
          '<textarea class="field" id="cap" rows="5">' + esc(captionOf(p)) + "</textarea>" +
          (tags.length ? '<div class="tiny" style="margin:8px 0 6px">해시태그를 눌러 넣고 빼기</div><div style="display:flex;flex-wrap:wrap;gap:6px" id="tags"></div>' : "") +
          '<div class="sec"><h3>올릴 앱</h3><a href="connect.html?from=publish&id=' + p.id + '">바꾸기 ›</a></div>' +
          '<div class="card">' + (ch.length ? ch.map(function (k) { return '<div class="row" style="padding:6px 0">' + APPS[k].icon + '<div class="grow"><b>' + APPS[k].name + '</b><div class="tiny">' + APPS[k].desc + "</div></div></div>"; }).join("") : '<div class="muted">올릴 앱을 골라 주세요.</div>') + "</div>" +
          '<div class="card" style="margin-top:12px"><b>🚀 지금 올리기를 누르면</b><div class="muted" style="margin-top:6px">① 위 글·해시태그가 복사되고<br>② 휴대폰 공유 창이 떠요 → <b style="color:#fff">' + esc(ch.map(function (k) { return APPS[k].name; }).join(" / ") || "올릴 앱") + "</b> 선택<br>③ 앱에서 음악을 붙이고, 글 칸을 길게 눌러 <b style=\"color:#fff\">붙여넣기</b> → 게시</div></div>");
        var ta = $("#cap");
        function saveCap() { p.caption = ta.value; return St.saveProject(p); }
        function drawTags() {
          var box = $("#tags"); if (!box) return;
          box.innerHTML = tags.map(function (t) { var on = ta.value.indexOf(t) !== -1; return '<button class="chip' + (on ? " pink" : "") + '" data-tag="' + esc(t) + '" style="padding:6px 11px">' + (on ? "✓ " : "+ ") + esc(t) + "</button>"; }).join("");
          $$("[data-tag]").forEach(function (b) {
            b.onclick = function () {
              var t = b.dataset.tag;
              if (ta.value.indexOf(t) !== -1) ta.value = ta.value.split(t).join("").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
              else ta.value = ta.value.trim() + (/#\S+$/.test(ta.value.trim()) ? " " : "\n\n") + t;
              saveCap(); drawTags();
            };
          });
        }
        ta.oninput = function () { saveCap(); drawTags(); };
        drawTags();
        $("[data-copy]").onclick = function () { copyText(ta.value); toast("글·해시태그를 복사했어요"); };
        $("[data-sch]").onclick = function () { saveCap().then(function () { go("schedule", { new: p.id }); }); };
        $("[data-share]").onclick = function () {
          copyText(ta.value);
          toast("글을 복사했어요. 공유 창에서 올릴 앱을 고르세요", 3500);
          p.caption = ta.value;
          var after = function () { p.sharedAt = Date.now(); St.saveProject(p).then(function () { setTimeout(function () { go("done", { id: p.id }); }, 500); }); };
          R.exportVideo(p).then(after, after);
        };
      });
    });
  };

  // 10. 완료
  P.done = function () {
    var id = qs("id");
    (id ? Promise.resolve(id) : St.get("currentId")).then(function (cid) { return cid && St.getProject(cid); }).then(function (p) {
      getChannels().then(function (ch) {
        mount({ top: { back: "home", closeIcon: true, title: "" } },
          '<div style="text-align:center;margin:10px 0 22px"><div style="width:84px;height:84px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;box-shadow:0 12px 34px rgba(255,61,127,.4)"><span class="ms" style="font-size:46px">check</span></div>' +
          '<h2 class="title">영상을 앱으로 넘겼어요!</h2><p class="lead">공유 창에서 고른 앱에서 <b style="color:#fff">음악을 붙이고</b>, 글 칸을 길게 눌러 <b style="color:#fff">붙여넣기</b>한 뒤 게시하면 끝이에요.</p></div>' +
          (ch.length ? '<div class="sec"><h3>앱 바로 열기</h3></div><div class="grid3" style="grid-template-columns:repeat(' + ch.length + ',1fr)">' + ch.map(function (k) { return '<button class="card" data-open="' + k + '" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 6px;font-weight:700;font-size:13px">' + APPS[k].icon + APPS[k].name + "</button>"; }).join("") + "</div>" : "") +
          (p ? '<div class="list" style="margin-top:16px"><button class="item" data-a="copy">' + ic("content_copy") + '<span class="grow">글·해시태그 다시 복사</span></button><button class="item" data-a="share">' + ic("ios_share") + '<span class="grow">다시 공유하기 (다른 앱에도 올리기)</span></button><button class="item" data-a="lib">' + ic("video_library") + '<span class="grow">보관함에서 보기</span></button></div>' : "") +
          '<button class="btn" data-new style="margin-top:18px">' + ic("add") + " 새 릴스 만들기</button>");
        $$("[data-open]").forEach(function (b) { b.onclick = function () { openApp(b.dataset.open); }; });
        $$("[data-a]").forEach(function (b) {
          b.onclick = function () {
            if (b.dataset.a === "copy") { copyText(captionOf(p)); toast("글·해시태그를 복사했어요"); }
            if (b.dataset.a === "share") { copyText(captionOf(p)); R.exportVideo(p); }
            if (b.dataset.a === "lib") go("library");
          };
        });
        $("[data-new]").onclick = function () { go("capture"); };
      });
    });
  };

  // 11. 보관함
  P.library = function () {
    Promise.all([St.allProjects(), getSchedules()]).then(function (r) {
      var all = r[0], sch = r[1], filter = "all", sort = "new", q = "";
      var scheduled = {}; sch.forEach(function (s) { if (!s.done) scheduled[s.projectId] = s.at; });
      mount({ top: { title: "보관함" }, nav: "library" },
        '<input class="field" id="q" placeholder="제목으로 찾기" style="margin-bottom:10px">' +
        '<div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:12px" id="fl"></div><div id="grid"></div>' +
        '<p class="tiny" style="margin-top:14px">릴스는 이 휴대폰 안에만 저장돼요. 앱 데이터를 지우면 함께 지워지니, 중요한 영상은 <b>저장</b>으로 사진첩에 보관하세요.</p>');
      function draw() {
        var counts = { all: all.length, shared: 0, notyet: 0, sched: 0 };
        all.forEach(function (p) { if (p.sharedAt) counts.shared++; else counts.notyet++; if (scheduled[p.id]) counts.sched++; });
        $("#fl").innerHTML = [["all", "전체"], ["notyet", "안 올림"], ["shared", "공유함"], ["sched", "예약됨"]].map(function (f) {
          return '<button class="chip' + (filter === f[0] ? " pink" : "") + '" data-f="' + f[0] + '" style="padding:7px 12px;font-size:13px;white-space:nowrap">' + f[1] + " " + counts[f[0]] + "</button>";
        }).join("") + '<button class="chip" data-sort style="padding:7px 12px;font-size:13px;margin-left:auto;white-space:nowrap">' + (sort === "new" ? "최신순" : "오래된순") + " ↕</button>";
        var list = all.filter(function (p) {
          if (q && String(p.title).toLowerCase().indexOf(q) === -1) return false;
          return filter === "all" || (filter === "shared" && p.sharedAt) || (filter === "notyet" && !p.sharedAt) || (filter === "sched" && scheduled[p.id]);
        });
        if (sort === "old") list = list.slice().reverse();
        $("#grid").innerHTML = list.length ? '<div class="grid3">' + list.map(function (p) {
          return '<div class="thumb"><a href="preview.html?id=' + p.id + '"><img src="' + p.thumb + '" alt=""></a><span class="badge">' + (scheduled[p.id] ? "⏰ " : p.sharedAt ? "✓ " : "") + fmtDur(p.duration) + "</span>" +
            '<button data-m="' + p.id + '" aria-label="메뉴" style="position:absolute;top:4px;right:4px;width:30px;height:30px;border-radius:50%;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center"><span class="ms" style="font-size:18px">more_vert</span></button><div class="cap">' + esc(p.title) + '<br><span style="font-weight:500;opacity:.7">' + fmtDate(p.createdAt) + "</span></div></div>";
        }).join("") + "</div>" : '<div class="card empty">' + ic("video_library") + "<div>" + (all.length ? "조건에 맞는 릴스가 없어요." : "아직 만든 릴스가 없어요.<br>가운데 <b>+</b> 버튼으로 만들어 보세요.") + "</div></div>";
        $$("[data-f]").forEach(function (b) { b.onclick = function () { filter = b.dataset.f; draw(); }; });
        $("[data-sort]").onclick = function () { sort = sort === "new" ? "old" : "new"; draw(); };
        $$("[data-m]").forEach(function (b) {
          b.onclick = function () {
            var p = all.filter(function (x) { return x.id === b.dataset.m; })[0];
            var d = sheet('<h3>' + esc(p.title) + '</h3><p class="tiny" style="margin:0 0 12px">' + fmtDate(p.createdAt, true) + " · " + fmtDur(p.duration) + '</p><div class="list">' +
              [["open", "play_circle", "열어서 보기·고치기"], ["pub", "send", "SNS에 올리기"], ["save", "download", "휴대폰에 저장·공유"], ["sch", "calendar_month", "올릴 시간 예약"]].map(function (a) { return '<button class="item" data-a="' + a[0] + '">' + ic(a[1]) + '<span class="grow">' + a[2] + "</span></button>"; }).join("") +
              '<button class="item" data-a="del" style="color:var(--red)">' + ic("delete") + '<span class="grow">삭제</span></button></div>');
            $$("[data-a]", d).forEach(function (x) {
              x.onclick = function () {
                d.close(); var a = x.dataset.a;
                if (a === "open") go("preview", { id: p.id });
                if (a === "pub") go("publish", { id: p.id });
                if (a === "save") R.exportVideo(p);
                if (a === "sch") go("schedule", { new: p.id });
                if (a === "del") confirmBox("릴스를 삭제할까요?", "이 휴대폰에서 지워지고 되돌릴 수 없어요.", "삭제", true).then(function (ok) {
                  if (ok) deleteProject(p.id).then(function () { all = all.filter(function (y) { return y.id !== p.id; }); delete scheduled[p.id]; toast("삭제했어요"); draw(); });
                });
              };
            });
          };
        });
      }
      $("#q").oninput = function () { q = this.value.trim().toLowerCase(); draw(); };
      draw();
    });
  };

  // 12. 예약 (올릴 시간 알림)
  function icsFor(s, p) {
    var d = function (ms) { return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); };
    var body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ReelMate//KO", "BEGIN:VEVENT", "UID:" + s.id + "@reelmate", "DTSTAMP:" + d(Date.now()),
      "DTSTART:" + d(s.at), "DTEND:" + d(s.at + 15 * 60000), "SUMMARY:[ReelMate] 릴스 올리기 - " + (p ? p.title : ""),
      "DESCRIPTION:ReelMate를 열고 홈의 '올릴 시간이에요'를 누르세요." + (s.memo ? "\\n메모: " + s.memo : ""),
      "URL:" + location.origin + location.pathname.replace(/[^/]*$/, "") + "publish.html?id=" + s.projectId,
      "BEGIN:VALARM", "TRIGGER:-PT0M", "ACTION:DISPLAY", "DESCRIPTION:릴스 올릴 시간이에요", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    var file = new File([body], "ReelMate_reminder.ics", { type: "text/calendar" });
    if (isAndroid && navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file] }).catch(function () {});
    var a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  }
  P.schedule = function () {
    Promise.all([getSchedules(), St.allProjects()]).then(function (r) {
      var sch = r[0], all = r[1], byId = {}; all.forEach(function (p) { byId[p.id] = p; });
      sch = sch.filter(function (s) { return byId[s.projectId]; });
      var month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
      mount({ top: { title: "예약", right: '<button class="pill-btn grad" data-add>+ 새 예약</button>' }, nav: "schedule" },
        '<div class="card row" style="margin-bottom:14px">' + ic("info") + '<div class="grow tiny" style="color:var(--sub)">SNS 앱은 다른 앱이 대신 예약 게시를 할 수 없어요. 그래서 ReelMate가 <b style="color:#fff">올릴 시간을 휴대폰 캘린더 알림</b>으로 알려 드려요. 알림이 오면 ReelMate 홈에서 바로 올리면 돼요.</div></div>' +
        '<div class="card" id="cal"></div><div class="sec"><h3>다가오는 예약</h3></div><div id="up"></div><div class="sec"><h3>지난 예약</h3></div><div id="past"></div>');
      function save() { return St.set("schedules", sch); }
      function drawCal() {
        var y = month.getFullYear(), m = month.getMonth(), first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), today = new Date();
        var marks = {}; sch.forEach(function (s) { var d = new Date(s.at); if (d.getFullYear() === y && d.getMonth() === m) marks[d.getDate()] = 1; });
        var cells = ""; for (var i = 0; i < first; i++) cells += "<div></div>";
        for (var dd = 1; dd <= days; dd++) {
          var isT = today.getFullYear() === y && today.getMonth() === m && today.getDate() === dd;
          cells += '<div style="text-align:center;padding:6px 0;font-size:13px;font-weight:' + (isT ? 900 : 500) + ";" + (isT ? "color:#FF7AA6" : "") + '">' + dd + (marks[dd] ? '<div style="width:6px;height:6px;border-radius:50%;background:var(--pink);margin:2px auto 0"></div>' : '<div style="height:8px"></div>') + "</div>";
        }
        $("#cal").innerHTML = '<div class="row" style="margin-bottom:8px"><button class="icon-btn" data-pm aria-label="이전 달">' + ic("chevron_left") + '</button><b class="grow" style="text-align:center">' + y + "년 " + (m + 1) + '월</b><button class="icon-btn" data-nm aria-label="다음 달">' + ic("chevron_right") + "</button></div>" +
          '<div style="display:grid;grid-template-columns:repeat(7,1fr);font-size:11px;color:var(--mute);text-align:center;margin-bottom:4px">' + "일월화수목금토".split("").map(function (d) { return "<div>" + d + "</div>"; }).join("") + "</div>" +
          '<div style="display:grid;grid-template-columns:repeat(7,1fr)">' + cells + "</div>";
        $("[data-pm]").onclick = function () { month.setMonth(month.getMonth() - 1); drawCal(); };
        $("[data-nm]").onclick = function () { month.setMonth(month.getMonth() + 1); drawCal(); };
      }
      function rowHtml(s) {
        var p = byId[s.projectId];
        return '<div class="card"><div class="row"><div class="thumb" style="width:50px;flex:none;border-radius:8px"><img src="' + p.thumb + '" alt=""></div><div class="grow"><b>' + fmtDate(s.at, true) + '</b><div class="tiny">' + esc(p.title) + (s.memo ? " · " + esc(s.memo) : "") + "</div></div>" +
          (s.done ? '<span class="chip on">올림</span>' : s.at <= Date.now() ? '<span class="chip warn">시간 됨</span>' : '<span class="chip">대기</span>') + "</div>" +
          '<div class="btns" style="margin-top:10px">' + (s.done ? "" : '<button class="btn small" data-pub="' + s.id + '">지금 올리기</button><button class="btn ghost small" data-ics="' + s.id + '">캘린더에 넣기</button>') +
          '<button class="btn ghost small" data-del="' + s.id + '" style="flex:.45" aria-label="예약 지우기">' + ic("delete") + "</button></div></div>";
      }
      function draw() {
        sch.sort(function (a, b) { return a.at - b.at; });
        var now = Date.now(), up = sch.filter(function (s) { return !s.done && s.at > now - 864e5; }), past = sch.filter(function (s) { return s.done || s.at <= now - 864e5; }).reverse();
        $("#up").innerHTML = up.length ? up.map(rowHtml).join("") : '<div class="card empty" style="padding:22px">' + ic("event_available") + "<div>예약이 없어요. 오른쪽 위 <b>+ 새 예약</b>을 눌러 보세요.</div></div>";
        $("#past").innerHTML = past.length ? past.map(rowHtml).join("") : '<p class="tiny">지난 예약이 없어요.</p>';
        drawCal();
        $$("[data-pub]").forEach(function (b) {
          b.onclick = function () { var s = sch.filter(function (x) { return x.id === b.dataset.pub; })[0]; s.done = true; save().then(function () { go("publish", { id: s.projectId }); }); };
        });
        $$("[data-ics]").forEach(function (b) { b.onclick = function () { var s = sch.filter(function (x) { return x.id === b.dataset.ics; })[0]; icsFor(s, byId[s.projectId]); }; });
        $$("[data-del]").forEach(function (b) {
          b.onclick = function () { confirmBox("예약을 지울까요?", "릴스는 보관함에 그대로 남아요. 캘린더에 넣은 알림은 캘린더 앱에서 지워 주세요.", "지우기", true).then(function (ok) { if (ok) { sch = sch.filter(function (x) { return x.id !== b.dataset.del; }); save().then(draw); } }); };
        });
      }
      function addSheet(preId) {
        if (!all.length) return toast("먼저 릴스를 만들어 주세요");
        var sel = preId && byId[preId] ? preId : all[0].id;
        var t = new Date(Date.now() + 3600e3); t.setMinutes(0, 0, 0);
        var pad = function (n) { return (n < 10 ? "0" : "") + n; };
        var d = sheet('<h3>새 예약</h3><label class="lbl">어떤 릴스를 올릴까요?</label><div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px">' +
          all.map(function (p) { return '<button class="thumb" data-pk="' + p.id + '" style="width:72px;flex:none;border:2px solid ' + (p.id === sel ? "var(--pink)" : "transparent") + '"><img src="' + p.thumb + '" alt=""><div class="cap" style="font-size:9px">' + esc(p.title) + "</div></button>"; }).join("") + "</div>" +
          '<div class="btns" style="margin-top:10px"><div><label class="lbl">날짜</label><input class="field" type="date" id="dt" value="' + t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate()) + '"></div>' +
          '<div><label class="lbl">시간</label><input class="field" type="time" id="tm" value="' + pad(t.getHours()) + ':00"></div></div>' +
          '<label class="lbl" style="margin-top:10px">메모 (선택)</label><input class="field" id="memo" placeholder="예) 인스타 저녁 피크 시간">' +
          '<button class="btn" data-ok style="margin-top:16px">예약하고 캘린더에 넣기</button><button class="pill-btn" data-only style="display:block;margin:10px auto 0;background:none;border:0;color:var(--sub)">캘린더 없이 예약만</button>');
        $$("[data-pk]", d).forEach(function (b) { b.onclick = function () { sel = b.dataset.pk; $$("[data-pk]", d).forEach(function (x) { x.style.borderColor = x === b ? "var(--pink)" : "transparent"; }); }; });
        function add(withCal) {
          var at = new Date($("#dt", d).value + "T" + $("#tm", d).value).getTime();
          if (!isFinite(at)) return toast("날짜와 시간을 넣어 주세요");
          if (at < Date.now() - 60000) return toast("지난 시간은 예약할 수 없어요");
          var s = { id: "s" + Date.now(), projectId: sel, at: at, memo: $("#memo", d).value.trim(), done: false };
          sch.push(s); save().then(function () { d.close(); draw(); toast("예약했어요"); if (withCal) icsFor(s, byId[sel]); });
        }
        $("[data-ok]", d).onclick = function () { add(true); };
        $("[data-only]", d).onclick = function () { add(false); };
      }
      $("[data-add]").onclick = function () { addSheet(); };
      draw();
      if (qs("new")) { var nid = qs("new"); history.replaceState(null, "", location.pathname); addSheet(nid); }
    });
  };

  // 13. 내 정보
  P.mypage = function () {
    Promise.all([getUser(), St.allProjects(), getSchedules(), St.get("accessCode"), getChannels(), getPrefs(),
      navigator.storage && navigator.storage.estimate ? navigator.storage.estimate().catch(function () { return {}; }) : Promise.resolve({})]).then(function (r) {
      var u = r[0] || { provider: "guest", name: "게스트" }, list = r[1], sch = r[2], code = r[3], ch = r[4], prefs = r[5], est = r[6] || {};
      var used = est.usage ? (est.usage / 1048576 >= 1024 ? (est.usage / 1073741824).toFixed(1) + "GB" : Math.max(1, Math.round(est.usage / 1048576)) + "MB") : "-";
      var label = { google: "Google 계정", kakao: "카카오 계정", guest: "로그인 안 함" }[u.provider] || "";
      mount({ top: { title: "내 정보" }, nav: "mypage" },
        '<div class="card row" style="padding:18px">' + avatarHtml(u).replace('class="avatar"', 'class="avatar" style="width:58px;height:58px;font-size:22px"') +
        '<div class="grow"><b style="font-size:18px">' + esc(u.name) + '</b><div class="tiny">' + esc(u.email || label) + '</div></div><button class="pill-btn" data-acct>' + (u.provider === "guest" ? "로그인" : "계정 바꾸기") + "</button></div>" +
        '<div class="grid3" style="margin-top:10px">' + [[list.length, "만든 릴스"], [sch.filter(function (s) { return !s.done; }).length, "예약"], [used, "사용 공간"]].map(function (s) {
          return '<div class="card" style="text-align:center;padding:12px 6px"><b style="font-size:20px">' + s[0] + '</b><div class="tiny">' + s[1] + "</div></div>";
        }).join("") + "</div>" +
        '<div class="sec"><h3>제작 설정</h3></div><div class="list">' +
        '<button class="item" data-a="code">' + ic("key") + '<span class="grow">AI 접속 코드</span><span class="val">' + (code ? "입력됨 ✓" : "필요해요") + "</span>" + ic("chevron_right") + "</button>" +
        '<button class="item" data-a="apps">' + ic("send") + '<span class="grow">올릴 SNS 앱</span><span class="val">' + esc(ch.map(function (k) { return APPS[k].name; }).join(", ") || "없음") + "</span>" + ic("chevron_right") + "</button>" +
        '<button class="item" data-a="mood">' + ic("palette") + '<span class="grow">기본 분위기</span><span class="val">' + esc(prefs.mood) + "</span>" + ic("chevron_right") + "</button>" +
        '<button class="item" data-a="style">' + ic("subtitles") + '<span class="grow">기본 자막 스타일</span><span class="val">' + esc(R.STYLES[prefs.style] || R.STYLES.basic) + "</span>" + ic("chevron_right") + "</button></div>" +
        '<div class="sec"><h3>앱 정보</h3></div><div class="list">' +
        '<a class="item" href="../privacy.html">' + ic("shield") + '<span class="grow">개인정보처리방침·이용약관</span>' + ic("chevron_right") + "</a>" +
        (C.CONTACT_EMAIL ? '<a class="item" href="mailto:' + esc(C.CONTACT_EMAIL) + "?subject=" + encodeURIComponent("[ReelMate] 문의") + '">' + ic("mail") + '<span class="grow">문의·피드백 보내기</span>' + ic("chevron_right") + "</a>" : "") +
        '<button class="item" data-a="update">' + ic("system_update") + '<span class="grow">최신 버전으로 새로고침</span><span class="val">' + VERSION + "</span></button>" +
        '<button class="item" data-a="wipe" style="color:var(--red)">' + ic("delete_forever") + '<span class="grow">이 휴대폰의 모든 데이터 지우기</span></button>' +
        (u.provider !== "guest" ? '<button class="item" data-a="logout">' + ic("logout") + '<span class="grow">로그아웃</span></button>' : "") + "</div>");
      $("[data-acct]").onclick = function () { go("login"); };
      function codeSheet() {
        var d = sheet('<h3>AI 접속 코드</h3><p class="muted" style="margin:0 0 12px">앱을 공유해 준 사람에게 받은 코드를 넣으면 Claude AI가 사진을 보고 보정·자막을 만들어요.</p>' +
          '<input class="field" id="cd" type="password" autocomplete="off" placeholder="접속 코드"><label class="row tiny" style="margin:8px 0 14px;gap:6px"><input type="checkbox" id="showc"> 코드 보기</label>' +
          '<div class="btns">' + (code ? '<button class="btn ghost small" data-clear>지우기</button>' : "") + '<button class="btn small" data-save>저장</button></div>');
        var f = $("#cd", d); if (code) f.value = code;
        $("#showc", d).onchange = function () { f.type = this.checked ? "text" : "password"; };
        $("[data-save]", d).onclick = function () { var v = f.value.trim(); if (!v) return toast("코드를 넣어 주세요"); St.set("accessCode", v).then(function () { d.close(); toast("접속 코드를 저장했어요"); P.mypage(); }); };
        var c = $("[data-clear]", d); if (c) c.onclick = function () { St.set("accessCode", "").then(function () { d.close(); toast("접속 코드를 지웠어요"); P.mypage(); }); };
      }
      $$("[data-a]").forEach(function (b) {
        b.onclick = function () {
          var a = b.dataset.a;
          if (a === "code") codeSheet();
          if (a === "apps") go("connect", { from: "mypage" });
          if (a === "mood") {
            var d = sheet('<h3>기본 분위기</h3><div class="grid2">' + MOOD_INFO.map(function (m) { return '<button class="opt' + (m[0] === prefs.mood ? " on" : "") + '" data-m="' + m[0] + '"><span class="ck">' + ic("check") + '</span><span class="em">' + m[1] + "</span><b>" + m[0] + "</b></button>"; }).join("") + "</div>");
            $$("[data-m]", d).forEach(function (x) { x.onclick = function () { setPrefs({ mood: x.dataset.m }).then(function () { return St.set("draftMood", x.dataset.m); }).then(function () { d.close(); toast("기본 분위기를 바꿨어요"); P.mypage(); }); }; });
          }
          if (a === "style") {
            var d2 = sheet('<h3>기본 자막 스타일</h3><div class="grid2">' + Object.keys(R.STYLES).map(function (k) { return styleSample(k, k === prefs.style); }).join("") + "</div>");
            $$("[data-style]", d2).forEach(function (x) { x.onclick = function () { setPrefs({ style: x.dataset.style }).then(function () { return St.set("draftOpts", null); }).then(function () { d2.close(); toast("기본 자막 스타일을 바꿨어요"); P.mypage(); }); }; });
          }
          if (a === "update") {
            toast("최신 버전을 받는 중...");
            var reg = navigator.serviceWorker && navigator.serviceWorker.getRegistration ? navigator.serviceWorker.getRegistration().then(function (rg) { return rg && rg.update(); }) : Promise.resolve();
            reg.catch(function () {}).then(function () { return window.caches ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }) : null; })
              .then(function () { location.reload(); });
          }
          if (a === "wipe") confirmBox("모든 데이터를 지울까요?", "만든 릴스 " + list.length + "개, 예약, 로그인, 접속 코드가 이 휴대폰에서 모두 지워지고 되돌릴 수 없어요.", "모두 지우기", true).then(function (ok) {
            if (!ok) return;
            Promise.all(["user", "accessCode", "channels", "prefs", "schedules", "draftItems", "draftPhotos", "draftMood", "draftRequest", "draftOpts", "job", "currentId", "remake"].map(function (k) { return St.set(k, null); }))
              .then(function () { return Promise.all(list.map(function (p) { return St.deleteProject(p.id); })); })
              .then(function () { toast("모두 지웠어요"); setTimeout(function () { go("onboarding"); }, 600); });
          });
          if (a === "logout") confirmBox("로그아웃할까요?", "만든 릴스는 이 휴대폰에 그대로 남아요.", "로그아웃").then(function (ok) { if (ok) St.set("user", null).then(function () { go("onboarding"); }); });
        };
      });
      if (qs("code") === "open") { history.replaceState(null, "", location.pathname); codeSheet(); }
    });
  };

  if (P[S]) P[S]();
  else go("onboarding");
})();
