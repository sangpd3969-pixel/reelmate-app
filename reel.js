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
  // 사진 보정·구도는 edit.js(glfx.js + smartcrop.js)가 AI 보정값대로 먼저 처리한다.
  // 항목: 사진 = dataURL 문자열, 동영상 = { type:"video", blob, thumb, duration }
  var W_ = 720, H_ = 1280, FPS = 30, FADE = 0.5, CLIP_MAX = 8;
  var FONT = "'Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
  var STYLES = { basic: "기본 (흰 글씨)", box: "흰 박스", yellow: "노랑 강조", neon: "네온 핑크" };
  function pickMime() {
    var c = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    for (var i = 0; i < c.length; i++) if (W.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c[i])) return c[i];
    return "";
  }
  function loadImg(src) {
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = src; });
  }
  function wrap(ctx, text, maxW) {
    var words = String(text).split(" "), lines = [], cur = "";
    words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // 자막 그리기 (스타일 4가지)
  function drawText(ctx, text, cx, cy, size, style, lineH) {
    ctx.font = (style === "box" ? "800 " : "900 ") + size + "px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    var lines = wrap(ctx, text, W_ - 110), n = lines.length, y0 = cy - (n - 1) * lineH / 2;
    lines.forEach(function (l, i) {
      var y = y0 + i * lineH;
      ctx.shadowBlur = 0; ctx.lineJoin = "round";
      if (style === "box") {
        var w = ctx.measureText(l).width + 36;
        ctx.fillStyle = "rgba(255,255,255,0.94)"; roundRect(ctx, cx - w / 2, y - lineH / 2 + 4, w, lineH - 4, 14); ctx.fill();
        ctx.fillStyle = "#111";
      } else if (style === "yellow") {
        ctx.strokeStyle = "#000"; ctx.lineWidth = 10; ctx.strokeText(l, cx, y); ctx.fillStyle = "#FFE14D";
      } else if (style === "neon") {
        ctx.shadowColor = "#FF3D7F"; ctx.shadowBlur = 26; ctx.strokeStyle = "#FF3D7F"; ctx.lineWidth = 4; ctx.strokeText(l, cx, y); ctx.fillStyle = "#fff";
      } else {
        ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 16; ctx.fillStyle = "#fff";
      }
      ctx.fillText(l, cx, y);
    });
    ctx.shadowBlur = 0;
  }
  function cssFilter(e) {
    e = e || {};
    var b = 1 + (Number(e.brightness) || 0) * 0.25 + (Number(e.exposure) || 0) * 0.3, c = 1 + (Number(e.contrast) || 0) * 0.35,
      s = 1 + (Number(e.saturation) || 0) * 0.5 + (Number(e.vibrance) || 0) * 0.3;
    return "brightness(" + b.toFixed(2) + ") contrast(" + c.toFixed(2) + ") saturate(" + s.toFixed(2) + ")";
  }
  function drawCover(ctx, src, sw, sh, z) {
    var s = Math.max(W_ / sw, H_ / sh) * z;
    ctx.drawImage(src, (W_ - sw * s) / 2, (H_ - sh * s) / 2, sw * s, sh * s);
  }
  function drawFit(ctx, src, sw, sh, z) {
    var s = Math.min(W_ / sw, H_ / sh) * z;
    ctx.drawImage(src, (W_ - sw * s) / 2, (H_ - sh * s) / 2, sw * s, sh * s);
  }
  function drawFrame(ctx, slides, caps, title, t, vid) {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W_, H_);
    for (var i = 0; i < slides.length; i++) {
      var sl = slides[i], lt = t - sl.start, D = sl.dur;
      if (lt < 0 || lt > D) continue;
      var a = Math.min(1, lt / FADE, (D - lt) / FADE);
      if (i === 0) a = Math.min(1, (D - lt) / FADE);
      if (i === slides.length - 1 && lt >= FADE) a = Math.min(1, lt / FADE);
      ctx.globalAlpha = Math.max(0, a);
      var k = lt / D, z = sl.zoom === "none" ? 1 : sl.zoom === "out" ? 1.12 - 0.12 * k : 1 + 0.12 * k;
      if (sl.video) {
        var v = sl.video;
        if (!sl.playing) { sl.playing = true; try { v.currentTime = 0; } catch (e) {} v.play().catch(function () {}); }
        if (sl.mode === "fit" && sl.bg) ctx.drawImage(sl.bg, 0, 0, W_, H_);
        if (v.readyState >= 2 && v.videoWidth) {
          if (sl.filter && "filter" in ctx) ctx.filter = sl.filter;
          (sl.mode === "fit" ? drawFit : drawCover)(ctx, v, v.videoWidth, v.videoHeight, 1);
          if ("filter" in ctx) ctx.filter = "none";
        } else if (sl.bg) ctx.drawImage(sl.bg, 0, 0, W_, H_);
      } else if (sl.mode === "fill") {
        ctx.drawImage(sl.fg, (W_ - W_ * z) / 2, (H_ - H_ * z) / 2, W_ * z, H_ * z);
      } else {
        ctx.drawImage(sl.bg, 0, 0, W_, H_);
        drawFit(ctx, sl.fg, sl.fg.width, sl.fg.height, z);
      }
      var cap = caps[i] || "";
      if (cap) {
        var p = Math.min(1, Math.max(0, (lt - 0.25) / 0.4));
        ctx.globalAlpha = Math.max(0, a) * p;
        var baseY = vid.captionPosition === "top" ? 330 : vid.captionPosition === "middle" ? H_ / 2 : H_ - 300;
        drawText(ctx, cap, W_ / 2, baseY + (1 - p) * 30, 46, vid.style, 62);
      }
    }
    if (title && t < 2.2) {
      ctx.globalAlpha = Math.max(0, Math.min(1, t / 0.3, (2.2 - t) / 0.3));
      drawText(ctx, title, W_ / 2, 210, 56, vid.style === "box" ? "box" : vid.style === "basic" ? "basic" : vid.style, 74);
    }
    ctx.globalAlpha = 1;
  }
  function loadVideo(item) {
    return new Promise(function (res) {
      var v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("muted", ""); v.preload = "auto";
      v.style.cssText = "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0";
      document.body.appendChild(v);
      var done = false, fin = function () { if (!done) { done = true; res(v); } };
      v.oncanplay = fin; v.onloadeddata = fin; v.onerror = fin; setTimeout(fin, 4000);
      v.src = URL.createObjectURL(item.blob); v.load();
    });
  }
  function prepareItem(item, edit, slideSec) {
    edit = edit || {};
    if (item && item.type === "video") {
      return Promise.all([loadVideo(item), W.ReelEdit.bgOf(item.thumb).catch(function () { return null; })]).then(function (r) {
        var v = r[0], len = Math.min(CLIP_MAX, item.duration || v.duration || slideSec);
        if (!isFinite(len) || len <= 0) len = slideSec;
        return { video: v, bg: r[1], mode: edit.framing === "fit" ? "fit" : "fill", zoom: "none", dur: Math.max(1.5, len), filter: cssFilter(edit) };
      });
    }
    var src = typeof item === "string" ? item : item.src;
    return W.ReelEdit.prepare(src, edit).then(function (sl) { sl.dur = slideSec; return sl; });
  }
  // opts: { edits:[사진별 보정값], video:{ slideSeconds, captionPosition }, style:"basic|box|yellow|neon", showTitle:true }
  function render(items, caps, title, opts, onProgress) {
    opts = opts || {};
    var mime = pickMime();
    if (!mime) return Promise.reject(new Error("이 휴대폰 브라우저는 영상 만들기를 지원하지 않아요. 크롬이나 사파리 최신 버전에서 열어 주세요."));
    var v0 = opts.video || {};
    var vid = { slideSeconds: Math.max(1.5, Math.min(5, Number(v0.slideSeconds) || 3)), captionPosition: v0.captionPosition || "bottom",
      style: STYLES[opts.style] ? opts.style : "basic" };
    var edits = opts.edits || [];
    if (opts.showTitle === false) title = "";
    return Promise.all(items.map(function (it, i) { return prepareItem(it, edits[i], vid.slideSeconds); })).then(function (slides) {
      var t = 0;
      slides.forEach(function (sl, i) { sl.start = t; t += sl.dur - (i < slides.length - 1 ? FADE : 0); });
      var total = t;
      var c = document.createElement("canvas"); c.width = W_; c.height = H_;
      var ctx = c.getContext("2d");
      var stream = c.captureStream(FPS);
      var rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 });
      var chunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      var cleanup = function () { slides.forEach(function (sl) { if (sl.video) { try { sl.video.pause(); URL.revokeObjectURL(sl.video.src); } catch (e) {} sl.video.remove(); } }); };
      return new Promise(function (res) {
        rec.onstop = function () { cleanup(); res({ blob: new Blob(chunks, { type: mime.split(";")[0] }), mime: mime, duration: total }); };
        drawFrame(ctx, slides, caps, title, 0, vid);
        rec.start(250);
        var t0 = performance.now();
        (function loop() {
          var tt = (performance.now() - t0) / 1000;
          slides.forEach(function (sl) { if (sl.video && sl.playing && tt > sl.start + sl.dur) sl.video.pause(); });
          drawFrame(ctx, slides, caps, title, Math.min(tt, total), vid);
          if (onProgress) onProgress(Math.min(1, tt / total));
          if (tt < total) requestAnimationFrame(loop); else setTimeout(function () { rec.stop(); }, 150);
        })();
      });
    });
  }
  function thumbOf(item) {
    var dataUrl = typeof item === "string" ? item : item.thumb || item.src;
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

  W.Reel = { Store: Store, MOODS: MOODS, STYLES: STYLES, captionsFor: captionsFor, render: render, thumbOf: thumbOf, exportVideo: exportVideo };
})(window);
