/**
<<<<<<< HEAD
 * suite-jwt-gate.js v2 — JWT login gate + role bar + logout
 * Load after core.js and server-bridge.js on suite.html
 */
(function (global) {
  "use strict";
  if (global.__SUITE_JWT_GATE_V2__) return;
  global.__SUITE_JWT_GATE_V2__ = true;
=======
 * suite-jwt-gate.js v2.1 — JWT gate + role bar (top-right) + logout
 */
(function (global) {
  "use strict";
  if (global.__SUITE_JWT_GATE_V21__) return;
  global.__SUITE_JWT_GATE_V21__ = true;
>>>>>>> 11c8bba4e78e307c57b94b3c3a16ec91fe1d3509

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

  function ensureRoleBar(user) {
<<<<<<< HEAD
=======
    // hide bridge chip on suite to avoid duplicate
    var chip = document.getElementById("sfRoleChip");
    if (chip) chip.style.display = "none";

>>>>>>> 11c8bba4e78e307c57b94b3c3a16ec91fe1d3509
    var bar = document.getElementById("suiteJwtBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "suiteJwtBar";
<<<<<<< HEAD
      bar.setAttribute("style",
        "position:fixed;top:10px;left:10px;z-index:160;display:flex;gap:8px;align-items:center;" +
        "font:12px Tahoma,sans-serif;background:rgba(15,23,42,.92);color:#e2e8f0;" +
        "border:1px solid #334155;border-radius:10px;padding:6px 10px");
=======
      // top-right — away from clock (clock sits on the left in RTL topbar)
      bar.setAttribute("style",
        "position:fixed;top:12px;right:12px;left:auto;z-index:160;display:flex;gap:8px;align-items:center;" +
        "flex-direction:row-reverse;font:12px Tahoma,sans-serif;background:rgba(15,23,42,.94);color:#e2e8f0;" +
        "border:1px solid #334155;border-radius:10px;padding:6px 10px;max-width:min(320px,70vw);" +
        "box-shadow:0 4px 14px rgba(0,0,0,.35)");
>>>>>>> 11c8bba4e78e307c57b94b3c3a16ec91fe1d3509
      document.body.appendChild(bar);
    }
    var role = (user && user.role) || "?";
    var name = (user && (user.name || user.user)) || "";
    bar.innerHTML =
<<<<<<< HEAD
      "<span>نقش: <b style=\"color:#7dd3fc\">" + role + "</b>" +
      (name ? " · " + name : "") + "</span>" +
      "<button type=\"button\" id=\"suiteJwtLogout\" style=\"border:1px solid #475569;background:#1e293b;" +
      "color:#fecaca;border-radius:8px;padding:4px 10px;cursor:pointer;font:inherit;font-size:11px\">" +
      "خروج سرور</button>";
=======
      "<button type=\"button\" id=\"suiteJwtLogout\" style=\"border:1px solid #475569;background:#1e293b;" +
      "color:#fecaca;border-radius:8px;padding:4px 10px;cursor:pointer;font:inherit;font-size:11px;flex-shrink:0\">" +
      "خروج سرور</button>" +
      "<span style=\"text-align:right\">نقش: <b style=\"color:#7dd3fc\">" + role + "</b>" +
      (name ? " · " + name : "") + "</span>";
>>>>>>> 11c8bba4e78e307c57b94b3c3a16ec91fe1d3509
    var btn = document.getElementById("suiteJwtLogout");
    if (btn) {
      btn.onclick = function () {
        try {
          if (SmartCore.logout) SmartCore.logout();
<<<<<<< HEAD
          else if (SmartCore.api && SmartCore.api.fetch) {
            sessionStorage.removeItem("smart_suite_api_token");
            sessionStorage.removeItem("smart_suite_last_login");
            SmartCore.api.fetch("/api/auth/logout", { method: "POST" }).catch(function () {});
=======
          else {
            sessionStorage.removeItem("smart_suite_api_token");
            sessionStorage.removeItem("smart_suite_last_login");
            if (SmartCore.api && SmartCore.api.fetch) {
              SmartCore.api.fetch("/api/auth/logout", { method: "POST" }).catch(function () {});
            }
>>>>>>> 11c8bba4e78e307c57b94b3c3a16ec91fe1d3509
          }
        } catch (e) {}
        toast("خروج از سرور");
        setTimeout(function () { location.reload(); }, 300);
      };
    }
  }

  function showGate() {
    if (document.getElementById("suiteJwtGate")) return;
    var bar = document.getElementById("suiteJwtBar");
    if (bar) bar.remove();

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
          if (SmartCore.api.ensureSession) return SmartCore.api.ensureSession();
        })
        .then(function () { location.reload(); })
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
        var u = SmartCore.api.serverUser ? SmartCore.api.serverUser() : null;
        ensureRoleBar(u || { role: SmartCore.api.role && SmartCore.api.role() });
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
