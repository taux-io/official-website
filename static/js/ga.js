(function () {
  var h = location.hostname;
  if (h !== "taux.io" && h !== "www.taux.io") return;
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  gtag("js", new Date());
  gtag("config", "G-1FYJEFKT8G", {
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=G-1FYJEFKT8G";
  document.head.appendChild(s);
})();
