/**
 * server-bridge.js v1.2 — SmartCore <-> Local Server
 * - Never overwrite local DB with empty/invalid server payload
 * - Auto-sync smart_mod_*_v2 on write
 * - Pull only when server payload looks like a real module DB
 */
(function (global) {
  "use strict";
  if (!global.SmartCore) {
    console.warn("[server-bridge] SmartCore missing");
    return;
  }
  if (global.SmartCore.store && global.SmartCore.store._bridged) return;

  var TOKEN_KEY = "smart_suite_api_token";
  var online = null;
  var pushTimers = {};
  var pulling = false;

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

  function serverLogin(user, pass, pin) {
    return api("/api/auth/login", {
      method: "POST",
      body: { user: user, pass: pass, pin: pin }
    }).then(function (j) {
      if (j && j.token) setToken(j.token);
      return j;
    });
  }

  function ensureSession() {
    if (!base()) return Promise.resolve(false);
    if (getToken()) return Promise.resolve(true);
    var a = SmartCore.getAuth();
    var user = (a.session && a.session.user) || "admin";
    var pass = "admin";
    var pin = a.pin2 || "1234";
    var found = (a.users || []).find(function (x) { return x.user === user; });
    if (found && found.pass) pass = found.pass;
    return serverLogin(user, pass, pin).then(function () { return true; }).catch(function () { return false; });
  }

  function modIdFromKey(key) {
    var m = String(key || "").match(/^smart_mod_([a-z0-9_]+)_v2$/i);
    return m ? m[1] : null;
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

  /** Accept only payloads that look like a module database */
  function isValidModulePayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    if (payload.stores && typeof payload.stores === "object") return true;
    if (payload.version != null && (payload.audit || payload.createdAt || payload.updatedAt)) return true;
    // non-empty domain object with more than a trivial test key
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
        if (!isValidModulePayload(payload)) {
          // Server empty/invalid — keep local; optionally seed server from local later
          return local;
        }
        // Prefer newer server if both exist
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
      }).catch(function () {
        return local;
      });
    });
  }

  function storeSave(modId, data) {
    if (!isValidModulePayload(data) && !(data && data.stores)) {
      // still allow explicit saves of structured empty defDB-like objects
    }
    var localOk = SmartCore.saveModuleData(modId, data);
    if (!base()) {
      return Promise.resolve({ ok: localOk, source: "local" });
    }
    return ensureSession().then(function (ok) {
      if (!ok) return { ok: localOk, source: "local" };
      return api("/api/data/" + encodeURIComponent(modId), {
        method: "PUT",
        body: { payload: data }
      }).then(function (j) {
        return { ok: true, source: "server", version: j.version, updatedAt: j.updatedAt };
      }).catch(function () {
        return { ok: localOk, source: "local-fallback" };
      });
    });
  }

  function schedulePush(key, raw) {
    if (pulling || !base()) return;
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
    return storeLoad(modId, {}).then(function (payload) {
      if (payload && isValidModulePayload(payload)) {
        console.info("[server-bridge] pulled", modId);
      } else {
        console.info("[server-bridge] no server data for", modId, "— using local");
      }
    });
  }

  var _login = SmartCore.login;
  SmartCore.login = function (user, pass, pin) {
    var res = _login(user, pass, pin);
    if (res && res.ok && base()) {
      serverLogin(user, pass, pin).catch(function () {});
    }
    return res;
  };
  var _logout = SmartCore.logout;
  SmartCore.logout = function () {
    var t = getToken();
    setToken("");
    if (base() && t) {
      api("/api/auth/logout", { method: "POST" }).catch(function () {});
    }
    return _logout();
  };

  SmartCore.api = {
    base: base,
    health: health,
    login: serverLogin,
    getToken: getToken,
    fetch: api,
    isOnline: function () { return !!online; }
  };
  SmartCore.store = {
    _bridged: true,
    load: storeLoad,
    save: storeSave,
    pullCurrent: pullCurrentModule
  };
  SmartCore.version = String(SmartCore.version).replace(/\+bridge.*/, "") + "+bridge1.2";

  installLocalStorageHook();

  if (base()) {
    health().then(function (ok) {
      if (ok) {
        console.info("[server-bridge] online", base());
        ensureSession().then(function (s) {
          console.info("[server-bridge] session", s ? "ok" : "pending-login");
          // Do not auto-pull before module script runs — race broke cashbox loadDB.
          // Pull after DOM ready, deferred.
          if (s) {
            setTimeout(function () {
              pullCurrentModule();
            }, 1500);
          }
        });
      } else {
        console.info("[server-bridge] server not reachable — localStorage only");
      }
    });
  }
})(typeof window !== "undefined" ? window : this);
