/**
 * server-bridge.js — SmartCore <-> Local Server
 * Load after core.js when pages are served from http://127.0.0.1:8787
 * - Login token
 * - store.load / store.save -> /api/data/:moduleId
 * - Fallback to localStorage if server unavailable
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

  function storeLoad(modId, def) {
    def = def != null ? def : {};
    if (!base()) {
      return Promise.resolve(SmartCore.loadModuleData(modId, def));
    }
    return ensureSession().then(function (ok) {
      if (!ok) return SmartCore.loadModuleData(modId, def);
      return api("/api/data/" + encodeURIComponent(modId)).then(function (j) {
        var payload = j && j.data && j.data.payload != null ? j.data.payload : def;
        try { SmartCore.saveJSON(SmartCore.primaryKey(modId), payload); } catch (e) {}
        return payload;
      }).catch(function () {
        return SmartCore.loadModuleData(modId, def);
      });
    });
  }

  function storeSave(modId, data) {
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

  // Hook local login -> also obtain server token
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
    setToken("");
    if (base() && getToken()) {
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
    save: storeSave
  };
  SmartCore.version = String(SmartCore.version) + "+bridge";

  if (base()) {
    health().then(function (ok) {
      if (ok) {
        console.info("[server-bridge] online", base());
        ensureSession().then(function (s) {
          console.info("[server-bridge] session", s ? "ok" : "pending-login");
        });
      } else {
        console.info("[server-bridge] server not reachable — localStorage only");
      }
    });
  }
})(typeof window !== "undefined" ? window : this);
