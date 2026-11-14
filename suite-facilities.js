/**
 * suite-facilities.js
 * یادداشت + یادآوری (محلی هر ماژول) + کارتابل (سراسری بین ماژول‌ها)
 * الگوی UI از accounting-v50 + بهبود نظم و دقت
 *
 * استفاده:
 *   <script src="core.js"></script>
 *   <script src="suite-facilities.js" data-module="cashbox" data-title="صندوق"></script>
 * یا: SuiteFacilities.init({ moduleId:'cashbox', moduleTitle:'صندوق' })
 */
(function (global) {
  "use strict";

  var CART_META = "suite_cartable_v1";
  var DB_NAME = "suite_cartable_db";
  var DB_VER = 1;
  var STORE = "files";
  var MAX_BYTES = 2.5 * 1024 * 1024;

  var FALLBACK_MODULES = [
    { id: "accounting", title: "حسابداری" },
    { id: "bank", title: "بانک" },
    { id: "cashbox", title: "صندوق" },
    { id: "pettycash", title: "تنخواه" },
    { id: "sales", title: "فروش" },
    { id: "purchase", title: "خرید" },
    { id: "warehouse", title: "انبار" },
    { id: "payroll", title: "حقوق" },
    { id: "personnel", title: "پرسنلی" },
    { id: "secretariat", title: "دبیرخانه" },
    { id: "secretary", title: "منشی" },
    { id: "ceo", title: "مدیرعامل" },
    { id: "manager", title: "مدیریت" },
    { id: "customers", title: "مشتریان" },
    { id: "contracts", title: "قراردادها" },
    { id: "archive", title: "بایگانی" },
    { id: "correspondence", title: "مکاتبات" },
    { id: "tax", title: "مالیات" },
    { id: "budget", title: "بودجه" },
    { id: "audit", title: "حسابرسی" }
  ];

  var S = {
    moduleId: "cashbox",
    moduleTitle: "صندوق",
    db: null,
    notesKey: "",
    remsKey: "",
    lastCartIn: 0
  };

  function esc(s) {
    if (global.SmartCore && SmartCore.esc) return SmartCore.esc(s);
    return String(s == null ? "" : s)
      .replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">")
      .replace(/"/g, """).replace(/'/g, "&#39;");
  }
  function uid() {
    if (global.SmartCore && SmartCore.uid) return SmartCore.uid();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }
  function nowIso() { return new Date().toISOString(); }
  function userName() {
    try {
      if (global.SmartCore && typeof SmartCore.userName === "function") return SmartCore.userName();
      var a = JSON.parse(localStorage.getItem("smart_users_suite_brain") || "null");
      if (a && a.session) return a.session.name || a.session.user || "کاربر";
    } catch (e) {}
    return "کاربر";
  }
  function toast(msg, err) {
    if (global.SmartCore && SmartCore.toast) return SmartCore.toast(msg, !!err);
    var el = document.getElementById("sf-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "sf-toast";
      el.setAttribute("style", "position:fixed;bottom:14px;left:50%;transform:translateX(-50%);padding:9px 14px;border-radius:12px;font-weight:700;font-size:.8rem;z-index:10000;opacity:0;transition:.15s;font-family:Tahoma,sans-serif;color:#fff;pointer-events:none");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = err ? "#ef4444" : "#22c55e";
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.opacity = "0"; }, 2200);
  }
  function loadArr(key) {
    try {
      var a = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function saveArr(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr || [])); return true; }
    catch (e) { toast("ذخیره ناموفق", true); return false; }
  }
  function modules() {
    if (global.SmartCore && Array.isArray(SmartCore.MODULES) && SmartCore.MODULES.length) {
      return SmartCore.MODULES.map(function (m) { return { id: m.id, title: m.title || m.id }; });
    }
    return FALLBACK_MODULES.slice();
  }
  function titleOf(id) {
    var m = modules().find(function (x) { return x.id === id; });
    return (m && m.title) || id;
  }

  /* ----- Jalali helpers (minimal) ----- */
  function g2j(gy, gm, gd) {
    var g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var gy2 = gm > 2 ? gy + 1 : gy;
    var days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
    var jy = -1595 + 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    var jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    var jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
    return { jy: jy, jm: jm, jd: jd };
  }
  function toFa(n) {
    return String(n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[+d]; });
  }
  function todayJ() {
    var n = new Date();
    var j = g2j(n.getFullYear(), n.getMonth() + 1, n.getDate());
    return toFa(j.jy) + "/" + toFa(String(j.jm).padStart(2, "0")) + "/" + toFa(String(j.jd).padStart(2, "0"));
  }

  /* ----- CSS ----- */
  function injectCss() {
    if (document.getElementById("suite-facilities-css")) return;
    var st = document.createElement("style");
    st.id = "suite-facilities-css";
    st.textContent =
      ".sf{font-family:Tahoma,Segoe UI,sans-serif;text-align:right;color:#e2e8f0}" +
      ".sf .sf-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}" +
      ".sf .sf-head h3{margin:0;font-size:.9rem;color:#7dd3fc}" +
      ".sf .sf-card{background:#0f172a;border:1px solid #334155;border-radius:12px;padding:12px;margin-bottom:10px}" +
      ".sf label{display:block;font-size:.68rem;color:#94a3b8;margin:4px 0 2px}" +
      ".sf input,.sf select,.sf textarea{width:100%;padding:8px;border-radius:9px;border:1px solid #334155;background:#020617;color:#e2e8f0;font:inherit;font-size:12.5px;box-sizing:border-box}" +
      ".sf textarea{min-height:88px;resize:vertical}" +
      ".sf .sf-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
      ".sf .sf-row3{display:grid;grid-template-columns:1.2fr .8fr .7fr;gap:8px}" +
      "@media(max-width:720px){.sf .sf-row,.sf .sf-row3{grid-template-columns:1fr}}" +
      ".sf .sf-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;justify-content:flex-start}" +
      ".sf .sf-btn{border:0;border-radius:9px;padding:7px 12px;font:inherit;font-size:.72rem;font-weight:700;cursor:pointer}" +
      ".sf .sf-p{background:#0ea5e9;color:#fff}" +
      ".sf .sf-g{background:#334155;color:#e2e8f0}" +
      ".sf .sf-ok{background:#166534;color:#bbf7d0}" +
      ".sf .sf-warn{background:#854d0e;color:#fef3c7}" +
      ".sf .sf-b{background:#7f1d1d;color:#fecaca}" +
      ".sf .sf-item{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:10px 12px;margin:8px 0}" +
      ".sf .sf-item .t{font-weight:800;font-size:.78rem;margin-bottom:4px}" +
      ".sf .sf-item .m{font-size:.68rem;color:#94a3b8;line-height:1.85}" +
      ".sf .sf-item .a{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;padding-top:8px;border-top:1px solid #334155}" +
      ".sf .sf-badge{display:inline-block;border-radius:999px;padding:1px 8px;font-size:.62rem;margin-right:6px;background:#0ea5e9;color:#fff}" +
      ".sf .sf-badge.ok{background:#16a34a}.sf .sf-badge.muted{background:#475569}.sf .sf-badge.bad{background:#dc2626}.sf .sf-badge.warn{background:#ca8a04}" +
      ".sf .sf-empty{text-align:center;color:#64748b;font-size:.75rem;padding:14px}" +
      ".sf .sf-okbar{background:#14532d;border:1px solid #166534;color:#bbf7d0;border-radius:10px;padding:8px 10px;font-size:.72rem;margin:8px 0}" +
      ".sf .sf-hint{font-size:.68rem;color:#94a3b8;line-height:1.7;margin-top:6px}" +
      ".sf .sf-lists{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
      "@media(max-width:900px){.sf .sf-lists{grid-template-columns:1fr}}";
    document.head.appendChild(st);
  }

  /* ========== NOTES (local) ========== */
  function notesAll() { return loadArr(S.notesKey); }
  function notesSave(list) { return saveArr(S.notesKey, list); }
  function notesActive() {
    return notesAll().filter(function (x) { return x && !x.deleted && (x.status || "active") === "active"; });
  }
  function renderNotes() {
    var root = document.getElementById("sfNotesRoot");
    if (!root) return;
    var list = notesAll().filter(function (x) { return x && !x.deleted; });
    var html = list.length ? list.map(function (n) {
      var st = n.status || "active";
      var lab = st === "active" ? "فعال" : st === "saved" ? "ذخیره" : "ابطال";
      var cls = st === "active" ? "" : st === "saved" ? "ok" : "bad";
      return '<div class="sf-item" data-id="' + esc(n.id) + '">' +
        '<div class="t">' + esc((n.text || "").slice(0, 80) || "بدون متن") +
        ' <span class="sf-badge ' + cls + '">' + lab + '</span></div>' +
        '<div class="m">' + esc(n.text || "") + '<br>' +
        esc(n.by || "") + " · " + esc((n.at || "").replace("T", " ").slice(0, 16)) + '</div>' +
        '<div class="a">' +
        '<button type="button" class="sf-btn sf-ok" data-nact="active" data-id="' + esc(n.id) + '">فعال</button>' +
        '<button type="button" class="sf-btn sf-g" data-nact="saved" data-id="' + esc(n.id) + '">ذخیره</button>' +
        '<button type="button" class="sf-btn sf-b" data-nact="void" data-id="' + esc(n.id) + '">ابطال</button>' +
        '<button type="button" class="sf-btn sf-b" data-nact="del" data-id="' + esc(n.id) + '">حذف</button>' +
        '</div></div>';
    }).join("") : '<div class="sf-empty">یادداشتی نیست</div>';
    var box = root.querySelector("#sfNotesList");
    if (box) box.innerHTML = html;
    updateBadges();
  }
  function mountNotes() {
    var panel = document.getElementById("p-notes");
    if (!panel) return;
    var card = panel.querySelector(".card") || panel;
    var host = document.getElementById("sfNotesRoot");
    if (!host) {
      host = document.createElement("div");
      host.id = "sfNotesRoot";
      host.className = "sf";
      card.appendChild(host);
    }
    host.innerHTML =
      '<div class="sf-head"><h3>یادداشت</h3>' +
      '<button type="button" class="sf-btn sf-g" data-panel="p-dash">خروج</button></div>' +
      '<div class="sf-card">' +
      '<label>متن یادداشت</label><textarea id="sfNoteText" placeholder="یادداشت این ماژول (محلی)"></textarea>' +
      '<div class="sf-actions"><button type="button" class="sf-btn sf-p" id="sfNoteSave">ذخیره</button></div>' +
      '<div class="sf-hint">یادداشت‌ها فقط در ماژول «' + esc(S.moduleTitle) + '» ذخیره می‌شوند.</div></div>' +
      '<div class="sf-card"><div id="sfNotesList"></div></div>';
    host.querySelector("#sfNoteSave").onclick = function () {
      var t = (host.querySelector("#sfNoteText").value || "").trim();
      if (!t) return toast("متن خالی است", true);
      var list = notesAll();
      list.unshift({ id: uid(), text: t, status: "active", at: nowIso(), by: userName(), deleted: false });
      notesSave(list);
      host.querySelector("#sfNoteText").value = "";
      renderNotes();
      toast("یادداشت ذخیره شد");
    };
    host.addEventListener("click", function (e) {
      var b = e.target.closest("[data-nact]");
      if (!b) return;
      var id = b.getAttribute("data-id");
      var act = b.getAttribute("data-nact");
      var list = notesAll();
      list = list.map(function (n) {
        if (!n || n.id !== id) return n;
        if (act === "del") return Object.assign({}, n, { deleted: true, deletedAt: nowIso() });
        if (act === "active") return Object.assign({}, n, { status: "active" });
        if (act === "saved") return Object.assign({}, n, { status: "saved" });
        if (act === "void") return Object.assign({}, n, { status: "void" });
        return n;
      });
      notesSave(list);
      renderNotes();
    });
    renderNotes();
  }

  /* ========== REMINDERS (local) ========== */
  function remsAll() { return loadArr(S.remsKey); }
  function remsSave(list) { return saveArr(S.remsKey, list); }
  function remsOpenCount() {
    return remsAll().filter(function (x) {
      return x && !x.deleted && (x.status === "open" || x.status === "doing" || !x.status);
    }).length;
  }
  function renderRems() {
    var root = document.getElementById("sfRemsRoot");
    if (!root) return;
    var list = remsAll().filter(function (x) { return x && !x.deleted; });
    var html = list.length ? list.map(function (r) {
      var st = r.status || "open";
      var lab = { open: "در حال انجام", doing: "در حال انجام", done: "انجام شد", saved: "ذخیره", void: "ابطال" }[st] || st;
      var cls = st === "done" || st === "saved" ? "ok" : st === "void" ? "bad" : "warn";
      return '<div class="sf-item" data-id="' + esc(r.id) + '">' +
        '<div class="t">' + esc(r.title || "—") + ' <span class="sf-badge ' + cls + '">' + lab + '</span></div>' +
        '<div class="m">تاریخ: ' + esc(r.date || "—") + ' · ساعت: ' + esc(r.time || "—") +
        (r.note ? " · " + esc(r.note) : "") + '</div>' +
        '<div class="a">' +
        '<button type="button" class="sf-btn sf-warn" data-ract="doing" data-id="' + esc(r.id) + '">در حال انجام</button>' +
        '<button type="button" class="sf-btn sf-ok" data-ract="done" data-id="' + esc(r.id) + '">انجام شد</button>' +
        '<button type="button" class="sf-btn sf-g" data-ract="saved" data-id="' + esc(r.id) + '">ذخیره</button>' +
        '<button type="button" class="sf-btn sf-b" data-ract="void" data-id="' + esc(r.id) + '">ابطال</button>' +
        '</div></div>';
    }).join("") : '<div class="sf-empty">یادآوری ثبت نشده</div>';
    var box = root.querySelector("#sfRemsList");
    if (box) box.innerHTML = html;
    updateBadges();
  }
  function mountRems() {
    var panel = document.getElementById("p-rems");
    if (!panel) return;
    var card = panel.querySelector(".card") || panel;
    var host = document.getElementById("sfRemsRoot");
    if (!host) {
      host = document.createElement("div");
      host.id = "sfRemsRoot";
      host.className = "sf";
      card.appendChild(host);
    }
    host.innerHTML =
      '<div class="sf-head"><h3>یادآوری</h3>' +
      '<button type="button" class="sf-btn sf-g" data-panel="p-dash">خروج</button></div>' +
      '<div class="sf-card">' +
      '<div class="sf-row3">' +
      '<div><label>عنوان یادآوری</label><input id="sfRemTitle" placeholder="مثلاً جلسه مدیران"></div>' +
      '<div><label>تاریخ</label><input id="sfRemDate" value="' + todayJ() + '"></div>' +
      '<div><label>ساعت</label><input id="sfRemTime" placeholder="--:--"></div>' +
      '</div>' +
      '<label>توضیح</label><input id="sfRemNote" placeholder="اختیاری">' +
      '<div class="sf-actions"><button type="button" class="sf-btn sf-p" id="sfRemAdd">افزودن یادآوری</button></div>' +
      '<div class="sf-hint">یادآوری‌ها مختص ماژول «' + esc(S.moduleTitle) + '» هستند.</div></div>' +
      '<div class="sf-card"><div id="sfRemsList"></div></div>';
    host.querySelector("#sfRemAdd").onclick = function () {
      var title = (host.querySelector("#sfRemTitle").value || "").trim();
      if (!title) return toast("عنوان لازم است", true);
      var list = remsAll();
      list.unshift({
        id: uid(),
        title: title,
        date: (host.querySelector("#sfRemDate").value || "").trim(),
        time: (host.querySelector("#sfRemTime").value || "").trim(),
        note: (host.querySelector("#sfRemNote").value || "").trim(),
        status: "open",
        at: nowIso(),
        by: userName(),
        deleted: false
      });
      remsSave(list);
      host.querySelector("#sfRemTitle").value = "";
      host.querySelector("#sfRemNote").value = "";
      renderRems();
      toast("یادآوری افزوده شد");
    };
    host.addEventListener("click", function (e) {
      var b = e.target.closest("[data-ract]");
      if (!b) return;
      var id = b.getAttribute("data-id");
      var act = b.getAttribute("data-ract");
      var list = remsAll().map(function (r) {
        if (!r || r.id !== id) return r;
        return Object.assign({}, r, { status: act, updatedAt: nowIso() });
      });
      remsSave(list);
      renderRems();
    });
    renderRems();
  }

  /* ========== CARTABLE (global) ========== */
  function cartMeta() {
    try {
      var o = JSON.parse(localStorage.getItem(CART_META) || "{\"items\":[]}");
      if (!o || !Array.isArray(o.items)) return { items: [] };
      return o;
    } catch (e) { return { items: [] }; }
  }
  function cartSave(meta) {
    try { localStorage.setItem(CART_META, JSON.stringify(meta)); return true; }
    catch (e) { toast("ذخیره کارتابل ناموفق", true); return false; }
  }
  function openDb() {
    return new Promise(function (resolve, reject) {
      if (S.db) return resolve(S.db);
      if (!global.indexedDB) return reject(new Error("IndexedDB نیست"));
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (ev) {
        var db = ev.target.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = function (ev) { S.db = ev.target.result; resolve(S.db); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function idbPut(rec) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(rec);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function idbGet(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }
  function idbDel(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      });
    });
  }
  function cartInbox() {
    return cartMeta().items.filter(function (x) {
      return x && !x.deleted && x.to === S.moduleId;
    });
  }
  function cartOutbox() {
    return cartMeta().items.filter(function (x) {
      return x && !x.deleted && x.from === S.moduleId;
    });
  }
  function cartActiveIn() {
    return cartInbox().filter(function (x) { return (x.status || "active") === "active"; }).length;
  }
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return resolve(null);
      if (file.size > MAX_BYTES) return reject(new Error("سقف حجم ۲٫۵ مگابایت"));
      var fr = new FileReader();
      fr.onload = function () {
        resolve({ name: file.name, type: file.type || "application/octet-stream", size: file.size, dataUrl: fr.result });
      };
      fr.onerror = function () { reject(new Error("خواندن فایل ناموفق")); };
      fr.readAsDataURL(file);
    });
  }
  function renderCart() {
    var root = document.getElementById("sfCartRoot");
    if (!root) return;
    var out = cartOutbox().sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); });
    var inn = cartInbox().sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); });

    function item(it, role) {
      var st = it.status || "active";
      var lab = st === "saved" ? "ذخیره" : st === "void" ? "ابطال" : "فعال";
      var cls = st === "saved" ? "ok" : st === "void" ? "bad" : "";
      var when = (it.createdAt || "").replace("T", " ").slice(0, 16);
      var h = '<div class="sf-item" data-id="' + esc(it.id) + '">' +
        '<div class="t">' + esc(it.subject || "—") + ' <span class="sf-badge ' + cls + '">' + lab + '</span></div>' +
        '<div class="m">';
      if (role === "out") {
        h += "مقصد: " + esc(it.toTitle || it.to) + " · تاریخ ارسال: " + esc(it.date || when);
      } else {
        h += "فرستنده: " + esc(it.fromTitle || it.from) + " · " + esc(it.createdBy || "") + " · " + esc(it.date || when);
      }
      if (it.hasFile) h += " · فایل: " + esc(it.fileName || "") + " · " + (it.fileSize || 0) + " بایت";
      if (it.body) h += "<br>" + esc(it.body).slice(0, 200);
      h += '</div><div class="a">';
      if (it.hasFile) h += '<button type="button" class="sf-btn sf-p" data-cact="dl" data-id="' + esc(it.id) + '">دریافت فایل</button>';
      if (role === "in") {
        h += '<button type="button" class="sf-btn sf-ok" data-cact="active" data-id="' + esc(it.id) + '">فعال</button>';
        h += '<button type="button" class="sf-btn sf-g" data-cact="saved" data-id="' + esc(it.id) + '">ذخیره</button>';
        h += '<button type="button" class="sf-btn sf-b" data-cact="del" data-id="' + esc(it.id) + '">حذف از دریافتی</button>';
      } else {
        h += '<button type="button" class="sf-btn sf-b" data-cact="del" data-id="' + esc(it.id) + '">حذف</button>';
      }
      h += "</div></div>";
      return h;
    }

    var outEl = root.querySelector("#sfCartOut");
    var inEl = root.querySelector("#sfCartIn");
    if (outEl) outEl.innerHTML = out.length ? out.map(function (x) { return item(x, "out"); }).join("") : '<div class="sf-empty">ارسالی نیست</div>';
    if (inEl) inEl.innerHTML = inn.length ? inn.map(function (x) { return item(x, "in"); }).join("") : '<div class="sf-empty">دریافتی نیست</div>';
    updateBadges();
  }
  function mountCart() {
    var panel = document.getElementById("p-cartable");
    if (!panel) return;
    var card = panel.querySelector(".card") || panel;
    var host = document.getElementById("sfCartRoot");
    if (!host) {
      host = document.createElement("div");
      host.id = "sfCartRoot";
      host.className = "sf";
      card.appendChild(host);
    }
    var opts = modules().filter(function (m) { return m.id !== S.moduleId; })
      .map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.title) + "</option>"; }).join("");

    host.innerHTML =
      '<div class="sf-head"><h3>کارتابل مشترک</h3>' +
      '<button type="button" class="sf-btn sf-g" data-panel="p-dash">خروج</button></div>' +
      '<div class="sf-card">' +
      "<h3 style=\"margin:0 0 8px;font-size:.82rem;color:#93c5fd\">ارسال فایل</h3>" +
      '<div class="sf-row">' +
      '<div><label>عنوان</label><input id="sfCartSubject" placeholder="عنوان فایل یا درخواست"></div>' +
      '<div><label>تاریخ</label><input id="sfCartDate" value="' + todayJ() + '"></div>' +
      '</div>' +
      '<div class="sf-row">' +
      '<div><label>ارسال به ماژول</label><select id="sfCartTo">' + opts + '</select></div>' +
      '<div><label>انتخاب فایل از رایانه</label><input id="sfCartFile" type="file"></div>' +
      '</div>' +
      '<label>توضیح</label><input id="sfCartBody" placeholder="اختیاری">' +
      '<div class="sf-actions"><button type="button" class="sf-btn sf-p" id="sfCartSend">ارسال فایل</button>' +
      '<button type="button" class="sf-btn sf-g" id="sfCartRefresh">بروزرسانی</button></div>' +
      '<div class="sf-okbar" id="sfCartMsg" style="display:none"></div>' +
      '<div class="sf-hint">کارتابل سراسری است. سقف حجم هر فایل ۲٫۵MB. برای مشاهده در مقصد، ماژول مقصد هم باید این کیت را داشته باشد.</div></div>' +
      '<div class="sf-lists">' +
      '<div class="sf-card"><h3 style="margin:0 0 8px;font-size:.82rem;color:#93c5fd">فهرست فایل‌های ارسالی</h3><div id="sfCartOut"></div></div>' +
      '<div class="sf-card"><h3 style="margin:0 0 8px;font-size:.82rem;color:#93c5fd">فهرست فایل‌های دریافتی</h3><div id="sfCartIn"></div></div>' +
      '</div>';

    host.querySelector("#sfCartSend").onclick = function () {
      var to = host.querySelector("#sfCartTo").value;
      var subject = (host.querySelector("#sfCartSubject").value || "").trim();
      var body = (host.querySelector("#sfCartBody").value || "").trim();
      var date = (host.querySelector("#sfCartDate").value || "").trim();
      var fileInput = host.querySelector("#sfCartFile");
      var file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      if (!to) return toast("گیرنده را انتخاب کنید", true);
      if (!subject && !file) return toast("عنوان یا فایل لازم است", true);

      readFile(file).then(function (frec) {
        var id = uid();
        var item = {
          id: id,
          from: S.moduleId,
          fromTitle: S.moduleTitle,
          to: to,
          toTitle: titleOf(to),
          subject: subject || (frec ? frec.name : "بدون عنوان"),
          body: body,
          date: date,
          status: "active",
          hasFile: !!frec,
          fileName: frec ? frec.name : "",
          fileType: frec ? frec.type : "",
          fileSize: frec ? frec.size : 0,
          createdAt: nowIso(),
          createdBy: userName(),
          deleted: false
        };
        var p = Promise.resolve();
        if (frec) {
          p = idbPut({ id: id, name: frec.name, type: frec.type, size: frec.size, dataUrl: frec.dataUrl, savedAt: nowIso() });
        }
        return p.then(function () {
          var meta = cartMeta();
          meta.items.unshift(item);
          if (meta.items.length > 800) meta.items = meta.items.slice(0, 800);
          cartSave(meta);
          try { localStorage.setItem("suite_cartable_ping", String(Date.now())); } catch (e) {}
          host.querySelector("#sfCartSubject").value = "";
          host.querySelector("#sfCartBody").value = "";
          fileInput.value = "";
          var msg = host.querySelector("#sfCartMsg");
          msg.style.display = "block";
          msg.textContent = "فایل در فهرست ارسالی ثبت شد. دریافت آن باید در ماژول مقصد بررسی شود.";
          renderCart();
          toast("ارسال شد");
        });
      }).catch(function (err) { toast((err && err.message) || "خطا", true); });
    };

    host.querySelector("#sfCartRefresh").onclick = function () { renderCart(); toast("بروزرسانی شد"); };

    host.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cact]");
      if (!b) return;
      var id = b.getAttribute("data-id");
      var act = b.getAttribute("data-cact");
      if (act === "dl") {
        idbGet(id).then(function (rec) {
          if (!rec || !rec.dataUrl) return toast("فایل موجود نیست", true);
          var a = document.createElement("a");
          a.href = rec.dataUrl;
          a.download = rec.name || "file";
          document.body.appendChild(a);
          a.click();
          a.remove();
        });
        return;
      }
      var meta = cartMeta();
      meta.items = (meta.items || []).map(function (it) {
        if (!it || it.id !== id) return it;
        if (act === "del") return Object.assign({}, it, { deleted: true, deletedAt: nowIso() });
        if (act === "active" || act === "saved") return Object.assign({}, it, { status: act, updatedAt: nowIso() });
        return it;
      });
      cartSave(meta);
      if (act === "del") idbDel(id);
      renderCart();
    });

    openDb().then(function () { renderCart(); }).catch(function () { renderCart(); });
  }

  /* ========== badges ========== */
  function updateBadges() {
    var nN = notesActive().length;
    var nR = remsOpenCount();
    var nC = cartActiveIn();
    function setAlert(label, n) {
      var alerts = document.querySelectorAll(".alerts .alert, .alert");
      alerts.forEach(function (el) {
        var t = (el.textContent || "").replace(/\d+/g, "").trim();
        if (t.indexOf(label) !== -1) {
          var num = el.querySelector(".n");
          if (num) num.textContent = String(n);
        }
      });
    }
    setAlert("یادداشت", nN);
    setAlert("یادآوری", nR);
    setAlert("کارتابل", nC);
  }

  function hideOldPanelNoise(panelId) {
    var p = document.getElementById(panelId);
    if (!p) return;
    /* محتوای قبلی داخل کارت را مخفی می‌کنیم تا دوبل نشود؛ exit را نگه می‌داریم */
    var card = p.querySelector(".card");
    if (!card) return;
    Array.prototype.forEach.call(card.children, function (ch) {
      if (ch.id === "sfNotesRoot" || ch.id === "sfRemsRoot" || ch.id === "sfCartRoot") return;
      if (ch.classList && ch.classList.contains("btn-form-exit")) return;
      ch.style.display = "none";
    });
  }

  function init(opts) {
    opts = opts || {};
    S.moduleId = String(opts.moduleId || opts.mod || global.MOD || "cashbox");
    S.moduleTitle = String(opts.moduleTitle || titleOf(S.moduleId));
    S.notesKey = "smart_mod_notes_" + S.moduleId;
    S.remsKey = "smart_mod_rem_" + S.moduleId;

    injectCss();
    hideOldPanelNoise("p-notes");
    hideOldPanelNoise("p-rems");
    hideOldPanelNoise("p-cartable");
    mountNotes();
    mountRems();
    mountCart();
    updateBadges();

    window.addEventListener("storage", function (ev) {
      if (ev && (ev.key === CART_META || ev.key === "suite_cartable_ping")) {
        renderCart();
        var n = cartActiveIn();
        if (n > S.lastCartIn) toast("فایل جدید در کارتابل");
        S.lastCartIn = n;
      }
    });
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-panel]");
      if (!t) return;
      var id = t.getAttribute("data-panel");
      if (id === "p-notes") setTimeout(renderNotes, 20);
      if (id === "p-rems") setTimeout(renderRems, 20);
      if (id === "p-cartable") setTimeout(renderCart, 20);
    });

    S.lastCartIn = cartActiveIn();
    return api;
  }

  var api = {
    init: init,
    renderNotes: renderNotes,
    renderRems: renderRems,
    renderCart: renderCart,
    updateBadges: updateBadges
  };
  global.SuiteFacilities = api;

  try {
    var sc = document.currentScript;
    if (sc && sc.getAttribute("data-module")) {
      init({ moduleId: sc.getAttribute("data-module"), moduleTitle: sc.getAttribute("data-title") || "" });
    }
  } catch (e) {}
})(window);
