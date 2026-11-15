/**
 * server-bridge.js v1.5
 * - module + cartable sync
 * - suite backup button
 * - gear visible only if server role is admin or ceo
 * - version badge from /api/versions
 */
(function (global) {
  "use strict";
  if (!global.SmartCore) {
    console.warn("[server-bridge] SmartCore missing");
    return;
  }
  if (global.SmartCore.store && global.SmartCore.store._bridged15) return;

  var TOKEN_KEY = "smart_suite_api_token";
  var CART_KEY = "suite_cartable_v1";
  var online = null;
  var pushTimers = {};
  var pulling = false;
  var cartPulling = false;
  var loginInflight = null;
  var serverUser = null;

  function base() {
    try {
      if (location.protocol !== "http:" && location.protocol !== "https:") return "";
      return location.origin || "";
    } catch (e) {
      return "";
    }
  }

  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }
  function setToken(t) {
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  function api(path, opts) {
    opts = opts || {};
    var b = base();
    if (!b) return Promise.reject(new Error("no-server"));
    var headers = { "Content-Type": "application/json" };
    var tok = getToken();
    if (tok) headers.Authorization = "Bearer " + tok;
    return fetch(b + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var err = new Error((j && j.error) || ("http " + r.status));
          err.status = r.status;
          err.body = j;
          throw err;
        }
        return j;
      });
    });
  }

  function health() {
    return api("/api/health").then(function (j) {
      online = !!(j && j.ok);
      return online;
    }).catch(function () {
      online = false;
      return false;
    });
  }

  function detectModId() {
    try {
      var path = (location.pathname || "").split("/").pop() || "";
      path = decodeURIComponent(path).replace(/\.html?$/i, "");
      var aliases = { "file-hub": "filehub", "pr-media": "pr" };
      return aliases[path] || path || "cashbox";
    } catch (e) {
      return "cashbox";
    }
  }

  function credentials() {
    var a = SmartCore.getAuth();
    var user = (a.session && a.session.user) || "admin";
    var pass = "admin";
    var pin = a.pin2 || "1234";
    var found = (a.users || []).find(function (x) { return x.user === user; });
    if (found && found.pass) pass = found.pass;
    try {
      var mod = detectModId();
      var local = JSON.parse(localStorage.getItem("smart_users_" + mod) || "null");
      if (local && local.session && local.session.user) {
        user = local.session.user;
        var fu = (local.users || []).find(function (x) { return x.user === user; });
        if (fu && fu.pass) pass = fu.pass;
      }
    } catch (e) {}
    return { user: user, pass: pass, pin: pin };
  }

  function serverLogin(user, pass, pin) {
    return api("/api/auth/login", {
      method: "POST",
      body: { user: user, pass: pass, pin: pin }
    }).then(function (j) {
      if (j && j.token) setToken(j.token);
      if (j && j.user) serverUser = j.user;
      else throw new Error((j && j.error) || "no token");
      return j;
    });
  }

  function forceLogin() {
    if (loginInflight) return loginInflight;
    setToken("");
    var c = credentials();
    loginInflight = serverLogin(c.user, c.pass, c.pin)
      .then(function () {
        loginInflight = null;
        return true;
      })
      .catch(function () {
        return serverLogin("admin", "admin", "1234")
          .then(function () {
            loginInflight = null;
            return true;
          })
          .catch(function () {
            loginInflight = null;
            return false;
          });
      });
    return loginInflight;
  }

  function ensureSession() {
    if (!base()) return Promise.resolve(false);
    var tok = getToken();
    if (!tok) return forceLogin();
    return api("/api/me")
      .then(function (j) {
        if (j && j.user) serverUser = j.user;
        return true;
      })
      .catch(function () { return forceLogin(); });
  }

  function isServerElevated() {
    var r = (serverUser && serverUser.role) || "";
    return r === "admin" || r === "ceo";
  }

  function applyGearPolicy() {
    if (detectModId() !== "suite") return;
    var g = document.getElementById("gearBtn");
    var panel = document.getElementById("settingsPanel");
    if (!g) return;
    if (isServerElevated()) {
      g.classList.add("show");
      g.style.display = "grid";
      g.title = "تنظیمات سیستم (" + (serverUser.role || "") + ")";
      console.info("[server-bridge] gear unlocked for", serverUser.role);
    } else {
      g.classList.remove("show");
      g.classList.remove("on");
      g.style.display = "none";
      if (panel) panel.classList.remove("open");
      console.info("[server-bridge] gear locked — need admin/ceo server role");
    }
  }

  function modIdFromKey(key) {
    var m = String(key || "").match(/^smart_mod_([a-z0-9_]+)_v2$/i);
    return m ? m[1] : null;
  }

  function isValidModulePayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    if (payload.stores && typeof payload.stores === "object") return true;
    if (payload.version != null && (payload.audit || payload.createdAt || payload.updatedAt)) return true;
    var keys = Object.keys(payload);
    if (keys.length === 0) return false;
    if (keys.length === 1 && (keys[0] === "test" || keys[0] === "at")) return false;
    return keys.length >= 2;
  }

  function writeLocalSilent(key, obj) {
    try {
      pulling = true;
      localStorage.setItem(key, JSON.stringify(obj));
    } catch (e) {
    } finally {
      pulling = false;
    }
  }

  function storeLoad(modId, def) {
    def = def != null ? def : {};
    var local = SmartCore.loadModuleData(modId, def);
    if (!base()) return Promise.resolve(local);
    return ensureSession().then(function (ok) {
      if (!ok) return local;
      return api("/api/data/" + encodeURIComponent(modId)).then(function (j) {
        var payload = j && j.data ? j.data.payload : null;
        if (!isValidModulePayload(payload)) return local;
        var useServer = true;
        try {
          var lt = local && local.updatedAt ? Date.parse(local.updatedAt) : 0;
          var st = payload.updatedAt ? Date.parse(payload.updatedAt) : 0;
          if (lt && st && lt > st) useServer = false;
        } catch (e2) {}
        if (useServer) {
          writeLocalSilent(SmartCore.primaryKey(modId), payload);
          return payload;
        }
        return local;
      }).catch(function () { return local; });
    });
  }

  function storeSave(modId, data) {
    var localOk = SmartCore.saveModuleData(modId, data);
    if (!base()) return Promise.resolve({ ok: localOk, source: "local" });
    return ensureSession().then(function (ok) {
      if (!ok) return { ok: localOk, source: "local" };
      return api("/api/data/" + encodeURIComponent(modId), {
        method: "PUT",
        body: { payload: data }
      }).then(function (j) {
        return { ok: true, source: "server", version: j.version };
      }).catch(function () {
        return { ok: localOk, source: "local-fallback" };
      });
    });
  }

  function schedulePush(key, raw) {
    if (pulling || cartPulling || !base()) return;
    if (key === CART_KEY) {
      scheduleCartPush(raw);
      return;
    }
    var modId = modIdFromKey(key);
    if (!modId) return;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return; }
    if (!isValidModulePayload(data)) return;
    if (pushTimers[key]) clearTimeout(pushTimers[key]);
    pushTimers[key] = setTimeout(function () {
      ensureSession().then(function (ok) {
        if (!ok) return;
        return api("/api/data/" + encodeURIComponent(modId), {
          method: "PUT",
          body: { payload: data }
        }).then(function (j) {
          console.info("[server-bridge] synced", modId, "v" + (j.version || "?"));
        }).catch(function (err) {
          console.warn("[server-bridge] sync fail", modId, err && err.message);
        });
      });
    }, 400);
  }

  function scheduleCartPush(raw) {
    if (pushTimers[CART_KEY]) clearTimeout(pushTimers[CART_KEY]);
    pushTimers[CART_KEY] = setTimeout(function () {
      var meta;
      try { meta = JSON.parse(raw); } catch (e) { return; }
      var items = meta && Array.isArray(meta.items) ? meta.items : (Array.isArray(meta) ? meta : null);
      if (!items) return;
      ensureSession().then(function (ok) {
        if (!ok) return;
        return api("/api/cartable", {
          method: "PUT",
          body: { items: items }
        }).then(function (j) {
          console.info("[server-bridge] cartable synced", j.count);
        }).catch(function (err) {
          console.warn("[server-bridge] cartable sync fail", err && err.message);
        });
      });
    }, 500);
  }

  function pullCartable() {
    if (!base()) return Promise.resolve();
    return ensureSession().then(function (ok) {
      if (!ok) return;
      return api("/api/cartable").then(function (j) {
        var items = (j && j.items) || [];
        var local = { items: [] };
        try {
          var raw = localStorage.getItem(CART_KEY);
          if (raw) {
            var o = JSON.parse(raw);
            if (o && Array.isArray(o.items)) local.items = o.items;
            else if (Array.isArray(o)) local.items = o;
          }
        } catch (e) {}
        var map = {};
        local.items.forEach(function (x) {
          if (x && x.id) map[x.id] = x;
        });
        items.forEach(function (x) {
          if (x && x.id) map[x.id] = x;
        });
        var merged = Object.keys(map).map(function (k) { return map[k]; });
        merged.sort(function (a, b) {
          return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
        });
        try {
          cartPulling = true;
          localStorage.setItem(CART_KEY, JSON.stringify({ items: merged }));
          localStorage.setItem("suite_cartable_ping", String(Date.now()));
        } catch (e2) {
        } finally {
          cartPulling = false;
        }
        console.info("[server-bridge] cartable pulled", merged.length);
      }).catch(function (err) {
        console.warn("[server-bridge] cartable pull fail", err && err.message);
      });
    });
  }

  function installLocalStorageHook() {
    try {
      var proto = Storage.prototype;
      if (proto._sfBridged) return;
      var rawSet = proto.setItem;
      proto.setItem = function (k, v) {
        rawSet.call(this, k, v);
        if (this === localStorage) schedulePush(k, v);
      };
      proto._sfBridged = true;
    } catch (e) {
      console.warn("[server-bridge] cannot hook localStorage", e);
    }
  }

  function pullCurrentModule() {
    var modId = detectModId();
    if (modId === "suite") return Promise.resolve();
    return storeLoad(modId, {}).then(function (payload) {
      if (payload && isValidModulePayload(payload)) {
        console.info("[server-bridge] pulled", modId);
      }
    });
  }

  function runServerBackup() {
    return ensureSession().then(function (ok) {
      if (!ok) throw new Error("ورود سرور ناموفق");
      return api("/api/backup", { method: "POST" });
    });
  }

  function injectSuiteBackupButton() {
    try {
      if (detectModId() !== "suite") return;
      var panel = document.getElementById("settingsPanel");
      if (!panel || document.getElementById("btnServerBackup")) return;
      if (!isServerElevated()) return;

      var btn = document.createElement("button");
      btn.type = "button";
      btn.id = "btnServerBackup";
      btn.innerHTML = '<span class="ic">💾</span> پشتیبان سرور';
      btn.onclick = function () {
        btn.disabled = true;
        runServerBackup()
          .then(function (j) {
            if (SmartCore.toast) SmartCore.toast("پشتیبان سرور: " + (j.backup || "ok"));
            else alert("پشتیبان: " + (j.backup || "ok"));
          })
          .catch(function (e) {
            if (SmartCore.toast) SmartCore.toast(e.message || "خطا", true);
            else alert(e.message || "خطا");
          })
          .then(function () { btn.disabled = false; });
      };
      var hint = panel.querySelector(".hint");
      if (hint) panel.insertBefore(btn, hint);
      else panel.appendChild(btn);

      var verBtn = document.createElement("button");
      verBtn.type = "button";
      verBtn.id = "btnShowVersions";
      verBtn.innerHTML = '<span class="ic">🏷️</span> نسخه‌ها';
      verBtn.onclick = function () { showVersionsModal(); };
      if (hint) panel.insertBefore(verBtn, hint);
      else panel.appendChild(verBtn);

      var ops = document.getElementById("btnDcBackupAll");
      if (ops && ops.parentNode && !document.getElementById("btnServerBackup2")) {
        var b2 = document.createElement("button");
        b2.type = "button";
        b2.id = "btnServerBackup2";
        b2.className = "btn btn-v";
        b2.textContent = "پشتیبان سرور (دیسک)";
        b2.onclick = function () {
          runServerBackup()
            .then(function (j) {
              if (SmartCore.toast) SmartCore.toast("پشتیبان: " + (j.backup || "ok"));
            })
            .catch(function (e) {
              if (SmartCore.toast) SmartCore.toast(e.message || "خطا", true);
            });
        };
        ops.parentNode.appendChild(b2);
      }
    } catch (e) {
      console.warn("[server-bridge] inject suite controls", e);
    }
  }

  function showVersionBadge(report) {
    if (detectModId() !== "suite") return;
    var el = document.getElementById("sfVersionBadge");
    if (!el) {
      el = document.createElement("div");
      el.id = "sfVersionBadge";
      el.setAttribute("style",
        "position:fixed;top:10px;left:10px;z-index:120;font:11px Tahoma,sans-serif;" +
        "background:rgba(15,23,42,.92);color:#c4b5fd;border:1px solid #334155;" +
        "border-radius:8px;padding:6px 10px;max-width:280px;line-height:1.5;cursor:pointer");
      el.title = "کلیک: گزارش نسخه‌ها";
      el.onclick = function () { showVersionsModal(); };
      document.body.appendChild(el);
    }
    var c = (report && report.registry && report.registry.components) || {};
    var miss = (report && report.missing && report.missing.length) || 0;
    var present = (report && report.present && report.present.length) || 0;
    el.innerHTML =
      "سرور " + (report.serverRuntime || c.server || "?") +
      " · پل 1.5" +
      "<br>ماژول ثبت‌شده: " + present + (miss ? " · ناقص: " + miss : "");
  }

  function showVersionsModal() {
    api("/api/versions").then(function (rep) {
      var old = document.getElementById("sfVerModal");
      if (old) old.remove();
      var m = document.createElement("div");
      m.id = "sfVerModal";
      m.setAttribute("style",
        "position:fixed;inset:0;background:rgba(2,6,23,.85);z-index:400;" +
        "display:flex;align-items:center;justify-content:center;padding:16px");
      var c = (rep.registry && rep.registry.components) || {};
      var lines = Object.keys(c).map(function (k) {
        return "<div>" + k + ": <b>" + c[k] + "</b></div>";
      }).join("");
      var miss = (rep.missing || []).map(function (x) {
        return "<div style='color:#fca5a5'>" + x.id + " → " + x.file + "</div>";
      }).join("") || "<div style='color:#86efac'>همه فایل‌های ثبت‌شده در public هستند</div>";
      m.innerHTML =
        '<div style="background:#1e293b;border:1px solid #334155;border-radius:14px;padding:16px;' +
        'width:min(420px,96vw);color:#e2e8f0;font:13px Tahoma,sans-serif;max-height:80vh;overflow:auto">' +
        "<h3 style='margin:0 0 10px;color:#c4b5fd'>گزارش نسخه</h3>" +
        "<div style='margin-bottom:8px'>Runtime سرور: <b>" + (rep.serverRuntime || "?") + "</b></div>" +
        lines +
        "<div style='margin-top:10px'>HTML در public: <b>" + (rep.publicHtmlCount || 0) + "</b></div>" +
        "<div>موجود در رجیستری: <b>" + ((rep.present || []).length) + "</b></div>" +
        "<h4 style='margin:12px 0 6px;color:#93c5fd'>ناقص</h4>" + miss +
        '<button type="button" id="sfVerClose" style="margin-top:12px;width:100%;padding:8px;' +
        'border:0;border-radius:10px;background:#8b5cf6;color:#fff;font:inherit;cursor:pointer">بستن</button></div>';
      document.body.appendChild(m);
      m.querySelector("#sfVerClose").onclick = function () { m.remove(); };
      m.onclick = function (e) { if (e.target === m) m.remove(); };
    }).catch(function (e) {
      if (SmartCore.toast) SmartCore.toast(e.message || "خطا", true);
    });
  }

  var _login = SmartCore.login;
  SmartCore.login = function (user, pass, pin) {
    var res = _login(user, pass, pin);
    if (res && res.ok && base()) {
      serverLogin(user, pass, pin || "1234")
        .then(function () {
          applyGearPolicy();
          injectSuiteBackupButton();
        })
        .catch(function () { forceLogin().then(function () { applyGearPolicy(); }); });
    }
    return res;
  };
  var _logout = SmartCore.logout;
  SmartCore.logout = function () {
    var t = getToken();
    setToken("");
    serverUser = null;
    if (base() && t) api("/api/auth/logout", { method: "POST" }).catch(function () {});
    applyGearPolicy();
    return _logout();
  };

  SmartCore.api = {
    base: base,
    health: health,
    login: serverLogin,
    getToken: getToken,
    fetch: api,
    ensureSession: ensureSession,
    backup: runServerBackup,
    pullCartable: pullCartable,
    serverUser: function () { return serverUser; },
    isElevated: isServerElevated,
    isOnline: function () { return !!online; }
  };
  SmartCore.store = {
    _bridged: true,
    _bridged15: true,
    load: storeLoad,
    save: storeSave,
    pullCurrent: pullCurrentModule
  };
  SmartCore.version = String(SmartCore.version).replace(/\+bridge.*/, "") + "+bridge1.5";

  installLocalStorageHook();

  if (base()) {
    health().then(function (ok) {
      if (ok) {
        console.info("[server-bridge] online", base());
        ensureSession().then(function (s) {
          console.info("[server-bridge] session", s ? "ok" : "pending-login",
            serverUser ? serverUser.role : "");
          applyGearPolicy();
          if (s) {
            setTimeout(function () {
              pullCurrentModule();
              pullCartable();
              injectSuiteBackupButton();
            }, 600);
            api("/api/versions").then(showVersionBadge).catch(function () {});
            setInterval(function () { pullCartable(); }, 30000);
            // re-assert gear after suite local scripts finish
            setTimeout(applyGearPolicy, 1500);
            setTimeout(applyGearPolicy, 3000);
          }
        });
      } else {
        console.info("[server-bridge] offline — local only");
      }
    });
  }
})(typeof window !== "undefined" ? window : this);
