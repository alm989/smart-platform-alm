/**
 * suite-jwt-gate.js — ورود یکپارچه JWT روی لانچر سوئیت
 * بعد از core.js و server-bridge.js لود شود.
 */
(function (global) {
  "use strict";
  if (global.__SUITE_JWT_GATE__) return;
  global.__SUITE_JWT_GATE__ = true;

  function isSuite() {
    try {
      var p = (location.pathname || "").split("/").pop() || "";
      return /^suite\.html?$/i.test(p) || p === "" || p === "/";
    } catch (e) {
      return false;
    }
  }

  function toast(msg, err) {
    if (global.SmartCore && SmartCore.toast) return SmartCore.toast(msg, !!err);
    try { console.log(msg); } catch (e) {}
  }

  function removeGate() {
    var el = document.getElementById("suiteJwtGate");
    if (el) el.remove();
  }

  function showGate() {
    if (document.getElementById("suiteJwtGate")) return;
    var m = document.createElement("div");
    m.id = "suiteJwtGate";
    m.setAttribute("style",
      "position:fixed;inset:0;background:rgba(2,6,23,.96);z-index:400;" +
      "display:flex;align-items:center;justify-content:center;font-family:Tahoma,sans-serif");
    m.innerHTML =
      '<div style="background:#1e293b;border:1px solid #334155;border-radius:14px;' +
      'padding:18px;width:min(340px,92vw);color:#e2e8f0">' +
      '<h2 style="text-align:center;color:#c4b5fd;margin:0 0 10px;font-size:1rem">ورود سرور (JWT)</h2>' +
      '<p style="font-size:12px;color:#94a3b8;margin:0 0 10px;line-height:1.5;text-align:center">' +
      'برای نمایش ماژول‌های مجاز وارد شوید</p>' +
      '<label style="display:block;font-size:12px;color:#94a3b8;margin:6px 0 2px">کاربری</label>' +
      '<input id="jwtU" autocomplete="username" style="width:100%;padding:8px;border-radius:10px;' +
      'border:1px solid #334155;background:#0f172a;color:#e2e8f0;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;color:#94a3b8;margin:6px 0 2px">رمز</label>' +
      '<input id="jwtP" type="password" autocomplete="current-password" style="width:100%;padding:8px;' +
      'border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;color:#94a3b8;margin:6px 0 2px">پین دوم</label>' +
      '<input id="jwtPin" type="password" maxlength="8" inputmode="numeric" style="width:100%;padding:8px;' +
      'border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;box-sizing:border-box">' +
      '<button type="button" id="jwtGo" style="width:100%;margin-top:12px;padding:10px;border:0;' +
      'border-radius:10px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;' +
      'font-weight:700;cursor:pointer;font-family:inherit">ورود</button>' +
      '<p id="jwtErr" style="color:#fca5a5;font-size:12px;min-height:18px;margin:8px 0 0;text-align:center"></p>' +
      "</div>";
    document.body.appendChild(m);

    function doLogin() {
      var u = (document.getElementById("jwtU").value || "").trim();
      var p = document.getElementById("jwtP").value || "";
      var pin = (document.getElementById("jwtPin").value || "").trim();
      var err = document.getElementById("jwtErr");
      err.textContent = "";
      if (!u || !p || !pin) {
        err.textContent = "همه فیلدها لازم است";
        return;
      }
      if (!global.SmartCore || !SmartCore.api || !SmartCore.api.login) {
        err.textContent = "bridge آماده نیست — Ctrl+F5";
        return;
      }
      document.getElementById("jwtGo").disabled = true;
      SmartCore.api.login(u, p, pin)
        .then(function (j) {
          toast("ورود موفق: " + ((j.user && j.user.role) || u));
          removeGate();
          if (SmartCore.api.ensureSession) {
            return SmartCore.api.ensureSession();
          }
        })
        .then(function () {
          location.reload();
        })
        .catch(function (e) {
          err.textContent = (e && e.message) || "ورود ناموفق";
          document.getElementById("jwtGo").disabled = false;
        });
    }

    document.getElementById("jwtGo").onclick = doLogin;
    m.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") doLogin();
    });
  }

  function boot() {
    if (!isSuite()) return;
    if (!global.SmartCore || !SmartCore.api) {
      setTimeout(boot, 200);
      return;
    }
    SmartCore.api.ensureSession().then(function (ok) {
      if (ok) {
        removeGate();
        console.info("[suite-jwt-gate] session ok");
      } else {
        showGate();
        console.info("[suite-jwt-gate] login required");
      }
    }).catch(function () {
      showGate();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 300); });
  } else {
    setTimeout(boot, 300);
  }
})(typeof window !== "undefined" ? window : this);
