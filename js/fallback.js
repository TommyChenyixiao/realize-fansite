// 维护兜底页:数据加载失败(JSON 缺失/损坏/没起服务器)时整页替换为维护提示。
// URL 加 ?maintenance 可强制预览这个页面。
(function () {
  "use strict";

  function show(reason) {
    // 具体原因只进控制台,不亮给访客(排查时 F12 查看)
    console.error("[维护兜底]", reason);
    document.title = "RealizE ✨ 维护中";
    document.body.innerHTML =
      '<div class="fallback">' +
      '<img class="fallback-photo" src="assets/group-photo.jpg" alt="RealizE">' +
      '<h1>🛠 网站维护中</h1>' +
      "<p>数据暂时加载不出来，请稍后再来看看。</p>" +
      '<button class="fallback-retry" onclick="location.href=location.pathname">重试</button>' +
      "</div>";
  }

  window.addEventListener("unhandledrejection", (e) => show(e.reason));
})();
