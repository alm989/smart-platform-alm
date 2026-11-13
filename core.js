/**
 * Smart Suite Core v3 — هسته یکپارچه و امن
 * سامانه یکپارچه هوشمند مالی و اداری
 * - Registry یکسان با suite.html
 * - Storage امن + namespace
 * - Auth + PIN2
 * - Audit + Event bus
 * - XSS escape + Tab lock
 * - بدون eval
 */
(function (global) {
  "use strict";

  var CORE_VERSION = 3;
  var AUTH_KEY = "smart_users_suite_brain";
  var AUDIT_KEY = "suite_core_audit_v3";
  var EVENTS_KEY = "suite_events_v1";
  var REGISTRY_KEY = "smart_suite_registry_v3";
  var LOCK_PREFIX = "suite_tab_lock_";
  var MAX_AUDIT = 300;
  var MAX_EVENTS = 400;

  /* ========== Registry (هم‌راستا با suite.html) ========== */
  var MODULES = [
    { id: "ceo", file: "ceo.html", title: "مدیرعامل", icon: "👔", keys: ["smart_mod_ceo_v2", "smart_ceo_v1"] },
    { id: "manager", file: "manager.html", title: "مدیریت", icon: "📋", keys: ["smart_mod_manager_v2", "smart_mgmt_v1"] },
    { id: "sysadmin", file: "sysadmin.html", title: "مدیر سیستم", icon: "⚙️", keys: ["smart_mod_sysadmin_v2"] },
    { id: "accounting", file: "accounting.html", title: "حسابداری", icon: "📒", keys: ["smart_mod_accounting_v2", "smart_accounting_v1"] },
    { id: "bank", file: "bank.html", title: "بانک", icon: "🏦", keys: ["smart_mod_bank_v2", "smart_bank_v1"] },
    { id: "cashbox", file: "cashbox.html", title: "صندوق", icon: "💵", keys: ["smart_mod_cashbox_v2", "smart_fund_v1"] },
    { id: "pettycash", file: "pettycash.html", title: "تنخواه", icon: "🧾", keys: ["smart_mod_pettycash_v2", "smart_petty_v1"] },
    { id: "tax", file: "tax.html", title: "مالیات", icon: "📊", keys: ["smart_mod_tax_v2", "smart_tax_v1"] },
    { id: "budget", file: "budget.html", title: "بودجه", icon: "📈", keys: ["smart_mod_budget_v2", "smart_budget_v1"] },
    { id: "audit", file: "audit.html", title: "حسابرسی", icon: "🔍", keys: ["smart_mod_audit_v2"] },
    { id: "fixedassets", file: "fixedassets.html", title: "دارایی ثابت", icon: "🏢", keys: ["smart_mod_fixedassets_v2", "smart_assets_v1"] },
    { id: "sales", file: "sales.html", title: "فروش", icon: "🛒", keys: ["smart_mod_sales_v2", "smart_sales_v1"] },
    { id: "purchase", file: "purchase.html", title: "خرید", icon: "🛍️", keys: ["smart_mod_purchase_v2"] },
    { id: "warehouse", file: "warehouse.html", title: "انبار", icon: "📦", keys: ["smart_mod_warehouse_v2", "smart_warehouse_v1"] },
    { id: "customers", file: "customers.html", title: "مشتریان", icon: "👥", keys: ["smart_mod_customers_v2", "smart_customers_v1"] },
    { id: "production", file: "production.html", title: "تولید", icon: "🏭", keys: ["smart_mod_production_v2", "smart_prod_v1"] },
    { id: "contracts", file: "contracts.html", title: "قراردادها", icon: "📝", keys: ["smart_mod_contracts_v2", "smart_contracts_v1"] },
    { id: "projects", file: "projects.html", title: "پروژه", icon: "📌", keys: ["smart_mod_projects_v2", "smart_projects_v1"] },
    { id: "fleet", file: "fleet.html", title: "ناوگان", icon: "🚚", keys: ["smart_mod_fleet_v2", "smart_fleet_v1"] },
    { id: "personnel", file: "personnel.html", title: "پرسنلی", icon: "👤", keys: ["smart_mod_personnel_v2", "smart_hr_v1"] },
    { id: "payroll", file: "payroll.html", title: "حقوق", icon: "💰", keys: ["smart_mod_payroll_v2"] },
    { id: "secretariat", file: "secretariat.html", title: "دبیرخانه", icon: "🗂️", keys: ["smart_mod_secretariat_v2"] },
    { id: "secretary", file: "secretary.html", title: "منشی", icon: "🗓️", keys: ["smart_mod_secretary_v2", "smart_secretary_v1"] },
    { id: "correspondence", file: "correspondence.html", title: "مکاتبات", icon: "✉️", keys: ["smart_mod_correspondence_v2"] },
    { id: "archive", file: "archive.html", title: "بایگانی", icon: "📁", keys: ["smart_mod_archive_v2"] },
    { id: "documents", file: "documents.html", title: "اسناد", icon: "📄", keys: ["smart_mod_documents_v2", "smart_docs_v1"] },
    { id: "assistant", file: "assistant.html", title: "دستیار", icon: "🤖", keys: ["smart_mod_assistant_v2", "smart_assistant_v1"] },
    { id: "lawyer", file: "lawyer.html", title: "وکیل", icon: "⚖️", keys: ["smart_mod_lawyer_v2", "smart_lawyer_v1"] },
    { id: "pr", file: "pr.html", title: "روابط عمومی", icon: "📢", keys: ["smart_mod_pr_v2", "smart_pr_v1"] },
    { id: "multicompany", file: "multicompany.html", title: "چندشرکتی", icon: "🏛️", keys: ["smart_mod_multicompany_v2", "smart_multicompany_v1"] },
    { id: "chat", file: "chat.html", title: "چت", icon: "💬", keys: ["smart_mod_chat_v2"] },
    { id: "meeting", file: "meeting.html", title: "متینگ", icon: "🎥", keys: ["smart_mod_meeting_v2"] },
    { id: "filehub", file: "file-hub.html", title: "هاب فایل", icon: "📎", keys: ["smart_mod_filehub_v2"] },
    { id: "suite", file: "suite.html", title: "سوییت", icon: "🏛️", keys: ["smart_mod_suite_brain_v2"] }
  ];

  /* ========== Utils ========== */
  function now() { return new Date().toISOString(); }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, """)
      .replace(/'/g, "&#39;");
  }
  function isSuiteKey(k) {
    return !!k && (k.indexOf("smart_") === 0 || k.indexOf("suite_") === 0);
  }
  function safeParse(raw, def) {
    if (raw == null || raw === "") return def;
    try { return JSON.parse(raw); } catch (e) { return def; }
  }

  /* ========== Storage ========== */
  function loadJSON(key, def) {
    if (!isSuiteKey(key) && key.indexOf("smart_") !== 0) {
      console.warn("[SmartCore] blocked non-suite key read:", key);
      return def;
    }
    try {
      var r = localStorage.getItem(key);
      return r != null ? safeParse(r, def) : def;
    } catch (e) {
      return def;
    }
  }
  function saveJSON(key, val) {
    if (!isSuiteKey(key) && key.indexOf("smart_") !== 0) {
      console.warn("[SmartCore] blocked non-suite key write:", key);
      return false;
    }
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      return false;
    }
  }
  function loadArr(key) {
    var a = loadJSON(key, []);
    return Array.isArray(a) ? a : [];
  }
  function saveArr(key, arr) {
    return saveJSON(key, Array.isArray(arr) ? arr : []);
  }
  function removeKey(key) {
    if (!isSuiteKey(key)) return false;
    try { localStorage.removeItem(key); return true; } catch (e) { return false; }
  }

  function softDelete(list, id, by) {
    if (!Array.isArray(list)) return list;
    return list.map(function (row) {
      if (row && String(row.id) === String(id)) {
        return Object.assign({}, row, {
          deleted: true,
          deletedAt: now(),
          deletedBy: by || userName()
        });
      }
      return row;
    });
  }
  function activeOnly(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (r) { return r && !r.deleted; });
  }

  /* ========== Auth + PIN2 ========== */
  function defaultAuth() {
    return {
      users: [{ user: "admin", pass: "admin", name: "مدیر", role: "admin" }],
      pin2: "1234",
      session: null
    };
  }
  function getAuth() {
    var a = loadJSON(AUTH_KEY, null);
    if (!a || !Array.isArray(a.users)) {
      a = defaultAuth();
      saveJSON(AUTH_KEY, a);
    }
    if (a.pin2 == null) a.pin2 = "1234";
    return a;
  }
  function saveAuth(a) { return saveJSON(AUTH_KEY, a); }
  function userName() {
    var a = getAuth();
    return (a.session && (a.session.name || a.session.user)) || "مهمان";
  }
  function userRole() {
    var a = getAuth();
    return (a.session && a.session.role) || "guest";
  }
  function isLoggedIn() {
    var a = getAuth();
    return !!(a.session && a.session.user && a.session.pinOk);
  }
  function isAdmin() {
    var r = userRole();
    return isLoggedIn() && (r === "admin" || r === "ceo");
  }
  function login(user, pass, pin) {
    var a = getAuth();
    var f = (a.users || []).find(function (x) {
      return x.user === user && x.pass === pass;
    });
    if (!f) return { ok: false, error: "کاربری یا رمز اشتباه" };
    if (String(a.pin2 || "") !== String(pin || "").trim()) {
      return { ok: false, error: "پین دوم اشتباه" };
    }
    a.session = {
      user: f.user,
      name: f.name || f.user,
      role: f.role || "admin",
      pinOk: true,
      at: now()
    };
    saveAuth(a);
    audit("login", f.user);
    emit("auth:login", { user: f.user });
    return { ok: true, user: a.session };
  }
  function logout() {
    var a = getAuth();
    var u = a.session && a.session.user;
    a.session = null;
    saveAuth(a);
    audit("logout", u || "");
    emit("auth:logout", {});
  }
  function ensureAuth(cb, opts) {
    opts = opts || {};
    if (isLoggedIn()) {
      if (opts.requireAdmin && !isAdmin()) {
        toast("دسترسی فقط مدیر", true);
        return;
      }
      cb();
      return;
    }
    showLoginMask(function () {
      if (opts.requireAdmin && !isAdmin()) {
        toast("دسترسی فقط مدیر", true);
        logout();
        return;
      }
      cb();
    });
  }
  function showLoginMask(onOk) {
    if (document.querySelector(".sc-login-mask")) return;
    var m = document.createElement("div");
    m.className = "sc-login-mask";
    m.setAttribute("style",
      "position:fixed;inset:0;background:rgba(2,6,23,.96);z-index:9999;" +
      "display:flex;align-items:center;justify-content:center;font-family:Tahoma,sans-serif");
    m.innerHTML =
      '<div style="background:#1e293b;border:1px solid #334155;border-radius:14px;padding:18px;width:min(340px,92vw);color:#e2e8f0">' +
      '<h2 style="text-align:center;color:#c4b5fd;margin:0 0 10px;font-size:1rem">ورود سیستمی</h2>' +
      '<label style="display:block;font-size:.7rem;color:#94a3b8;margin:6px 0 2px">کاربری</label>' +
      '<input id="scLgU" autocomplete="username" style="width:100%;padding:8px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-family:inherit;box-sizing:border-box">' +
      '<label style="display:block;font-size:.7rem;color:#94a3b8;margin:6px 0 2px">رمز</label>' +
      '<input id="scLgP" type="password" autocomplete="current-password" style="width:100%;padding:8px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-family:inherit;box-sizing:border-box">' +
      '<label style="display:block;font-size:.7rem;color:#94a3b8;margin:6px 0 2px">پین دوم</label>' +
      '<input id="scLgPin" type="password" maxlength="8" inputmode="numeric" placeholder="۴ رقم" style="width:100%;padding:8px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-family:inherit;box-sizing:border-box">' +
      '<button type="button" id="scLgGo" style="width:100%;margin-top:12px;padding:9px;border:none;border-radius:10px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;font-weight:700;cursor:pointer;font-family:inherit">ورود</button>' +
      '<button type="button" id="scLgCancel" style="width:100%;margin-top:6px;padding:8px;border:1px solid #334155;border-radius:10px;background:#1e293b;color:#cbd5e1;cursor:pointer;font-family:inherit">انصراف</button>' +
      '<p style="margin:10px 0 0;text-align:center;font-size:.65rem;color:#64748b">admin / admin · پین: ۱۲۳۴</p></div>';
    document.body.appendChild(m);
    function close() { m.remove(); }
    m.querySelector("#scLgGo").onclick = function () {
      var u = (m.querySelector("#scLgU").value || "").trim();
      var p = m.querySelector("#scLgP").value || "";
      var pin = (m.querySelector("#scLgPin").value || "").trim();
      var res = login(u, p, pin);
      if (!res.ok) { toast(res.error, true); return; }
      close();
      if (typeof onOk === "function") onOk(res.user);
    };
    m.querySelector("#scLgCancel").onclick = close;
  }

  /* ========== Audit ========== */
  function audit(action, detail, mod) {
    var list = loadArr(AUDIT_KEY);
    list.unshift({
      id: uid(),
      t: now(),
      user: userName(),
      action: String(action || "").slice(0, 48),
      detail: String(detail || "").slice(0, 240),
      mod: String(mod || "").slice(0, 32)
    });
    if (list.length > MAX_AUDIT) list = list.slice(0, MAX_AUDIT);
    saveArr(AUDIT_KEY, list);
  }
  function getAudit(limit) {
    return loadArr(AUDIT_KEY).slice(0, limit || 50);
  }

  /* ========== Event bus ========== */
  var _handlers = {};
  function on(evt, fn) {
    if (!evt || typeof fn !== "function") return function () {};
    if (!_handlers[evt]) _handlers[evt] = [];
    _handlers[evt].push(fn);
    return function off() {
      _handlers[evt] = (_handlers[evt] || []).filter(function (f) { return f !== fn; });
    };
  }
  function emit(evt, payload) {
    var list = _handlers[evt] || [];
    list.forEach(function (fn) {
      try { fn(payload || {}); } catch (e) { console.warn("[SmartCore] handler error", e); }
    });
    if (evt && evt.indexOf("data:") === 0) {
      pushEvent(evt, payload && (payload.message || payload.id || ""));
    }
  }
  function pushEvent(type, message) {
    var list = loadArr(EVENTS_KEY);
    list.unshift({
      id: uid(),
      t: now(),
      type: String(type || "info").slice(0, 40),
      message: String(message || "").slice(0, 240),
      by: userName()
    });
    if (list.length > MAX_EVENTS) list = list.slice(0, MAX_EVENTS);
    saveArr(EVENTS_KEY, list);
  }
  function getEvents(limit) {
    return loadArr(EVENTS_KEY).slice(0, limit || 30);
  }

  /* ========== Tab lock ========== */
  function tabId() {
    if (!sessionStorage.getItem("_sc_tab")) {
      sessionStorage.setItem("_sc_tab", uid());
    }
    return sessionStorage.getItem("_sc_tab");
  }
  function acquireLock(resource, ttlMs) {
    ttlMs = ttlMs || 8000;
    var key = LOCK_PREFIX + resource;
    var ts = Date.now();
    try {
      var lock = safeParse(localStorage.getItem(key), null);
      if (lock && lock.until > ts && lock.tab !== tabId()) {
        return false;
      }
      localStorage.setItem(key, JSON.stringify({ tab: tabId(), until: ts + ttlMs, user: userName() }));
      return true;
    } catch (e) {
      return true;
    }
  }
  function releaseLock(resource) {
    try { localStorage.removeItem(LOCK_PREFIX + resource); } catch (e) {}
  }
  function heartbeatLock(resource, ttlMs) {
    return acquireLock(resource, ttlMs || 8000);
  }

  /* ========== Scan / Backup ========== */
 function scanModules() {
    return MODULES.map(function (m) {
      var size = 0, found = [];
      (m.keys || []).forEach(function (k) {
        try {
          var v = localStorage.getItem(k);
          if (v != null) { found.push(k); size += v.length; }
        } catch (e) {}
      });
      return {
        id: m.id,
        title: m.title,
        file: m.file,
        icon: m.icon,
        keys: found,
        bytes: size,
        hasData: size > 20
      };
    });
  }
  function exportAll() {
    var data = { version: CORE_VERSION, exportedAt: now(), by: userName(), store: {} };
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (isSuiteKey(k)) {
          data.store[k] = localStorage.getItem(k);
        }
      }
    } catch (e) {}
    return data;
  }
  function importAll(data) {
    if (!data || !data.store) throw new Error("فایل نامعتبر");
    var n = 0;
    Object.keys(data.store).forEach(function (k) {
      if (!isSuiteKey(k)) return;
      try {
        localStorage.setItem(k, data.store[k]);
        n++;
      } catch (e) {}
    });
    audit("import", n + " keys");
    return n;
  }
  function downloadBackup(filename) {
    var blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || ("suite-backup-" + Date.now() + ".json");
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    audit("backup", "download");
  }

  /* ========== Toast ========== */
  function toast(msg, err) {
    var el = document.getElementById("sc-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "sc-toast";
      el.setAttribute("style",
        "position:fixed;bottom:14px;left:50%;transform:translateX(-50%);" +
        "padding:9px 14px;border-radius:12px;font-weight:700;font-size:.8rem;" +
        "z-index:10000;opacity:0;transition:.15s;font-family:Tahoma,sans-serif;pointer-events:none");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = err ? "#ef4444" : "#22c55e";
    el.style.color = "#fff";
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.opacity = "0"; }, 2400);
  }

  /* ========== Module helper ========== */
  function primaryKey(modId) {
    var m = MODULES.find(function (x) { return x.id === modId; });
    if (!m || !m.keys || !m.keys.length) return "smart_mod_" + modId + "_v2";
    return m.keys[0];
  }
  function loadModuleData(modId, def) {
    return loadJSON(primaryKey(modId), def != null ? def : {});
  }
  function saveModuleData(modId, data) {
    var ok = saveJSON(primaryKey(modId), data);
    if (ok) {
      audit("save", modId, modId);
      emit("data:" + modId, { id: modId, action: "save" });
    }
    return ok;
  }

  /* ========== Public API ========== */
  global.SmartCore = {
    version: CORE_VERSION,
    MODULES: MODULES,
    now: now,
    uid: uid,
    esc: esc,
    isSuiteKey: isSuiteKey,
    loadJSON: loadJSON,
    saveJSON: saveJSON,
    loadArr: loadArr,
    saveArr: saveArr,
    removeKey: removeKey,
    softDelete: softDelete,
    activeOnly: activeOnly,
    loadModuleData: loadModuleData,
    saveModuleData: saveModuleData,
    primaryKey: primaryKey,
    getAuth: getAuth,
    login: login,
    logout: logout,
    ensureAuth: ensureAuth,
    isLoggedIn: isLoggedIn,
    isAdmin: isAdmin,
    userName: userName,
    userRole: userRole,
    audit: audit,
    getAudit: getAudit,
    on: on,
    emit: emit,
    pushEvent: pushEvent,
    getEvents: getEvents,
    acquireLock: acquireLock,
    releaseLock: releaseLock,
    heartbeatLock: heartbeatLock,
    tabId: tabId,
    scanModules: scanModules,
    exportAll: exportAll,
    importAll: importAll,
    downloadBackup: downloadBackup,
    toast: toast
  };

  try {
    saveJSON(REGISTRY_KEY, {
      version: CORE_VERSION,
      at: now(),
      modules: MODULES.map(function (m) { return { id: m.id, file: m.file, title: m.title }; })
    });
  } catch (e) {}
})(typeof window !== "undefined" ? window : this);
