/**
 * cartable-api.js — کارتابل API-اول
 * بعد از suite-facilities و server-bridge لود شود.
 * ارسال: POST /api/cartable
 * لیست: GET /api/cartable
 * وضعیت/حذف: PATCH /api/cartable/:id
 * کش محلی فقط برای نمایش آفلاین
 */
(function (global) {
  "use strict";
  if (global.__CARTABLE_API_V1) return;
  global.__CARTABLE_API_V1 = true;

  var CART_KEY = "suite_cartable_v1";
  var MAX_BYTES = 2.5 * 1024 * 1024;
  var wired = false;

  function hasApi() {
    return !!(global.SmartCore && SmartCore.api && typeof SmartCore.api.fetch === "function");
  }

  function toast(msg, err) {
    if (global.SmartCore && SmartCore.toast) return SmartCore.toast(msg, !!err);
    try { console.log(msg); } catch (e) {}
  }

  function detectMod() {
    try {
      var sc = document.querySelector('script[src*="suite-facilities"][data-module]');
      if (sc) return { id: sc.getAttribute("data-module"), title: sc.getAttribute("data-title") || sc.getAttribute("data-module") };
    } catch (e) {}
    try {
      var path = (location.pathname || "").split("/").pop() || "";
      path = decodeURIComponent(path).replace(/\.html?$/i, "");
      return { id: path || "cashbox", title: path || "cashbox" };
    } catch (e2) {
      return { id: "cashbox", title: "صندوق" };
    }
  }

  function currentUser() {
    try {
      if (SmartCore.api.serverUser && SmartCore.api.serverUser()) {
        return String(SmartCore.api.serverUser().user || "admin");
      }
    } catch (e) {}
    try {
      var a = SmartCore.getAuth();
      if (a && a.session && a.session.user) return String(a.session.user);
    } catch (e2) {}
    return "admin";
  }

  function currentUserName() {
    try {
      var u = SmartCore.api.serverUser && SmartCore.api.serverUser();
      if (u && u.name) return String(u.name);
    } catch (e) {}
    try {
      if (SmartCore.userName) return SmartCore.userName();
    } catch (e2) {}
    return currentUser();
  }

  function writeLocal(items) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify({ items: items || [] }));
      localStorage.setItem("suite_cartable_ping", String(Date.now()));
    } catch (e) {}
  }

  function pullAndRender() {
    if (!hasApi()) {
      if (global.SuiteFacilities && SuiteFacilities.renderCart) SuiteFacilities.renderCart();
      return Promise.resolve();
    }
    return SmartCore.api.ensureSession().then(function (ok) {
      if (!ok) {
        if (global.SuiteFacilities && SuiteFacilities.renderCart) SuiteFacilities.renderCart();
        return;
      }
      return SmartCore.api.fetch("/api/cartable").then(function (j) {
        var items = (j && j.items) || [];
        writeLocal(items);
        if (global.SuiteFacilities && SuiteFacilities.renderCart) SuiteFacilities.renderCart();
        console.info("[cartable-api] pulled", items.length);
      });
    }).catch(function (e) {
      console.warn("[cartable-api] pull", e && e.message);
      if (global.SuiteFacilities && SuiteFacilities.renderCart) SuiteFacilities.renderCart();
    });
  }

  function postItem(item) {
    return SmartCore.api.ensureSession().then(function (ok) {
      if (!ok) throw new Error("ورود سرور لازم است");
      return SmartCore.api.fetch("/api/cartable", { method: "POST", body: item });
    });
  }

  function patchItem(id, body) {
    return SmartCore.api.ensureSession().then(function (ok) {
      if (!ok) throw new Error("ورود سرور لازم است");
      return SmartCore.api.fetch("/api/cartable/" + encodeURIComponent(id), {
        method: "PATCH",
        body: body
      });
    });
  }

  function wire() {
    var host = document.getElementById("sfCartRoot");
    if (!host || !hasApi()) return false;

    var sendBtn = host.querySelector("#sfCartSend");
    var refreshBtn = host.querySelector("#sfCartRefresh");
    if (!sendBtn) return false;

    if (sendBtn.getAttribute("data-api-first") === "1") return true;
    sendBtn.setAttribute("data-api-first", "1");

    var mod = detectMod();

    sendBtn.onclick = function () {
      var to = (host.querySelector("#sfCartTo") || {}).value;
      var toUser = ((host.querySelector("#sfCartToUser") || {}).value) || "*";
      var subject = ((host.querySelector("#sfCartSubject") || {}).value || "").trim();
      var body = ((host.querySelector("#sfCartBody") || {}).value || "").trim();
      var date = ((host.querySelector("#sfCartDate") || {}).value || "").trim();
      var fileInput = host.querySelector("#sfCartFile");
      var file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      if (!subject && !file) return toast("عنوان یا فایل لازم است", true);

      function finish(dataUrl, fileName, fileSize) {
        var item = {
          id: "sf_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8),
          from: mod.id,
          fromTitle: mod.title,
          fromUser: currentUser(),
          fromUserName: currentUserName(),
          to: to,
          toTitle: to,
          toUser: toUser,
          toUserName: toUser === "*" ? "همه کاربران" : toUser,
          subject: subject || fileName || "بدون عنوان",
          body: body,
          date: date,
          status: "active",
          hasFile: !!dataUrl,
          fileName: fileName || "",
          fileSize: fileSize || 0,
          dataUrl: dataUrl || "",
          createdAt: new Date().toISOString(),
          deleted: false
        };
        sendBtn.disabled = true;
        postItem(item)
          .then(function (j) {
            var saved = (j && j.item) || item;
            toast("ارسال به سرور شد");
            var msg = host.querySelector("#sfCartMsg");
            if (msg) {
              msg.style.display = "block";
              msg.textContent = "API · " + (saved.id || "") + " → " + to + " / " + toUser;
            }
            if (host.querySelector("#sfCartSubject")) host.querySelector("#sfCartSubject").value = "";
            if (host.querySelector("#sfCartBody")) host.querySelector("#sfCartBody").value = "";
            if (fileInput) fileInput.value = "";
            return pullAndRender();
          })
          .catch(function (e) {
            toast(e.message || "خطا در ارسال سرور", true);
          })
          .then(function () {
            sendBtn.disabled = false;
          });
      }

      if (!file) return finish("", "", 0);
      if (file.size > MAX_BYTES) return toast("سقف حجم ۲٫۵MB", true);
      var fr = new FileReader();
      fr.onload = function () { finish(fr.result, file.name, file.size); };
      fr.onerror = function () { toast("خواندن فایل ناموفق", true); };
      fr.readAsDataURL(file);
    };

    if (refreshBtn) {
      refreshBtn.onclick = function () {
        pullAndRender().then(function () { toast("بروزرسانی از سرور"); });
      };
    }

    // status / delete via capture so we win over local handler
    host.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cact]");
      if (!b || !hasApi()) return;
      var act = b.getAttribute("data-cact");
      var id = b.getAttribute("data-id");
      if (!id || act === "dl") return;
      e.preventDefault();
      e.stopPropagation();
      var body = act === "del" ? { deleted: true } : { status: act };
      patchItem(id, body)
        .then(function () {
          toast(act === "del" ? "حذف روی سرور" : "وضعیت روی سرور");
          return pullAndRender();
        })
        .catch(function (err) {
          toast(err.message || "خطا", true);
        });
    }, true);

    // first pull
    pullAndRender();
    wired = true;
    console.info("[cartable-api] wired API-first for", mod.id);
    return true;
  }

  function tryWire() {
    if (wire()) return;
    var n = 0;
    var t = setInterval(function () {
      n++;
      if (wire() || n > 40) clearInterval(t);
    }, 400);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryWire);
  } else {
    tryWire();
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-panel='p-cartable']")) {
      setTimeout(function () {
        wire();
        pullAndRender();
      }, 50);
    }
  }, true);

  global.CartableAPI = { pull: pullAndRender, wire: wire };
})(typeof window !== "undefined" ? window : this);
