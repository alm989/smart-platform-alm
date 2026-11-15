/**
 * server-bridge.js v1.4
 * - scrypt-compatible login via API
 * - module data auto-sync
 * - cartable: pull/push suite_cartable_v1 <-> /api/cartable
 * - suite.html: server backup button in settings panel
 */
(function (global) {
  "use strict";
  if (!global.SmartCore) {
    console.warn("[server-bridge] SmartCore missing");
    return;
  }
  if (global.SmartCore.store && global.SmartCore.store._bridged14) return;

  var TOKEN_KEY = "smart_suite_api_token";
  var CART_KEY = "suite_cartable_v1";
  var online = null;
  var pushTimers = {};
  var pulling = false;
  var cartPulling = false;
  var loginInflight = null;

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
      .then(function () { return true; })
      .catch(function () { return forceLogin(); });
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
        // merge by id — prefer server if both
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
      if (proto._sfBridged) {
        // re-bind schedule to include cart — already hooked once; OK
        return;
      }
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

      // also datacenter card if present
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
      console.info("[server-bridge] suite backup buttons ready");
    } catch (e) {
      console.warn("[server-bridge] inject backup btn", e);
    }
  }

  var _login = SmartCore.login;
  SmartCore.login = function (user, pass, pin) {
    var res = _login(user, pass, pin);
    if (res && res.ok && base()) {
      serverLogin(user, pass, pin || "1234").catch(function () { forceLogin(); });
    }
    return res;
  };
  var _logout = SmartCore.logout;
  SmartCore.logout = function () {
    var t = getToken();
    setToken("");
    if (base() && t) api("/api/auth/logout", { method: "POST" }).catch(function () {});
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
    isOnline: function () { return !!online; }
  };
  SmartCore.store = {
    _bridged: true,
    _bridged14: true,
    load: storeLoad,
    save: storeSave,
    pullCurrent: pullCurrentModule
  };
  SmartCore.version = String(SmartCore.version).replace(/\+bridge.*/, "") + "+bridge1.4";

  installLocalStorageHook();

  if (base()) {
    health().then(function (ok) {
      if (ok) {
        console.info("[server-bridge] online", base());
        ensureSession().then(function (s) {
          console.info("[server-bridge] session", s ? "ok" : "pending-login");
          if (s) {
            setTimeout(function () {
              pullCurrentModule();
              pullCartable();
            }, 600);
            setTimeout(injectSuiteBackupButton, 900);
            setInterval(function () { pullCartable(); }, 30000);
          }
        });
      } else {
        console.info("[server-bridge] offline — local only");
      }
    });
  }
})(typeof window !== "undefined" ? window : this);
