/**
 * facilities-autoload.js
 * بعد از core.js — suite-facilities را init می‌کند و cartable-api را لود می‌کند
 */
(function () {
  "use strict";

  function detectMod() {
    var path = (location.pathname || "").split("/").pop() || "";
    try { path = decodeURIComponent(path); } catch (e) {}
    path = path.replace(/\.html?$/i, "");
    var aliases = {
      "file-hub": "filehub",
      "pr-media": "pr",
      "change-engine": "change-engine",
      "control-center": "control-center"
    };
    var id = aliases[path] || path || "cashbox";
    var title = id;
    try {
      if (window.SmartCore && Array.isArray(SmartCore.MODULES)) {
        var m = SmartCore.MODULES.find(function (x) {
          return x.id === id || x.file === path + ".html" || x.file === id + ".html";
        });
        if (m) {
          id = m.id;
          title = m.title || m.id;
        }
      }
    } catch (e2) {}
    return { id: id, title: title };
  }

  function hasPanels() {
    return !!(document.getElementById("p-notes") || document.getElementById("p-rems") || document.getElementById("p-cartable"));
  }

  function loadCartableApi() {
    if (window.CartableAPI || document.querySelector('script[src*="cartable-api.js"]')) return;
    var s = document.createElement("script");
    s.src = "cartable-api.js";
    s.onload = function () { console.info("[facilities-autoload] cartable-api loaded"); };
    s.onerror = function () { console.warn("[facilities-autoload] cartable-api.js missing"); };
    (document.body || document.documentElement).appendChild(s);
  }

  function initNow() {
    if (!hasPanels()) return;
    if (!window.SuiteFacilities || typeof SuiteFacilities.init !== "function") return;
    if (!window.__sfFacilitiesInited) {
      window.__sfFacilitiesInited = true;
      var d = detectMod();
      try {
        SuiteFacilities.init({ moduleId: d.id, moduleTitle: d.title });
      } catch (e) {
        console.warn("[facilities-autoload] init error", e);
        window.__sfFacilitiesInited = false;
      }
    }
    loadCartableApi();
  }

  function loadScriptThenInit() {
    if (window.SuiteFacilities) {
      initNow();
      return;
    }
    if (document.querySelector('script[src*="suite-facilities.js"]')) {
      var tries = 0;
      var t = setInterval(function () {
        tries++;
        if (window.SuiteFacilities || tries > 40) {
          clearInterval(t);
          initNow();
        }
      }, 50);
      return;
    }
    var d = detectMod();
    var s = document.createElement("script");
    s.src = "suite-facilities.js";
    s.setAttribute("data-module", d.id);
    s.setAttribute("data-title", d.title);
    s.onload = function () { initNow(); };
    s.onerror = function () { console.warn("[facilities-autoload] suite-facilities.js load failed"); };
    (document.body || document.documentElement).appendChild(s);
  }

  function start() {
    if (!hasPanels()) return;
    loadScriptThenInit();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    setTimeout(start, 0);
  }
})();
