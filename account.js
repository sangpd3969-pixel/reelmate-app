// ReelMate 계정: Google·카카오 로그인, SNS 앱 선택(설치된 앱으로 공유), 내 정보, 올리기
(function () {
  var S = window.SCREEN, R = window.Reel, St = R.Store, C = window.REELMATE_CONFIG || {};
  var go = function (to) { location.href = to + ".html"; };
  var isAndroid = /Android/i.test(navigator.userAgent);
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var REDIRECT = location.origin + location.pathname.replace(/[^/]*$/, "") + "login.html";
  function textOf(el) { return (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim(); }
  function toast(msg, ms) {
    var d = document.createElement("div"); d.textContent = msg;
    d.style.cssText = "position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:10001;background:rgba(24,24,32,.96);color:#fff;padding:12px 18px;border-radius:18px;font:600 14px sans-serif;border:1px solid #2E2E3E;max-width:86%;text-align:center;line-height:1.5";
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, ms || 2800);
  }
  function esc(s) { return String(s || "").replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // ---------- SNS 앱 ----------
  var APPS = {
    instagram: { name: "Instagram", desc: "릴스 · 스토리", host: "www.instagram.com", pkg: "com.instagram.android", ios: "instagram://app",
      icon: '<div style="width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)"><span class="material-symbols-outlined" style="color:#fff;font-size:24px;font-variation-settings:\'FILL\' 1">photo_camera</span></div>' },
    youtube: { name: "YouTube", desc: "쇼츠", host: "www.youtube.com", pkg: "com.google.android.youtube", ios: "youtube://",
      icon: '<div style="width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:#FF0000"><span class="material-symbols-outlined" style="color:#fff;font-size:28px;font-variation-settings:\'FILL\' 1">play_arrow</span></div>' },
    facebook: { name: "Facebook", desc: "릴스 · 스토리", host: "www.facebook.com", pkg: "com.facebook.katana", ios: "fb://",
      icon: '<div style="width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:#1877F2"><span style="color:#fff;font:900 28px sans-serif">f</span></div>' }
  };
  function openApp(key) {
    var a = APPS[key], web = "https://" + a.host + "/";
    if (isAndroid) {
      location.href = "intent://" + a.host + "/#Intent;scheme=https;package=" + a.pkg + ";S.browser_fallback_url=" + encodeURIComponent(web) + ";end";
    } else if (isIOS) {
      var t = setTimeout(function () { if (!document.hidden) toast(a.name + " 앱이 안 열리면 앱이 설치돼 있는지 확인해 주세요"); }, 1800);
      document.addEventListener("visibilitychange", function () { if (document.hidden) clearTimeout(t); }, { once: true });
      location.href = a.ios;
    } else {
      window.open(web, "_blank");
    }
  }
  function getChannels() { return St.get("channels").then(function (c) { return c || ["instagram", "youtube"]; }); }

  // ---------- 로그인 ----------
  function startGoogle() {
    if (!C.GOOGLE_CLIENT_ID) return toast("Google 로그인은 아직 준비 중이에요");
    location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
      client_id: C.GOOGLE_CLIENT_ID, redirect_uri: REDIRECT, response_type: "token",
      scope: "openid email profile", state: "google", prompt: "select_account"
    });
  }
  function startKakao() {
    if (!C.KAKAO_REST_KEY) return toast("카카오 로그인은 아직 준비 중이에요");
    location.href = "https://kauth.kakao.com/oauth/authorize?" + new URLSearchParams({
      client_id: C.KAKAO_REST_KEY, redirect_uri: REDIRECT, response_type: "code", state: "kakao"
    });
  }
  function saveUser(u) { return St.set("user", u).then(function () { toast((u.name || "회원") + "님, 반가워요!"); setTimeout(function () { go("connect"); }, 900); }); }
  function fail(msg) { history.replaceState(null, "", location.pathname); toast(msg, 4000); }
  function finishLogin() {
    var h = new URLSearchParams(location.hash.slice(1)), q = new URLSearchParams(location.search);
    if (h.get("state") === "google") {
      if (!h.get("access_token")) return fail("Google 로그인을 취소했어요"), true;
      fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: "Bearer " + h.get("access_token") } })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (u) { history.replaceState(null, "", location.pathname); return saveUser({ provider: "google", name: u.name, email: u.email, photo: u.picture }); })
        .catch(function () { fail("Google 로그인에 실패했어요. 다시 눌러 주세요"); });
      return true;
    }
    if (q.get("state") === "kakao") {
      if (!q.get("code")) return fail("카카오 로그인을 취소했어요"), true;
      fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: new URLSearchParams({ grant_type: "authorization_code", client_id: C.KAKAO_REST_KEY, redirect_uri: REDIRECT, code: q.get("code") })
      }).then(function (r) { return r.json(); }).then(function (t) {
        if (!t.access_token) throw 0;
        return fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: "Bearer " + t.access_token } }).then(function (r) { return r.json(); });
      }).then(function (u) {
        var p = (u.kakao_account && u.kakao_account.profile) || u.properties || {};
        history.replaceState(null, "", location.pathname);
        return saveUser({ provider: "kakao", name: p.nickname || "카카오 회원", photo: p.profile_image_url || p.profile_image || "" });
      }).catch(function () { fail("카카오 로그인에 실패했어요. 다시 눌러 주세요"); });
      return true;
    }
    return false;
  }

  if (S === "login") {
    document.querySelectorAll("button").forEach(function (b) { if (/Apple/.test(textOf(b))) b.style.display = "none"; });
    document.querySelectorAll("a").forEach(function (a) {
      if (/이메일/.test(textOf(a))) { a.querySelector("span").textContent = "로그인 없이 시작하기"; a.setAttribute("href", "#"); a.dataset.rm = "guest"; }
    });
    var ver = document.createElement("div"); ver.textContent = "ReelMate v9";
    ver.style.cssText = "text-align:center;color:#555;font:11px sans-serif;padding:6px"; document.body.appendChild(ver);
    if (finishLogin()) toast("로그인 확인 중...", 2000);
    else St.get("user").then(function (u) {
      if (!u || u.provider === "guest") return;
      var bar = document.createElement("div");
      bar.style.cssText = "position:fixed;left:12px;right:12px;top:12px;z-index:10000;background:#181820;border:1px solid #FF3D7F;border-radius:16px;padding:12px 14px;color:#fff;font:14px sans-serif;display:flex;align-items:center;gap:10px";
      bar.innerHTML = (u.photo ? '<img src="' + esc(u.photo) + '" referrerpolicy="no-referrer" style="width:32px;height:32px;border-radius:50%">' : "") +
        '<div style="flex:1"><b>' + esc(u.name) + '</b>님으로 로그인돼 있어요<div style="color:#A2A2BA;font-size:12px">' + (u.provider === "kakao" ? "카카오" : "Google") + ' 계정 · 다른 계정은 아래 버튼으로</div></div>' +
        '<button id="rm-go" style="padding:8px 14px;border-radius:999px;border:0;color:#fff;font-weight:700;background:linear-gradient(135deg,#FF3D7F,#FF8A3D)">계속</button>';
      document.body.appendChild(bar);
      bar.querySelector("#rm-go").onclick = function (e) { e.stopPropagation(); go("home"); };
    });
  }

  window.addEventListener("click", function (e) {
    var el = e.target.closest("button, a, [role=button]"); if (!el) return;
    var t = textOf(el), stop = function () { e.preventDefault(); e.stopImmediatePropagation(); };
    if (S === "login") {
      if (/카카오/.test(t)) { stop(); startKakao(); }
      else if (/Google/.test(t)) { stop(); startGoogle(); }
      else if (el.dataset.rm === "guest") { stop(); St.set("user", { provider: "guest", name: "게스트" }).then(function () { go("connect"); }); }
    }
    if (S === "mypage" && /로그아웃/.test(t)) { stop(); St.set("user", null).then(function () { go("onboarding"); }); }
    if (S === "publish" && /지금 올리기/.test(t)) { stop(); publishNow(); }
  }, true);

  // ---------- 계정 연동 화면 ----------
  function renderConnect() {
    var main = document.querySelector("main"); if (!main) return;
    var footer = main.querySelector("footer");
    Array.prototype.slice.call(main.children).forEach(function (c) { if (c !== footer) c.remove(); });
    var box = document.createElement("div");
    box.style.cssText = "flex:1;color:#fff;font-family:inherit";
    main.insertBefore(box, footer);
    getChannels().then(function (sel) {
      var html = '<div style="margin:4px 0 20px"><h2 style="font:800 24px sans-serif;margin:0 0 8px">올릴 SNS 앱을 고르세요</h2>' +
        '<p style="color:#A2A2BA;font-size:14px;line-height:1.6;margin:0">휴대폰에 깔린 앱에 <b style="color:#fff">이미 로그인된 내 계정</b>으로 올라가요. ' +
        '릴스를 다 만들면 고른 앱으로 영상이 바로 넘어가고, 자막·해시태그는 자동 복사돼서 붙여넣기만 하면 돼요.</p></div>';
      Object.keys(APPS).forEach(function (k) {
        var a = APPS[k], on = sel.indexOf(k) !== -1;
        html += '<article style="background:#181820;border:1px solid ' + (on ? "#FF3D7F" : "#2A2A38") + ';border-radius:18px;padding:16px;margin-bottom:12px">' +
          '<div style="display:flex;align-items:center;gap:14px">' + a.icon +
          '<div style="flex:1"><div style="font:800 17px sans-serif">' + a.name + '</div><div style="color:#A2A2BA;font-size:13px;margin-top:2px">' + a.desc + '</div></div>' +
          '<span style="padding:4px 10px;border-radius:999px;font:700 12px sans-serif;' + (on ? "background:rgba(16,185,129,.15);color:#34d399;border:1px solid rgba(16,185,129,.35)" : "background:#22222c;color:#8a8aa0;border:1px solid #2E2E3E") + '">' + (on ? "사용 중" : "사용 안 함") + '</span></div>' +
          '<div style="display:flex;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid #2A2A38">' +
          '<button data-rm-open="' + k + '" style="flex:1;padding:10px;border-radius:999px;border:1px solid #2E2E3E;background:#0F0F15;color:#fff;font:700 14px sans-serif">앱 열어보기</button>' +
          '<button data-rm-toggle="' + k + '" style="flex:1;padding:10px;border-radius:999px;border:0;color:#fff;font:700 14px sans-serif;' + (on ? "background:#2A2A38" : "background:linear-gradient(135deg,#FF3D7F,#FF8A3D)") + '">' + (on ? "빼기" : "사용하기") + '</button></div></article>';
      });
      html += '<p style="color:#8a8aa0;font-size:12px;line-height:1.6;margin:8px 4px 0">ReelMate는 SNS 비밀번호나 계정 정보를 받지 않아요. 게시는 각 앱에서 직접 [공유/게시]를 눌러 마무리해요.</p>';
      box.innerHTML = html;
      box.querySelectorAll("[data-rm-open]").forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); openApp(b.dataset.rmOpen); }; });
      box.querySelectorAll("[data-rm-toggle]").forEach(function (b) {
        b.onclick = function (e) {
          e.stopPropagation(); var k = b.dataset.rmToggle, i = sel.indexOf(k);
          if (i === -1) sel.push(k); else sel.splice(i, 1);
          St.set("channels", sel).then(renderConnect);
        };
      });
    });
  }
  if (S === "connect") renderConnect();

  // ---------- 내 정보 ----------
  if (S === "mypage") Promise.all([St.get("user"), getChannels(), St.allProjects()]).then(function (r) {
    var u = r[0] || { name: "게스트", provider: "guest" }, ch = r[1], n = (r[2] || []).length;
    var label = { google: "Google 계정", kakao: "카카오 계정", guest: "로그인 안 함" }[u.provider] || "";
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), nd, rep = [];
    while ((nd = walker.nextNode())) rep.push(nd);
    rep.forEach(function (x) {
      var v = x.nodeValue;
      if (/이지민/.test(v)) x.nodeValue = v.replace(/이지민( 크리에이터)?/, u.name || "회원");
      else if (/jimin\.creator/.test(v)) x.nodeValue = u.email || label;
    });
    document.querySelectorAll("img").forEach(function (im) {
      if (u.photo && im.width >= 48 && im.getBoundingClientRect().top < 360) { im.src = u.photo; im.referrerPolicy = "no-referrer"; }
    });
    var s = document.createElement("div");
    s.style.cssText = "margin:12px 16px;padding:14px;border-radius:16px;background:#181820;border:1px solid #2E2E3E;color:#fff;font:14px sans-serif;display:flex;justify-content:space-between;align-items:center";
    s.innerHTML = '<div><div style="font-weight:700">📲 올릴 앱: ' + (ch.map(function (k) { return APPS[k].name; }).join(", ") || "없음") + '</div>' +
      '<div style="color:#A2A2BA;font-size:12px;margin-top:4px">' + esc(label) + ' · 만든 릴스 ' + n + '개</div></div>' +
      '<button id="rm-ch" style="padding:8px 14px;border-radius:999px;border:0;color:#fff;font-weight:700;background:linear-gradient(135deg,#FF3D7F,#FF8A3D)">바꾸기</button>';
    var main = document.querySelector("main") || document.body; main.insertBefore(s, main.firstChild);
    s.querySelector("#rm-ch").onclick = function (e) { e.stopPropagation(); go("connect"); };
  });

  // ---------- 올리기: 자막 복사 + 휴대폰 공유창으로 앱에 넘기기 ----------
  function copyText(txt) {
    var ta = document.createElement("textarea"); ta.value = txt; ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0"; document.body.appendChild(ta);
    ta.focus(); ta.select(); ta.setSelectionRange(0, txt.length);
    var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove(); if (!ok && navigator.clipboard) navigator.clipboard.writeText(txt).catch(function () {});
  }
  var current = null;
  function captionOf(p) {
    var tags = (p.hashtags || []).map(function (h) { return h.charAt(0) === "#" ? h : "#" + h; }).join(" ");
    return [p.title, tags].filter(Boolean).join("\n\n");
  }
  function publishNow() {
    if (!current) { toast("먼저 릴스를 만들어 주세요"); return; }
    var ta = document.getElementById("rm-caption");
    copyText(ta && ta.value.trim() ? ta.value : captionOf(current));
    toast("자막·해시태그를 복사했어요. 공유 창에서 올릴 앱을 고른 뒤 붙여넣기 하세요", 4500);
    var done = function () { setTimeout(function () { go("done"); }, 600); };
    R.exportVideo(current).then(done, done);
  }
  if (S === "publish") {
    var id = new URLSearchParams(location.search).get("id");
    (id ? Promise.resolve(id) : St.get("currentId")).then(function (i) { return i && St.getProject(i); }).then(function (p) {
      current = p || null; if (!p) return;
      var cap = captionOf(p);
      var ti = document.querySelector('input[type="text"]'); if (ti) ti.value = p.title || "";
      var ta = document.querySelector("textarea"); if (ta) { ta.value = cap; ta.id = "rm-caption"; }
      document.querySelectorAll("button").forEach(function (b) {
        if (/^#\S+ \(\+\)$/.test(textOf(b))) b.style.display = "none";
      });
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), nd, list = [];
      while ((nd = walker.nextNode())) list.push(nd);
      list.forEach(function (x) {
        var v = x.nodeValue;
        if (/GPT-4o/.test(v)) x.nodeValue = "Claude가 작성";
        else if (/@creator_studio\.kr|크리에이터 지민/.test(v)) x.nodeValue = "휴대폰 앱의 내 계정";
        else if (/추천 연관 해시태그|터치하여 추가/.test(v)) x.nodeValue = "";
      });
      getChannels().then(function (ch) {
        var tip = document.createElement("div");
        tip.style.cssText = "margin:12px 16px;padding:14px;border-radius:16px;background:#181820;border:1px solid #FF3D7F;color:#fff;font:14px/1.6 sans-serif";
        tip.innerHTML = '<b>🚀 지금 올리기를 누르면</b><br>① 자막·해시태그가 복사되고<br>② 공유 창이 떠요 → <b>' + esc(ch.map(function (k) { return APPS[k].name; }).join(" / ") || "올릴 앱") + '</b> 선택<br>③ 앱에서 음악을 붙이고, 글 칸에 길게 눌러 붙여넣기 → 게시';
        var main = document.querySelector("main") || document.body; main.insertBefore(tip, main.firstChild);
      });
    });
  }
})();
