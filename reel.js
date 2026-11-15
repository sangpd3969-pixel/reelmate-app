// ReelMate 휴대폰 저장소 + 휴대폰 안에서 릴스 영상 만들기 (서버 사용 안 함)
(function (W) {
  // ---------- 1. 휴대폰 저장소 (IndexedDB) ----------
  var DB_NAME = "reelmate", DB_VER = 1, dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
        if (!d.objectStoreNames.contains("projects")) d.createObjectStore("projects", { keyPath: "id" });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), s = t.objectStore(store), out = fn(s);
        t.oncomplete = function () { res(out instanceof IDBRequest ? out.result : undefined); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  var Store = {
    get: function (k) { return tx("kv", "readonly", function (s) { return s.get(k); }); },
    set: function (k, v) { return tx("kv", "readwrite", function (s) { s.put(v, k); }); },
    saveProject: function (p) { return tx("projects", "readwrite", function (s) { s.put(p); }); },
    getProject: function (id) { return tx("projects", "readonly", function (s) { return s.get(id); }); },
    allProjects: function () {
      return tx("projects", "readonly", function (s) { return s.getAll(); })
        .then(function (a) { return (a || []).sort(function (x, y) { return y.createdAt - x.createdAt; }); });
    },
    deleteProject: function (id) { return tx("projects", "readwrite", function (s) { s.delete(id); }); }
  };
  // 휴대폰이 저장공간을 정리할 때 지우지 않도록 '영구 보관' 요청
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  // ---------- 2. 분위기별 기본 자막 ----------
  var MOODS = {
    "AI에게 맡기기": ["오늘의 순간", "놓치고 싶지 않은 장면", "함께라서 더 좋았던", "또 만나요!"],
    "감성": ["조용히 스며든 순간", "빛이 머물던 자리", "오래 기억하고 싶은 오늘", "천천히, 그리고 따뜻하게"],
    "신나게": ["오늘 텐션 최고!", "이 분위기 실화?", "멈출 수 없는 하루", "다음에 또 가자!"],
    "공연·이벤트": ["무대의 시작", "박수가 쏟아진 순간", "모두가 하나 된 밤", "앙코르!"],
    "여행·브이로그": ["떠나는 설렘", "여기가 바로 그곳", "걷기만 해도 좋은 길", "여행의 끝, 기억의 시작"],
    "맛집·카페": ["오늘의 맛집 발견", "비주얼부터 합격", "한 입에 반한 맛", "저장 필수!"]
  };
  function captionsFor(mood, n) {
    var base = MOODS[mood] || MOODS["AI에게 맡기기"], out = [];
    for (var i = 0; i < n; i++) out.push(i === n - 1 ? base[base.length - 1] : base[Math.min(i, base.length - 2)]);
    return out;
  }

  // ---------- 3. 휴대폰 안에서 영상 만들기 (캔버스 + MediaRecorder) ----------
  var W_ = 720, H_ = 1280, FPS = 30, SLIDE = 3.0, FADE = 0.5;
  function pickMime() {
    var c = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    for (var i = 0; i < c.length; i++) if (W.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c[i])) return c[i];
    return "";
  }
  function loadImg(src) {
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = src; });
  }
  function wrap(ctx, text, maxW) {
    var words = text.split(" "), lines = [], cur = "";
    words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }
  function drawFrame(ctx, imgs, caps, title, t) {
    var step = SLIDE - FADE;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W_, H_);
    for (var i = 0; i < imgs.length; i++) {
      var st = i * step, lt = t - st;
      if (lt < 0 || lt > SLIDE) continue;
      var a = Math.min(1, lt / FADE, (SLIDE - lt) / FADE);
      if (i === 0) a = Math.min(1, (SLIDE - lt) / FADE);
      if (i === imgs.length - 1 && lt >= FADE) a = Math.min(1, lt / FADE);
      ctx.globalAlpha = Math.max(0, a);
      var im = imgs[i];
      // 흐린 배경 (가로 사진도 세로 화면을 꽉 채우도록)
      var sc = Math.max(W_ / im.width, H_ / im.height) * 1.15;
      try { ctx.filter = "blur(24px) brightness(0.55)"; } catch (e) {}
      ctx.drawImage(im, (W_ - im.width * sc) / 2, (H_ - im.height * sc) / 2, im.width * sc, im.height * sc);
      try { ctx.filter = "none"; } catch (e) {}
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(0, 0, W_, H_);
      // 실제 사진 (천천히 확대/축소)
      var z = i % 2 === 0 ? 1 + 0.12 * (lt / SLIDE) : 1.12 - 0.12 * (lt / SLIDE);
      var fs = Math.min(W_ / im.width, H_ / im.height) * z;
      ctx.drawImage(im, (W_ - im.width * fs) / 2, (H_ - im.height * fs) / 2, im.width * fs, im.height * fs);
      // 자막
      var cap = caps[i] || "";
      if (cap) {
        var p = Math.min(1, Math.max(0, (lt - 0.25) / 0.4));
        ctx.globalAlpha = Math.max(0, a) * p;
        ctx.font = "800 46px 'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 16;
        ctx.fillStyle = "#fff";
        var lines = wrap(ctx, cap, W_ - 100), y0 = H_ - 300 + (1 - p) * 30;
        lines.forEach(function (l, k) { ctx.fillText(l, W_ / 2, y0 + k * 60); });
        ctx.shadowBlur = 0;
      }
    }
    // 첫 2초 제목
    if (title && t < 2.2) {
      ctx.globalAlpha = Math.min(1, t / 0.3, (2.2 - t) / 0.3);
      ctx.font = "900 56px 'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
      ctx.textAlign = "center"; ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 20; ctx.fillStyle = "#fff";
      wrap(ctx, title, W_ - 100).forEach(function (l, k) { ctx.fillText(l, W_ / 2, 200 + k * 70); });
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }
  function render(photos, caps, title, onProgress) {
    var mime = pickMime();
    if (!mime) return Promise.reject(new Error("이 휴대폰 브라우저는 영상 만들기를 지원하지 않아요."));
    return Promise.all(photos.map(loadImg)).then(function (imgs) {
      var c = document.createElement("canvas"); c.width = W_; c.height = H_;
      var ctx = c.getContext("2d");
      var total = imgs.length * (SLIDE - FADE) + FADE;
      var stream = c.captureStream(FPS);
      var rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 });
      var chunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      return new Promise(function (res) {
        rec.onstop = function () { res({ blob: new Blob(chunks, { type: mime.split(";")[0] }), mime: mime, duration: total }); };
        drawFrame(ctx, imgs, caps, title, 0);
        rec.start(250);
        var t0 = performance.now();
        (function loop() {
          var t = (performance.now() - t0) / 1000;
          drawFrame(ctx, imgs, caps, title, Math.min(t, total));
          if (onProgress) onProgress(Math.min(1, t / total));
          if (t < total) requestAnimationFrame(loop); else setTimeout(function () { rec.stop(); }, 150);
        })();
      });
    });
  }
  function thumbOf(dataUrl) {
    return loadImg(dataUrl).then(function (im) {
      var c = document.createElement("canvas"); c.width = 270; c.height = 480;
      var x = c.getContext("2d"), s = Math.max(270 / im.width, 480 / im.height);
      x.drawImage(im, (270 - im.width * s) / 2, (480 - im.height * s) / 2, im.width * s, im.height * s);
      return c.toDataURL("image/jpeg", 0.7);
    });
  }

  // ---------- 4. 휴대폰 사진첩/파일로 내보내기 ----------
  function exportVideo(p) {
    var ext = (p.mime || "").indexOf("mp4") !== -1 ? "mp4" : "webm";
    var name = "ReelMate_" + new Date(p.createdAt).toISOString().slice(0, 10) + "." + ext;
    var file = new File([p.video], name, { type: p.video.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: p.title }).catch(function () {});
    }
    var a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    return Promise.resolve();
  }

  W.Reel = { Store: Store, MOODS: MOODS, captionsFor: captionsFor, render: render, thumbOf: thumbOf, exportVideo: exportVideo };
})(window);
