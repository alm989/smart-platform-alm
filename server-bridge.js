/* Phase3-A3 */
/**
 * server-bridge.js v2.3 Phase2-B
 * - Suite launcher filter by JWT modules[]
 * - Remember login · RBAC UI · cartable · optimistic lock
 */
(function (global) {
  "use strict";
  if (!global.SmartCore) {
    console.warn("[server-bridge] SmartCore missing");
    return;
  }
  if (global.SmartCore.store && global.SmartCore.store._bridged21) return;

  var TOKEN_KEY = "smart_suite_api_token";
  var LAST_KEY = "smart_suite_last_login";
  var CART_KEY = "suite_cartable_v1";
  var online = null;
  var pushTimers = {};
  var pulling = false;
  var cartPulling = false;
  var loginInflight = null;
  var serverUser = null;
  var modVersions = {};
  /* ===== Phase2-A/B sync-queue ===== */
  var SYNC_Q_KEY = "suite_sync_queue_v1";
  var syncState = { status: "offline", pending: 0, lastError: "" };

  function readSyncQ() {
    try {
      var a = JSON.parse(localStorage.getItem(SYNC_Q_KEY) || "[]");
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function writeSyncQ(arr) {
    try { localStorage.setItem(SYNC_Q_KEY, JSON.stringify(arr || [])); } catch (e) {}
    syncState.pending = (arr || []).length;
    renderSyncChip();
  }
  function enqueueSync(modId, data) {
    var q = readSyncQ().filter(function (x) { return x && x.modId !== modId; });
    q.push({ modId: modId, data: data, at: Date.now() });
    if (q.length > 40) q = q.slice(-40);
    writeSyncQ(q);
    syncState.status = "pending";
    renderSyncChip();
  }
  function renderSyncChip() {
    try {
      var el = document.getElementById("sfSyncChip");
      if (!el) {
        el = document.createElement("div");
        el.id = "sfSyncChip"; try { el.style.left="12px"; el.style.right="auto"; el.style.bottom="12px"; } catch(_e){} el.style.left = "12px"; el.style.right = "auto"; el.style.bottom = "12px";
        el.setAttribute("style",
          "position:fixed;bottom:12px;left:12px;right:auto;z-index:140;font:11px Tahoma,sans-serif;" +
          "background:rgba(15,23,42,.92);color:#e2e8f0;border:1px solid #334155;" +
          "border-radius:8px;padding:5px 9px;pointer-events:none");
        (document.body || document.documentElement).appendChild(el);
      }
      var label = syncState.status === "synced" ? "همگام" :
        (syncState.status === "pending" ? ("در صف " + syncState.pending) :
        (syncState.status === "offline" ? "آفلاین" : syncState.status));
      el.textContent = "سرور: " + label;
      el.style.borderColor = syncState.status === "synced" ? "#166534" :
        (syncState.status === "pending" ? "#854d0e" : "#334155");
    } catch (e) {}
  }
  function flushSyncQueue() {
    var q = readSyncQ();
    if (!q.length) {
      syncState.status = online ? "synced" : "offline";
      renderSyncChip();
      return Promise.resolve(0);
    }
    var i = 0, ok = 0;
    function next() {
      if (i >= q.length) {
        writeSyncQ([]);
        syncState.status = "synced";
        renderSyncChip();
        return ok;
      }
      var item = q[i++];
      return pushModule(item.modId, item.data).then(function () {
        ok++;
        return next();
      }).catch(function () {
        var rest = q.slice(i - 1);
        writeSyncQ(rest);
        syncState.status = "pending";
        renderSyncChip();
        return ok;
      });
    }
    syncState.status = "pending";
    renderSyncChip();
    return ensureSession().then(function (s) {
      if (!s) return 0;
      return next();
    });
  }
  /* ===== end Phase2-A ===== */


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

  function getLastLogin() {
    try {
      var o = JSON.parse(sessionStorage.getItem(LAST_KEY) || "null");
      if (o && o.user) return { user: o.user, at: o.at || null };
    } catch (e) {}
    return null;
  }
  function setLastLogin(user, pass, pin) {
    try {
      sessionStorage.setItem(LAST_KEY, JSON.stringify({ user: user, at: Date.now() }));
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
    var last = getLastLogin();
    if (last) return { user: last.user, pass: last.pass, pin: last.pin || "5678" };
    var a = SmartCore.getAuth();
    var user = (a.session && a.session.user) || "";
    var pass = "";
    var pin = "";
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
    var p = String(pin || "").trim(); if (!user || !pass || !p) return Promise.reject(new Error("credentials required"));
    return api("/api/auth/login", {
      method: "POST",
      body: { user: user, pass: pass, pin: p }
    }).then(function (j) {
      if (j && j.token) setToken(j.token);
      if (j && j.user) {
        serverUser = j.user;
        setLastLogin(user, pass, p);
      } else throw new Error((j && j.error) || "no token");
      return j;
    });
  }

  function tryLoginSeq(list) {
    var i = 0;
    function next() {
      if (i >= list.length) return Promise.resolve(false);
      var c = list[i++];
      return serverLogin(c.user, c.pass, c.pin).then(function () { return true; })
        .catch(function () { return next(); });
    }
    return next();
  }

    function forceLogin() {
    /* Phase1-A: never auto-login with stored/default passwords */
    setToken("");
    serverUser = null;
    console.info("[server-bridge] session required — use login form");
    return Promise.resolve(false);
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

  function role() {
    return (serverUser && serverUser.role) || "user";
  }

  function allowedModules() {
    var r = role();
    if (r === "admin" || r === "ceo") return null; // null = all
    var list = (serverUser && serverUser.modules) || [];
    if (!list.length) return [];
    return list.map(function (x) { return String(x).toLowerCase(); });
  }

  function canAccessMod(id) {
    var allow = allowedModules();
    if (allow === null) return true;
    id = String(id || "").toLowerCase();
    if (id === "suite" || id === "index") return true;
    return allow.indexOf(id) >= 0;
  }

  function isServerElevated() {
    var r = role();
    return r === "admin" || r === "ceo";
  }
  function canManageUsers() { return isServerElevated(); }
  function canBackupRestore() {
    var r = role();
    return r === "admin" || r === "ceo" || r === "manager";
  }

  function applyGearPolicy() {
    if (detectModId() !== "suite") return;
    var g = document.getElementById("gearBtn");
    var panel = document.getElementById("settingsPanel");
    if (!g) return;
    if (isServerElevated()) {
      g.classList.add("show");
      g.style.display = "grid";
      g.title = "تنظیمات سیستم (" + role() + ")";
    } else {
      g.classList.remove("show");
      g.classList.remove("on");
      g.style.display = "none";
      if (panel) panel.classList.remove("open");
    }
  }

  /** Hide suite tiles not in JWT modules[] */
  function applySuiteLauncherFilter() {
    if (detectModId() !== "suite") return;
    var allow = allowedModules();
    var tiles = document.querySelectorAll("a.mod[data-id], a.mod[href]");
    var hidden = 0;
    var shown = 0;

    tiles.forEach(function (a) {
      var id = (a.getAttribute("data-id") || "").toLowerCase();
      if (!id) {
        var href = a.getAttribute("href") || "";
        var m = href.match(/([^\/\\]+)\.html?/i);
        if (m) {
          id = m[1].toLowerCase();
          if (id === "file-hub") id = "filehub";
          if (id === "pr-media") id = "pr";
        }
      }
      if (!id) return;

      if (allow === null || allow.indexOf(id) >= 0) {
        a.style.display = "";
        a.removeAttribute("data-rbac-mod-hidden");
        shown++;
      } else {
        a.style.display = "none";
        a.setAttribute("data-rbac-mod-hidden", "1");
        hidden++;
      }
    });

    // hide empty sections
    document.querySelectorAll(".section").forEach(function (sec) {
      var grid = sec.querySelector(".grid");
      if (!grid) return;
      var any = false;
      grid.querySelectorAll("a.mod").forEach(function (a) {
        if (a.style.display !== "none") any = true;
      });
      sec.style.display = any ? "" : "none";
    });

    var chip = document.getElementById("sfRoleChip");
    if (!chip) {
      chip = document.createElement("div");
      chip.id = "sfRoleChip";
      chip.setAttribute("style",
        "position:fixed;top:10px;right:10px;z-index:120;font:11px Tahoma,sans-serif;" +
        "background:rgba(15,23,42,.9);color:#e2e8f0;border:1px solid #334155;" +
        "border-radius:8px;padding:5px 9px");
      (document.body || document.documentElement).appendChild(chip);
    }
    chip.textContent = "نقش: " + role() +
      (serverUser && serverUser.user ? " (" + serverUser.user + ")" : "") +
      " · ماژول " + shown;

    console.info("[server-bridge] suite filter", role(), "shown", shown, "hidden", hidden);
  }

  /** Block direct URL to forbidden module */
  function guardCurrentModule() {
    var mod = detectModId();
    if (mod === "suite" || mod === "index") return;
    if (canAccessMod(mod)) return;
    console.warn("[server-bridge] module forbidden", mod, role());
    if (SmartCore.toast) SmartCore.toast("دسترسی به این ماژول مجاز نیست", true);
    setTimeout(function () {
      location.href = (base() || "") + "/suite.html";
    }, 600);
  }

  function applyModuleRbac() {
    /* Phase3-A3-domguard */
    if (!document.body) { setTimeout(applyModuleRbac, 50); return; }
    var mod = detectModId();
    if (mod === "suite") {
      applySuiteLauncherFilter();
      applyGearPolicy();
      return;
    }
    if (!mod || mod === "index") return;

    guardCurrentModule();

    var r = role();
    var managerPlus = canBackupRestore();

    var chip = document.getElementById("sfRoleChip");
    if (!chip) {
      chip = document.createElement("div");
      chip.id = "sfRoleChip";
      chip.setAttribute("style",
        "position:fixed;top:10px;right:10px;z-index:120;font:11px Tahoma,sans-serif;" +
        "background:rgba(15,23,42,.9);color:#e2e8f0;border:1px solid #334155;" +
        "border-radius:8px;padding:5px 9px");
      (document.body || document.documentElement).appendChild(chip);
    }
    chip.textContent = "نقش سرور: " + r +
      (serverUser && serverUser.user ? " (" + serverUser.user + ")" : "");

    function hideEl(el) {
      if (!el) return;
      el.style.display = "none";
      el.setAttribute("data-rbac-hidden", "1");
    }

    if (!canManageUsers()) {
      hideEl(document.getElementById("p-users"));
      document.querySelectorAll("[data-panel='p-users'], a[href='#p-users']").forEach(hideEl);
      document.querySelectorAll("nav button, .nav button, .side button, [data-panel]").forEach(function (b) {
        var t = (b.textContent || "") + (b.getAttribute("data-panel") || "");
        if (/کاربر|users|p-users/i.test(t)) hideEl(b);
      });
    }

    if (!managerPlus) {
      ["btnRestoreEmergency", "btnRestoreLocal", "btnBackupLocal", "restoreFile"].forEach(function (id) {
        hideEl(document.getElementById(id));
      });
      document.querySelectorAll("button").forEach(function (b) {
        var t = b.textContent || "";
        if (/بازیابی اضطراری|بازیابی از فایل|پشتیبان محلی/i.test(t)) hideEl(b);
      });
    }

    if (!isServerElevated()) {
      ["p-sys", "p-admin", "p-security", "p-audit-admin"].forEach(function (id) {
        hideEl(document.getElementById(id));
      });
    }

    if (r === "guest") {
      document.querySelectorAll("button.btn-p, button.primary, .btn-ok").forEach(function (b) {
        var t = b.textContent || "";
        if (/ثبت|ذخیره|ارسال/i.test(t)) {
          b.disabled = true;
          b.title = "نقش guest اجازه ثبت ندارد";
        }
      });
    }
    console.info("[server-bridge] RBAC applied", mod, r);
  }

  function modIdFromKey(key) {
    var m = String(key || "").match(/^smart_mod_([a-z0-9_]+)_v2$/i);
    return m ? m[1] : null;
  }

    function isValidModulePayload(payload) {
    /* Phase2-A: accept real module objects */
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    var keys = Object.keys(payload);
    if (keys.length === 0) return false;
    if (keys.length === 1 && (keys[0] === "test" || keys[0] === "at")) return false;
    return true;
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
        if (j && j.data && j.data.version != null) modVersions[modId] = j.data.version;
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

  function pushModule(modId, data, baseVersion) {
    var body = { payload: data };
    if (baseVersion != null) body.baseVersion = baseVersion;
    else if (modVersions[modId] != null) body.baseVersion = modVersions[modId];
    return api("/api/data/" + encodeURIComponent(modId), {
      method: "PUT",
      body: body
    }).then(function (j) {
      if (j && j.version != null) modVersions[modId] = j.version;
      return j;
    }).catch(function (err) {
      if (err && err.status === 409 && err.body && err.body.data) {
        console.warn("[server-bridge] version conflict", modId, err.body.serverVersion);
        modVersions[modId] = err.body.serverVersion;
        var payload = err.body.data.payload;
        if (isValidModulePayload(payload)) {
          writeLocalSilent(SmartCore.primaryKey(modId), payload);
        }
        if (SmartCore.toast) SmartCore.toast("تداخل نسخه — داده سرور بارگذاری شد", true);
      }
      throw err;
    });
  }

  function storeSave(modId, data) {
    try {
      if (data && typeof data === "object" && !Array.isArray(data) && !data.updatedAt) {
        data.updatedAt = new Date().toISOString();
      }
    } catch (e0) {}
    var localOk = SmartCore.saveModuleData(modId, data);
    if (!base()) return Promise.resolve({ ok: localOk, source: "local" });
    return ensureSession().then(function (ok) {
      if (!ok) return { ok: localOk, source: "local" };
      return pushModule(modId, data).then(function (j) {
        syncState.status = "synced";
        renderSyncChip();
        try {
          if (typeof syncState !== "undefined") { syncState.status = "synced"; syncState.lastMod = modId; }
          if (typeof renderSyncChip === "function") renderSyncChip();
        } catch (eS) {}
        return { ok: true, source: "server", version: j.version };
      }).catch(function () {
        enqueueSync(modId, data);
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
        syncState.status = "syncing"; syncState.lastMod = modId; renderSyncChip();
        return pushModule(modId, data).then(function (j) {
          console.info("[server-bridge] synced", modId, "v" + (j.version || "?"));
          try {
            if (typeof syncState !== "undefined") { syncState.status = "synced"; syncState.lastMod = modId; }
            if (typeof renderSyncChip === "function") renderSyncChip();
            if (SmartCore.toast && !window.__sfSyncToastAt || (Date.now() - (window.__sfSyncToastAt || 0) > 2500)) {
              window.__sfSyncToastAt = Date.now();
              SmartCore.toast("همگام با سرور: " + modId);
            }
          } catch (eT) {}
          syncState.status = "synced"; renderSyncChip();
        }).catch(function (err) {
          console.warn("[server-bridge] sync fail", modId, err && err.message);
          try { enqueueSync(modId, data); } catch (e2) { syncState.status = "pending"; renderSyncChip(); }
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
        return api("/api/cartable", { method: "PUT", body: { items: items } }).then(function (j) {
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
        local.items.forEach(function (x) { if (x && x.id) map[x.id] = x; });
        items.forEach(function (x) { if (x && x.id) map[x.id] = x; });
        var merged = Object.keys(map).map(function (k) { return map[k]; });
        merged.sort(function (a, b) {
          return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
        });
        try {
          cartPulling = true;
          localStorage.setItem(CART_KEY, JSON.stringify({ items: merged, updatedAt: new Date().toISOString() }));
          localStorage.setItem("suite_cartable_ping", String(Date.now()));
        } catch (e2) {
        } finally {
          cartPulling = false;
        }
        console.info("[server-bridge] cartable pulled", merged.length);
        if (global.SuiteFacilities && typeof SuiteFacilities.renderCart === "function") {
          try { SuiteFacilities.renderCart(); } catch (e3) {}
        }
      }).catch(function (err) {
        console.warn("[server-bridge] cartable pull fail", err && err.message);
      });
    });
  }

  function installCartablePanelHook() {
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-panel='p-cartable'], #sfCartRefresh");
      if (!t) return;
      pullCartable();
    }, true);
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
        console.info("[server-bridge] pulled", modId, "v" + (modVersions[modId] || "?"));
      }
    });
  }

  function runServerBackup() {
    return ensureSession().then(function (ok) {
      if (!ok) throw new Error("ورود سرور ناموفق");
      return api("/api/backup", { method: "POST" });
    });
  }

  function switchServerUser(user, pass, pin) {
    setToken("");
    return serverLogin(user, pass, pin || "5678").then(function () {
      return ensureSession().then(function () {
        applyGearPolicy();
        applyModuleRbac();
        return serverUser;
      });
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
          })
          .catch(function (e) {
            if (SmartCore.toast) SmartCore.toast(e.message || "خطا", true);
          })
          .then(function () { btn.disabled = false; });
      };
      var hint = panel.querySelector(".hint");
      if (hint) panel.insertBefore(btn, hint);
      else panel.appendChild(btn);
    } catch (e) {}
  }

  var _login = SmartCore.login;
  SmartCore.login = function (user, pass, pin) {
    var res = _login(user, pass, pin);
    if (res && res.ok && base()) {
      serverLogin(user, pass, pin || "5678")
        .then(function () {
          return ensureSession();
        })
        .then(function () {
          applyGearPolicy();
          applyModuleRbac();
          injectSuiteBackupButton();
        })
        .catch(function () {
          forceLogin().then(function () {
            applyGearPolicy();
            applyModuleRbac();
          });
        });
    }
    return res;
  };
  var _logout = SmartCore.logout;
  SmartCore.logout = function () {
    var t = getToken();
    setToken("");
    try { sessionStorage.removeItem(LAST_KEY); } catch (e) {}
    serverUser = null;
    if (base() && t) api("/api/auth/logout", { method: "POST" }).catch(function () {});
    applyGearPolicy();
    return _logout();
  };

  SmartCore.api = {
    base: base,
    health: health,
    login: serverLogin,
    switchUser: switchServerUser,
    getToken: getToken,
    fetch: api,
    ensureSession: ensureSession,
    backup: runServerBackup,
    pullCartable: pullCartable,
    serverUser: function () { return serverUser; },
    isElevated: isServerElevated,
    role: role,
    canAccessMod: canAccessMod,
    allowedModules: allowedModules,
    modVersion: function (id) { return modVersions[id]; },
    isOnline: function () { return !!online; },
    flushSync: flushSyncQueue,
    syncState: function () { return { status: syncState.status, pending: syncState.pending }; }
  };
  SmartCore.store = {
    _bridged: true,
    _bridged21: true,
    load: storeLoad,
    save: storeSave,
    pullCurrent: pullCurrentModule
  };
  SmartCore.version = String(SmartCore.version).replace(/\+bridge.*/, "") + "+bridge2.3-p2a";

  installLocalStorageHook();
  installCartablePanelHook();

  if (base()) {
    health().then(function (ok) {
      if (ok) {
        console.info("[server-bridge] online", base());
        window.__sfOnline = true;
        try { if (typeof renderSyncChip === "function") renderSyncChip(); } catch (eR) {}
        ensureSession().then(function (s) {
          try { if (typeof renderSyncChip === "function") renderSyncChip(); else {
      var _el = document.getElementById("sfSyncChip");
      if (!_el && (document.body || document.documentElement)) {
        _el = document.createElement("div");
        _el.id = "sfSyncChip"; try { el.style.left="12px"; el.style.right="auto"; el.style.bottom="12px"; } catch(_e){} el.style.left = "12px"; el.style.right = "auto"; el.style.bottom = "12px";
        _el.setAttribute("style","position:fixed;bottom:12px;left:12px;right:auto;z-index:140;font:11px Tahoma,sans-serif;background:rgba(15,23,42,.92);color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:5px 9px");
        _el.textContent = "سرور: " + (s ? "همگام" : "ورود لازم");
        (document.body || document.documentElement).appendChild(_el);
      }
    } } catch (eChip) {}
        console.info("[server-bridge] session", s ? "ok" : "need-login",
            serverUser ? serverUser.role : "");
          applyGearPolicy();
          applyModuleRbac();
          if (s) {
            setTimeout(function () {
              flushSyncQueue();
              pullCurrentModule();
              pullCartable();
              injectSuiteBackupButton();
              applyModuleRbac();
            }, 700);
            setTimeout(applyModuleRbac, 2000);
            setInterval(function () { pullCartable(); }, 30000);
          }
        });
      }
    });
  }
})(typeof window !== "undefined" ? window : this);
