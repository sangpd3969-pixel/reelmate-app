// ReelMate 사진 보정·구도 모듈
// - 색감: glfx.js (WebGL, MIT)  - 구도(9:16 자르기): smartcrop.js (MIT)
// AI(Claude)가 준 보정값(edit)을 받아 휴대폰 안에서 보정한다. 값은 모두 -1~1 (vignette/sharpen은 0~1).
(function (W) {
  var OUT_W = 720, OUT_H = 1280, fxc = null;
  function clamp(v, a, b) { v = Number(v); if (!isFinite(v)) v = 0; return Math.max(a, Math.min(b, v)); }
  function getFx() {
    if (fxc) return fxc;
    try { fxc = W.fx.canvas(); } catch (e) { fxc = null; }
    return fxc;
  }
  function loadImg(src) {
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = src; });
  }
  function toCanvas(src, w, h) {
    var c = document.createElement("canvas"); c.width = w || src.width; c.height = h || src.height;
    c.getContext("2d").drawImage(src, 0, 0, c.width, c.height); return c;
  }

  // 1) 색감 보정
  function colorGrade(img, e) {
    var fx = getFx();
    if (!fx) return toCanvas(img);
    var b = clamp(e.brightness, -1, 1), c = clamp(e.contrast, -1, 1), s = clamp(e.saturation, -1, 1),
        v = clamp(e.vibrance, -1, 1), t = clamp(e.temperature, -1, 1), g = clamp(e.tint, -1, 1),
        x = clamp(e.exposure, -1, 1), vig = clamp(e.vignette, 0, 1), sh = clamp(e.sharpen, 0, 1);
    var tex = fx.texture(img);
    var chain = fx.draw(tex);
    if (x || t || g) {
      var mid = 0.5 + 0.12 * x;
      chain = chain.curves(
        [[0, 0], [0.5, clamp(mid + 0.06 * t, 0.05, 0.95)], [1, 1]],
        [[0, 0], [0.5, clamp(mid - 0.05 * g, 0.05, 0.95)], [1, 1]],
        [[0, 0], [0.5, clamp(mid - 0.06 * t, 0.05, 0.95)], [1, 1]]
      );
    }
    if (b || c) chain = chain.brightnessContrast(b * 0.25, c * 0.35);
    if (s) chain = chain.hueSaturation(0, s * 0.5);
    if (v) chain = chain.vibrance(v * 0.6);
    if (sh) chain = chain.unsharpMask(Math.max(2, img.width / 400), sh * 1.5);
    if (vig) chain = chain.vignette(0.5, vig * 0.7);
    chain.update();
    var out = toCanvas(fx, img.width, img.height);
    tex.destroy();
    return out;
  }

  // 2) 흐린 배경 (사파리에서도 되도록 WebGL로 흐림)
  function blurredBg(src) {
    var small = document.createElement("canvas"); small.width = 180; small.height = 320;
    var x = small.getContext("2d"), s = Math.max(180 / src.width, 320 / src.height);
    x.drawImage(src, (180 - src.width * s) / 2, (320 - src.height * s) / 2, src.width * s, src.height * s);
    var fx = getFx();
    if (!fx) { x.fillStyle = "rgba(0,0,0,0.45)"; x.fillRect(0, 0, 180, 320); return small; }
    var tex = fx.texture(small);
    fx.draw(tex).triangleBlur(14).brightnessContrast(-0.35, 0).update();
    var out = toCanvas(fx, 180, 320); tex.destroy(); return out;
  }

  // 3) 구도: 9:16으로 자르기 (AI가 준 중심점 우선, 없으면 smartcrop)
  function cropTo916(src, focus) {
    var ratio = 9 / 16, w, h;
    if (src.width / src.height > ratio) { h = src.height; w = Math.round(h * ratio); } else { w = src.width; h = Math.round(w / ratio); }
    var done = function (cx, cy) {
      var sx = clamp(cx * src.width - w / 2, 0, src.width - w), sy = clamp(cy * src.height - h / 2, 0, src.height - h);
      var c = document.createElement("canvas"); c.width = OUT_W; c.height = OUT_H;
      c.getContext("2d").drawImage(src, sx, sy, w, h, 0, 0, OUT_W, OUT_H); return c;
    };
    if (focus && isFinite(focus.x) && isFinite(focus.y)) return Promise.resolve(done(clamp(focus.x, 0, 1), clamp(focus.y, 0, 1)));
    if (!W.smartcrop) return Promise.resolve(done(0.5, 0.5));
    return W.smartcrop.crop(src, { width: 9, height: 16, minScale: 1 }).then(function (r) {
      var tc = r.topCrop; return done((tc.x + tc.width / 2) / src.width, (tc.y + tc.height / 2) / src.height);
    }).catch(function () { return done(0.5, 0.5); });
  }

  // 사진 1장 준비: {fg, bg, mode, zoom}
  function prepare(dataUrl, edit) {
    edit = edit || {};
    return loadImg(dataUrl).then(function (img) {
      var graded = colorGrade(img, edit);
      var zoom = edit.zoom === "out" || edit.zoom === "none" ? edit.zoom : "in";
      if (edit.framing === "fill") return cropTo916(graded, edit.focus).then(function (c) { return { fg: c, bg: null, mode: "fill", zoom: zoom }; });
      return { fg: graded, bg: blurredBg(graded), mode: "fit", zoom: zoom };
    });
  }
  // 동영상 배경용: 썸네일로 흐린 배경만 만든다
  function bgOf(dataUrl) { return loadImg(dataUrl).then(blurredBg); }
  W.ReelEdit = { prepare: prepare, bgOf: bgOf, webgl: function () { return !!getFx(); } };
})(window);
