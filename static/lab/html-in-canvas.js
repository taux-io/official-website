// HTML-in-Canvas experiment. Not linked from any page, not in the sitemap.
// Without the API (or with reduced motion) the card stays where the HTML put it.
(function () {
  var status = document.getElementById("status");
  var stage = document.getElementById("stage");
  var card = document.getElementById("card");

  function say(text) { status.textContent = text; }

  var supported =
    typeof CanvasRenderingContext2D !== "undefined" &&
    "drawElementImage" in CanvasRenderingContext2D.prototype;
  if (!supported) return say("這個瀏覽器不支援 HTML-in-Canvas，顯示普通版面。");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return say("偵測到「減少動態」，顯示普通版面。");
  }

  var canvas = document.createElement("canvas");
  // The attribute was `layoutsubtree` until Chrome 155, then `content="drawable"`.
  canvas.setAttribute("layoutsubtree", "");
  canvas.setAttribute("content", "drawable");
  var ctx = canvas.getContext("2d");
  var tiltX = 0, tiltY = 0, active = true;

  function fallback(why) {
    active = false;
    if (canvas.parentNode) { stage.appendChild(card); canvas.remove(); }
    say("特效啟動失敗（" + why + "），顯示普通版面。");
  }

  function size() {
    var w = stage.clientWidth;
    var h = card.offsetHeight;
    var dpr = window.devicePixelRatio || 1;
    canvas.style.height = h + 24 + "px";
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round((h + 24) * dpr);
    return { w: w, h: h, dpr: dpr };
  }

  function draw() {
    if (!active) return;
    try {
      var s = size();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Tilt = skew toward the pointer, around the card centre.
      ctx.translate(s.w / 2, s.h / 2 + 12);
      ctx.transform(1, tiltY * 0.04, tiltX * 0.04, 1, 0, 0);
      ctx.translate(-s.w / 2, -s.h / 2 - 12);
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      ctx.drawElementImage(card, 0, 12);
    } catch (e) {
      fallback(e && e.name ? e.name : "error");
    }
  }

  function repaint() {
    if (typeof canvas.requestPaint === "function") canvas.requestPaint();
    else requestAnimationFrame(draw);
  }

  try {
    stage.appendChild(canvas);
    canvas.appendChild(card); // the card is now canvas content: laid out, drawn by us
    canvas.addEventListener("paint", draw);
    stage.addEventListener("pointermove", function (e) {
      var r = stage.getBoundingClientRect();
      tiltX = ((e.clientX - r.left) / r.width - 0.5) * 2;
      tiltY = ((e.clientY - r.top) / r.height - 0.5) * 2;
      repaint();
    });
    stage.addEventListener("pointerleave", function () { tiltX = tiltY = 0; repaint(); });
    window.addEventListener("resize", repaint);
    say("HTML-in-Canvas 已啟用：滑鼠移到卡片上看看。");
    repaint();
  } catch (e) {
    fallback(e && e.name ? e.name : "error");
  }
})();
