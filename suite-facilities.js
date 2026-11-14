/**
 * suite-facilities.js v2
 * یادداشت + یادآوری (محلی) + کارتابل سراسری (ماژول + کاربر)
 * تقویم شمسی · شناسه یکتا · بدون eval
 *
 * اتصال (بدون تغییر ساختار UI ماژول):
 *   <script src="core.js"></script>
 *   <script src="suite-facilities.js" data-module="bank" data-title="بانک"></script>
 * CSP پیشنهادی: script-src 'self' 'unsafe-inline'
 */
(function (global) {
  "use strict";

  var CART_KEY = "suite_cartable_v1";
  var MAX_BYTES = 2.5 * 1024 * 1024;
  var SEQ = 0;
  var JM = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
  var JW = ["شنبه","یکشنبه","دوشنبه","سه شنبه","چهارشنبه","پنجشنبه","جمعه"];

  var FALLBACK_MODULES = [
    { id: "accounting", title: "حسابداری" }, { id: "bank", title: "بانک" },
    { id: "cashbox", title: "صندوق" }, { id: "pettycash", title: "تنخواه" },
    { id: "sales", title: "فروش" }, { id: "purchase", title: "خرید" },
    { id: "warehouse", title: "انبار" }, { id: "payroll", title: "حقوق" },
    { id: "personnel", title: "پرسنلی" }, { id: "secretariat", title: "دبیرخانه" },
    { id: "secretary", title: "منشی" }, { id: "ceo", title: "مدیرعامل" },
    { id: "manager", title: "مدیریت" }, { id: "customers", title: "مشتریان" },
    { id: "contracts", title: "قراردادها" }, { id: "archive", title: "بایگانی" },
    { id: "correspondence", title: "مکاتبات" }, { id: "tax", title: "مالیات" },
    { id: "budget", title: "بودجه" }, { id: "audit", title: "حسابرسی" },
    { id: "fixedassets", title: "دارایی ثابت" }, { id: "production", title: "تولید" },
    { id: "projects", title: "پروژه" }, { id: "fleet", title: "ناوگان" },
    { id: "lawyer", title: "وکیل" }, { id: "assistant", title: "دستیار" },
    { id: "chat", title: "چت" }, { id: "meeting", title: "متینگ" },
    { id: "filehub", title: "هاب فایل" }, { id: "sysadmin", title: "مدیر سیستم" }
  ];

  var S = { moduleId: "cashbox", moduleTitle: "صندوق", notesKey: "", remsKey: "", lastIn: 0 };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&" + "amp;")
      .replace(/</g, "&" + "lt;")
      .replace(/>/g, "&" + "gt;")
      .replace(/"/g, "&" + "quot;")
      .replace(/'/g, "&#39;");
  }
  function uid() {
    SEQ += 1;
    return "sf_" + Date.now().toString(36) + "_" + SEQ.toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }
  function nowIso() { return new Date().toISOString(); }
  function toast(msg, err) {
    if (global.SmartCore && typeof SmartCore.toast === "function") return SmartCore.toast(msg, !!err);
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
  function listUsers() {
    var out = [];
    try {
      if (global.SmartCore && typeof SmartCore.getAuth === "function") {
        var a = SmartCore.getAuth();
        if (a && Array.isArray(a.users)) {
          a.users.forEach(function (u) {
            if (u && u.user) out.push({ user: String(u.user), name: String(u.name || u.user) });
          });
        }
      }
    } catch (e) {}
    if (!out.length) {
      try {
        var b = JSON.parse(localStorage.getItem("smart_users_suite_brain") || "null");
        if (b && Array.isArray(b.users)) {
          b.users.forEach(function (u) {
            if (u && u.user) out.push({ user: String(u.user), name: String(u.name || u.user) });
          });
        }
      } catch (e2) {}
    }
    if (!out.length) out = [{ user: "admin", name: "مدیر" }];
    return out;
  }
  function currentUser() {
    try {
      if (global.SmartCore && typeof SmartCore.getAuth === "function") {
        var a = SmartCore.getAuth();
        if (a && a.session && a.session.user) return String(a.session.user);
      }
    } catch (e) {}
    try {
      var b = JSON.parse(localStorage.getItem("smart_users_suite_brain") || "null");
      if (b && b.session && b.session.user) return String(b.session.user);
    } catch (e2) {}
    return "admin";
  }
  function currentUserName() {
    try {
      if (global.SmartCore && typeof SmartCore.userName === "function") return SmartCore.userName();
    } catch (e) {}
    var u = currentUser();
    var f = listUsers().find(function (x) { return x.user === u; });
    return (f && f.name) || u;
  }

  /* Jalali */
  function g2j(gy, gm, gd) {
    var g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var gy2 = gm > 2 ? gy + 1 : gy;
    var days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
    var jy = -1595 + 33 * Math.floor(days / 12053);
    days %= 12053; jy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    var jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    var jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
    return { jy: jy, jm: jm, jd: jd };
  }
  function j2g(jy, jm, jd) {
    var jy2 = jy - 979, jm2 = jm - 1, jd2 = jd - 1;
    var days = 365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4);
    for (var i = 0; i < jm2; ++i) days += i < 6 ? 31 : 30;
    days += jd2;
    var gy = 1600 + 400 * Math.floor(days / 146097); days %= 146097; var leap = true;
    if (days >= 36525) { days--; gy += 100 * Math.floor(days / 36524); days %= 36524; if (days >= 365) leap = false; else days++; }
    gy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days >= 366) { leap = false; days--; gy += Math.floor(days / 365); days %= 365; }
    var gd = days + 1, sal_a = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], gm;
    for (gm = 1; gm <= 12 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
    return { gy: gy, gm: gm, gd: gd };
  }
  function jML(jy, jm) {
    if (jm <= 6) return 31; if (jm <= 11) return 30;
    var a = j2g(jy, 12, 30), b = g2j(a.gy, a.gm, a.gd);
    return b.jy === jy && b.jm === 12 && b.jd === 30 ? 30 : 29;
  }
  function toFa(n) { return String(n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[+d]; }); }
  function toEn(s) { return String(s).replace(/[۰-۹]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(d); }); }
  function fmtJ(jy, jm, jd) { return toFa(jy) + "/" + toFa(String(jm).padStart(2, "0")) + "/" + toFa(String(jd).padStart(2, "0")); }
  function todayJ() {
    var n = new Date(), j = g2j(n.getFullYear(), n.getMonth() + 1, n.getDate());
    return fmtJ(j.jy, j.jm, j.jd);
  }
  function attachJDate(input) {
    if (!input || input._sfj) return;
    input._sfj = true;
    input.readOnly = true;
    if (!input.value) input.value = todayJ();
    var wrap = input.parentNode;
    if (!wrap.classList.contains("sf-date-wrap")) {
      var d = document.createElement("div");
      d.className = "sf-date-wrap";
      wrap.insertBefore(d, input);
      d.appendChild(input);
      wrap = d;
    }
    var pop = null, vy, vm;
    function close() { if (pop) { pop.remove(); pop = null; } document.removeEventListener("click", outside); }
    function outside(e) { if (pop && !pop.contains(e.target) && e.target !== input) close(); }
    function open() {
      close();
      var n = new Date(), j = g2j(n.getFullYear(), n.getMonth() + 1, n.getDate());
      var m = toEn(input.value || "").match(/^(\d{4})[\/\-](\d{1,2})/);
      vy = m ? +m[1] : j.jy; vm = m ? +m[2] : j.jm;
      pop = document.createElement("div"); pop.className = "sf-jcal"; wrap.appendChild(pop);
      render();
      setTimeout(function () { document.addEventListener("click", outside); }, 0);
    }
    function render() {
      if (!pop) return; pop.innerHTML = "";
      var h = document.createElement("div"); h.className = "sf-jcal-h";
      h.innerHTML = '<button type="button" data-a="py">«</button><button type="button" data-a="pm">‹</button><span class="ttl">' + JM[vm - 1] + " " + toFa(vy) + '</span><button type="button" data-a="nm">›</button><button type="button" data-a="ny">»</button>';
      var w = document.createElement("div"); w.className = "sf-jcal-w";
      JW.forEach(function (x) { var s = document.createElement("span"); s.textContent = x; w.appendChild(s); });
      var days = document.createElement("div"); days.className = "sf-jcal-d";
      var dim = jML(vy, vm), fg = j2g(vy, vm, 1), st = (new Date(fg.gy, fg.gm - 1, fg.gd).getDay() + 1) % 7, i, day;
      for (i = 0; i < st; i++) { var em = document.createElement("button"); em.type = "button"; em.disabled = true; em.style.visibility = "hidden"; days.appendChild(em); }
      for (day = 1; day <= dim; day++) {
        (function (d0) {
          var b = document.createElement("button"); b.type = "button"; b.textContent = toFa(d0);
          b.onclick = function (ev) { ev.stopPropagation(); input.value = fmtJ(vy, vm, d0); close(); };
          days.appendChild(b);
        })(day);
      }
      pop.appendChild(h); pop.appendChild(w); pop.appendChild(days);
      h.querySelectorAll("button").forEach(function (b) {
        b.onclick = function (ev) {
          ev.stopPropagation();
          var a = b.getAttribute("data-a");
          if (a === "pm") { vm--; if (vm < 1) { vm = 12; vy--; } }
          if (a === "nm") { vm++; if (vm > 12) { vm = 1; vy++; } }
          if (a === "py") vy--; if (a === "ny") vy++;
          render();
        };
      });
    }
    input.addEventListener("click", open);
    input.addEventListener("focus", open);
  }

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
      ".sf .sf-row3{display:grid;grid-template-columns:1.2fr .9fr .7fr;gap:8px}" +
      "@media(max-width:720px){.sf .sf-row,.sf .sf-row3{grid-template-columns:1fr}}" +
      ".sf .sf-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}" +
      ".sf .sf-btn{border:0;border-radius:9px;padding:7px 12px;font:inherit;font-size:.72rem;font-weight:700;cursor:pointer}" +
      ".sf .sf-p{background:#0ea5e9;color:#fff}.sf .sf-g{background:#334155;color:#e2e8f0}" +
      ".sf .sf-ok{background:#166534;color:#bbf7d0}.sf .sf-warn{background:#854d0e;color:#fef3c7}.sf .sf-b{background:#7f1d1d;color:#fecaca}" +
      ".sf .sf-item{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:10px 12px;margin:8px 0}" +
      ".sf .sf-item .t{font-weight:800;font-size:.78rem;margin-bottom:4px}" +
      ".sf .sf-item .m{font-size:.68rem;color:#94a3b8;line-height:1.85}" +
      ".sf .sf-item .a{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;padding-top:8px;border-top:1px solid #334155}" +
      ".sf .sf-badge{display:inline-block;border-radius:999px;padding:1px 8px;font-size:.62rem;margin-right:6px;background:#0ea5e9;color:#fff}" +
      ".sf .sf-badge.ok{background:#16a34a}.sf .sf-badge.bad{background:#dc2626}.sf .sf-badge.warn{background:#ca8a04}" +
      ".sf .sf-empty{text-align:center;color:#64748b;font-size:.75rem;padding:14px}" +
      ".sf .sf-okbar{background:#14532d;border:1px solid #166534;color:#bbf7d0;border-radius:10px;padding:8px 10px;font-size:.72rem;margin:8px 0;display:none}" +
      ".sf .sf-hint{font-size:.68rem;color:#94a3b8;line-height:1.7;margin-top:6px}" +
      ".sf .sf-lists{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
      "@media(max-width:900px){.sf .sf-lists{grid-template-columns:1fr}}" +
      ".sf-date-wrap{position:relative}" +
      ".sf-jcal{position:absolute;z-index:80;right:0;top:calc(100% + 4px);background:#1e293b;border:1px solid #334155;border-radius:12px;padding:10px;width:280px;box-shadow:0 12px 28px rgba(0,0,0,.45)}" +
      ".sf-jcal-h{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:6px}" +
      ".sf-jcal-h button{width:28px;height:28px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;cursor:pointer}" +
      ".sf-jcal-h .ttl{flex:1;text-align:center;font-size:.78rem;font-weight:800;color:#7dd3fc}" +
      ".sf-jcal-w,.sf-jcal-d{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}" +
      ".sf-jcal-w span{text-align:center;font-size:.55rem;color:#94a3b8}" +
      ".sf-jcal-d button{border:0;background:transparent;color:#e2e8f0;border-radius:8px;min-height:32px;cursor:pointer;font:inherit;font-size:.75rem}" +
      ".sf-jcal-d button:hover{background:rgba(14,165,233,.25)}";
    document.head.appendChild(st);
  }

  function hideOld(panelId, keepId) {
    var p = document.getElementById(panelId);
    if (!p) return;
    var card = p.querySelector(".card") || p;
    Array.prototype.forEach.call(card.children, function (ch) {
      if (ch.id === keepId) return;
      if (ch.classList && ch.classList.contains("btn-form-exit")) return;
      ch.style.display = "none";
    });
  }

  /* Notes */
  function notesAll() { return loadArr(S.notesKey); }
  function renderNotes() {
    var root = document.getElementById("sfNotesRoot"); if (!root) return;
    var list = notesAll().filter(function (x) { return x && !x.deleted; });
    var box = root.querySelector("#sfNotesList"); if (!box) return;
    box.innerHTML = list.length ? list.map(function (n) {
      var st = n.status || "active";
      var lab = st === "active" ? "فعال" : st === "saved" ? "ذخیره" : "ابطال";
      var cls = st === "saved" ? "ok" : st === "void" ? "bad" : "";
      return '<div class="sf-item"><div class="t">' + esc((n.text || "").slice(0, 80) || "—") +
        ' <span class="sf-badge ' + cls + '">' + lab + '</span></div><div class="m">' +
        esc(n.text || "") + "<br>" + esc(n.by || "") + " · " + esc((n.at || "").replace("T", " ").slice(0, 16)) +
        '</div><div class="a">' +
        '<button type="button" class="sf-btn sf-ok" data-nact="active" data-id="' + esc(n.id) + '">فعال</button>' +
        '<button type="button" class="sf-btn sf-g" data-nact="saved" data-id="' + esc(n.id) + '">ذخیره</button>' +
        '<button type="button" class="sf-btn sf-b" data-nact="void" data-id="' + esc(n.id) + '">ابطال</button>' +
        '<button type="button" class="sf-btn sf-b" data-nact="del" data-id="' + esc(n.id) + '">حذف</button></div></div>';
    }).join("") : '<div class="sf-empty">یادداشتی نیست</div>';
    updateBadges();
  }
  function mountNotes() {
    var panel = document.getElementById("p-notes"); if (!panel) return;
    var card = panel.querySelector(".card") || panel;
    hideOld("p-notes", "sfNotesRoot");
    var host = document.getElementById("sfNotesRoot");
    if (!host) { host = document.createElement("div"); host.id = "sfNotesRoot"; host.className = "sf"; card.appendChild(host); }
    host.innerHTML =
      '<div class="sf-head"><h3>یادداشت</h3></div><div class="sf-card">' +
      '<label>متن یادداشت</label><textarea id="sfNoteText"></textarea>' +
      '<div class="sf-actions"><button type="button" class="sf-btn sf-p" id="sfNoteSave">ذخیره</button></div>' +
      '<div class="sf-hint">محلی ماژول «' + esc(S.moduleTitle) + '»</div></div><div class="sf-card"><div id="sfNotesList"></div></div>';
    host.querySelector("#sfNoteSave").onclick = function () {
      var t = (host.querySelector("#sfNoteText").value || "").trim();
      if (!t) return toast("متن خالی است", true);
      var list = notesAll();
      list.unshift({ id: uid(), text: t, status: "active", at: nowIso(), by: currentUserName(), deleted: false });
      saveArr(S.notesKey, list);
      host.querySelector("#sfNoteText").value = "";
      renderNotes(); toast("یادداشت ذخیره شد");
    };
    host.onclick = function (e) {
      var b = e.target.closest("[data-nact]"); if (!b) return;
      var id = b.getAttribute("data-id"), act = b.getAttribute("data-nact");
      var list = notesAll().map(function (n) {
        if (!n || n.id !== id) return n;
        if (act === "del") return Object.assign({}, n, { deleted: true });
        return Object.assign({}, n, { status: act });
      });
      saveArr(S.notesKey, list); renderNotes();
    };
    renderNotes();
  }

  /* Reminders */
  function remsAll() { return loadArr(S.remsKey); }
  function renderRems() {
    var root = document.getElementById("sfRemsRoot"); if (!root) return;
    var list = remsAll().filter(function (x) { return x && !x.deleted; });
    var box = root.querySelector("#sfRemsList"); if (!box) return;
    box.innerHTML = list.length ? list.map(function (r) {
      var st = r.status || "open";
      var lab = { open: "در حال انجام", doing: "در حال انجام", done: "انجام شد", saved: "ذخیره", void: "ابطال" }[st] || st;
      var cls = (st === "done" || st === "saved") ? "ok" : st === "void" ? "bad" : "warn";
      return '<div class="sf-item"><div class="t">' + esc(r.title || "—") +
        ' <span class="sf-badge ' + cls + '">' + lab + '</span></div><div class="m">تاریخ: ' +
        esc(r.date || "—") + " · ساعت: " + esc(r.time || "—") + (r.note ? " · " + esc(r.note) : "") +
        '</div><div class="a">' +
        '<button type="button" class="sf-btn sf-warn" data-ract="doing" data-id="' + esc(r.id) + '">در حال انجام</button>' +
        '<button type="button" class="sf-btn sf-ok" data-ract="done" data-id="' + esc(r.id) + '">انجام شد</button>' +
        '<button type="button" class="sf-btn sf-g" data-ract="saved" data-id="' + esc(r.id) + '">ذخیره</button>' +
        '<button type="button" class="sf-btn sf-b" data-ract="void" data-id="' + esc(r.id) + '">ابطال</button></div></div>';
    }).join("") : '<div class="sf-empty">یادآوری ثبت نشده</div>';
    updateBadges();
  }
  function mountRems() {
    var panel = document.getElementById("p-rems"); if (!panel) return;
    var card = panel.querySelector(".card") || panel;
    hideOld("p-rems", "sfRemsRoot");
    var host = document.getElementById("sfRemsRoot");
    if (!host) { host = document.createElement("div"); host.id = "sfRemsRoot"; host.className = "sf"; card.appendChild(host); }
    host.innerHTML =
      '<div class="sf-head"><h3>یادآوری</h3></div><div class="sf-card"><div class="sf-row3">' +
      '<div><label>عنوان</label><input id="sfRemTitle"></div>' +
      '<div><label>تاریخ</label><input id="sfRemDate" class="sf-jdate"></div>' +
      '<div><label>ساعت</label><input id="sfRemTime" placeholder="--:--"></div></div>' +
      '<label>توضیح</label><input id="sfRemNote">' +
      '<div class="sf-actions"><button type="button" class="sf-btn sf-p" id="sfRemAdd">افزودن یادآوری</button></div>' +
      '<div class="sf-hint">روی تاریخ کلیک کنید تا تقویم شمسی باز شود.</div></div><div class="sf-card"><div id="sfRemsList"></div></div>';
    attachJDate(host.querySelector("#sfRemDate"));
    host.querySelector("#sfRemAdd").onclick = function () {
      var title = (host.querySelector("#sfRemTitle").value || "").trim();
      if (!title) return toast("عنوان لازم است", true);
      var list = remsAll();
      list.unshift({
        id: uid(), title: title,
        date: (host.querySelector("#sfRemDate").value || "").trim(),
        time: (host.querySelector("#sfRemTime").value || "").trim(),
        note: (host.querySelector("#sfRemNote").value || "").trim(),
        status: "open", at: nowIso(), by: currentUserName(), deleted: false
      });
      saveArr(S.remsKey, list);
      host.querySelector("#sfRemTitle").value = "";
      host.querySelector("#sfRemNote").value = "";
      renderRems(); toast("یادآوری ثبت شد");
    };
    host.onclick = function (e) {
      var b = e.target.closest("[data-ract]"); if (!b) return;
      var id = b.getAttribute("data-id"), act = b.getAttribute("data-ract");
      var list = remsAll().map(function (r) {
        if (!r || r.id !== id) return r;
        return Object.assign({}, r, { status: act });
      });
      saveArr(S.remsKey, list); renderRems();
    };
    renderRems();
  }

  /* Cartable */
  function cartMeta() {
    try {
      var o = JSON.parse(localStorage.getItem(CART_KEY) || "{\"items\":[]}");
      if (!o || !Array.isArray(o.items)) return { items: [] };
      return o;
    } catch (e) { return { items: [] }; }
  }
  function cartSave(meta) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(meta)); return true; }
    catch (e) { toast("ذخیره کارتابل ناموفق", true); return false; }
  }
  function inbox() {
    var me = currentUser();
    return (cartMeta().items || []).filter(function (x) {
      if (!x || x.deleted || x.to !== S.moduleId) return false;
      var tu = x.toUser || "*";
      return tu === "*" || tu === "" || tu === me;
    });
  }
  function outbox() {
    return (cartMeta().items || []).filter(function (x) {
      return x && !x.deleted && x.from === S.moduleId;
    });
  }
  function renderCart() {
    var root = document.getElementById("sfCartRoot"); if (!root) return;
    var out = outbox().sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); });
    var inn = inbox().sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); });
    function item(it, role) {
      var st = it.status || "active";
      var lab = st === "saved" ? "ذخیره" : "فعال";
      var h = '<div class="sf-item"><div class="t">' + esc(it.subject || "—") +
        ' <span class="sf-badge">' + lab + '</span></div><div class="m">';
      if (role === "out") h += "به: " + esc(it.toTitle || it.to) + " / " + esc(it.toUserName || it.toUser || "همه");
      else h += "از: " + esc(it.fromTitle || it.from) + " / " + esc(it.fromUserName || it.fromUser || "—");
      h += " · " + esc((it.createdAt || "").replace("T", " ").slice(0, 16));
      if (it.date) h += " · " + esc(it.date);
      if (it.fileName) h += " · فایل: " + esc(it.fileName);
      if (it.body) h += "<br>" + esc(it.body).slice(0, 180);
      h += '</div><div class="a">';
      if (it.dataUrl) h += '<button type="button" class="sf-btn sf-p" data-cact="dl" data-id="' + esc(it.id) + '">دریافت فایل</button>';
      if (role === "in") {
        h += '<button type="button" class="sf-btn sf-ok" data-cact="active" data-id="' + esc(it.id) + '">فعال</button>';
        h += '<button type="button" class="sf-btn sf-g" data-cact="saved" data-id="' + esc(it.id) + '">ذخیره</button>';
      }
      h += '<button type="button" class="sf-btn sf-b" data-cact="del" data-id="' + esc(it.id) + '">حذف</button></div></div>';
      return h;
    }
    var outEl = root.querySelector("#sfCartOut");
    var inEl = root.querySelector("#sfCartIn");
    if (outEl) outEl.innerHTML = out.length ? out.map(function (x) { return item(x, "out"); }).join("") : '<div class="sf-empty">ارسالی نیست</div>';
    if (inEl) inEl.innerHTML = inn.length ? inn.map(function (x) { return item(x, "in"); }).join("") : '<div class="sf-empty">دریافتی نیست</div>';
    updateBadges();
  }
  function mountCart() {
    var panel = document.getElementById("p-cartable"); if (!panel) return;
    var card = panel.querySelector(".card") || panel;
    hideOld("p-cartable", "sfCartRoot");
    var host = document.getElementById("sfCartRoot");
    if (!host) { host = document.createElement("div"); host.id = "sfCartRoot"; host.className = "sf"; card.appendChild(host); }
    var modOpts = modules().filter(function (m) { return m.id !== S.moduleId; })
      .map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.title) + "</option>"; }).join("");
    var userOpts = '<option value="*">همه کاربران ماژول مقصد</option>' +
      listUsers().map(function (u) {
        return '<option value="' + esc(u.user) + '">' + esc(u.name + " (" + u.user + ")") + "</option>";
      }).join("");
    host.innerHTML =
      '<div class="sf-head"><h3>کارتابل مشترک</h3></div><div class="sf-card">' +
      '<div class="sf-row"><div><label>عنوان</label><input id="sfCartSubject"></div>' +
      '<div><label>تاریخ</label><input id="sfCartDate" class="sf-jdate"></div></div>' +
      '<div class="sf-row"><div><label>ارسال به ماژول</label><select id="sfCartTo">' + modOpts + '</select></div>' +
      '<div><label>کاربر مقصد</label><select id="sfCartToUser">' + userOpts + '</select></div></div>' +
      '<label>توضیح</label><input id="sfCartBody">' +
      '<label>فایل (حداکثر ۲٫۵MB)</label><input id="sfCartFile" type="file">' +
      '<div class="sf-actions"><button type="button" class="sf-btn sf-p" id="sfCartSend">ارسال</button>' +
      '<button type="button" class="sf-btn sf-g" id="sfCartRefresh">بروزرسانی</button></div>' +
      '<div class="sf-okbar" id="sfCartMsg"></div>' +
      '<div class="sf-hint">سراسری بین ماژول‌ها · شناسه یکتا · مقصد: ماژول + کاربر</div></div>' +
      '<div class="sf-lists"><div class="sf-card"><h3 style="margin:0 0 8px;font-size:.82rem;color:#93c5fd">ارسالی‌ها</h3><div id="sfCartOut"></div></div>' +
      '<div class="sf-card"><h3 style="margin:0 0 8px;font-size:.82rem;color:#93c5fd">دریافتی‌ها</h3><div id="sfCartIn"></div></div></div>';
    attachJDate(host.querySelector("#sfCartDate"));
    host.querySelector("#sfCartSend").onclick = function () {
      var to = host.querySelector("#sfCartTo").value;
      var toUser = host.querySelector("#sfCartToUser").value || "*";
      var subject = (host.querySelector("#sfCartSubject").value || "").trim();
      var body = (host.querySelector("#sfCartBody").value || "").trim();
      var date = (host.querySelector("#sfCartDate").value || "").trim();
      var fileInput = host.querySelector("#sfCartFile");
      var file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      if (!subject && !file) return toast("عنوان یا فایل لازم است", true);
      var users = listUsers();
      var toUserName = toUser === "*" ? "همه کاربران" : ((users.find(function (u) { return u.user === toUser; }) || {}).name || toUser);

      function finish(dataUrl, fileName, fileSize) {
        var meta = cartMeta();
        var id = uid();
        if ((meta.items || []).some(function (x) { return x && x.id === id; })) id = uid();
        meta.items.unshift({
          id: id,
          from: S.moduleId, fromTitle: S.moduleTitle,
          fromUser: currentUser(), fromUserName: currentUserName(),
          to: to, toTitle: titleOf(to),
          toUser: toUser, toUserName: toUserName,
          subject: subject || fileName || "بدون عنوان",
          body: body, date: date, status: "active",
          hasFile: !!dataUrl, fileName: fileName || "", fileSize: fileSize || 0,
          dataUrl: dataUrl || "", createdAt: nowIso(), deleted: false
        });
        if (meta.items.length > 800) meta.items = meta.items.slice(0, 800);
        if (!cartSave(meta)) return;
        try { localStorage.setItem("suite_cartable_ping", String(Date.now())); } catch (e) {}
        host.querySelector("#sfCartSubject").value = "";
        host.querySelector("#sfCartBody").value = "";
        fileInput.value = "";
        var msg = host.querySelector("#sfCartMsg");
        msg.style.display = "block";
        msg.textContent = "ارسال شد · " + id + " · " + titleOf(to) + " / " + toUserName;
        renderCart(); toast("ارسال شد");
      }
      if (!file) return finish("", "", 0);
      if (file.size > MAX_BYTES) return toast("سقف حجم ۲٫۵MB", true);
      var fr = new FileReader();
      fr.onload = function () { finish(fr.result, file.name, file.size); };
      fr.onerror = function () { toast("خواندن فایل ناموفق", true); };
      fr.readAsDataURL(file);
    };
    host.querySelector("#sfCartRefresh").onclick = function () { renderCart(); toast("بروزرسانی شد"); };
    host.onclick = function (e) {
      var b = e.target.closest("[data-cact]"); if (!b) return;
      var id = b.getAttribute("data-id"), act = b.getAttribute("data-cact");
      var meta = cartMeta();
      if (act === "dl") {
        var it = (meta.items || []).find(function (x) { return x && x.id === id; });
        if (!it || !it.dataUrl) return toast("فایل نیست", true);
        var a = document.createElement("a"); a.href = it.dataUrl; a.download = it.fileName || "file";
        document.body.appendChild(a); a.click(); a.remove(); return;
      }
      meta.items = (meta.items || []).map(function (x) {
        if (!x || x.id !== id) return x;
        if (act === "del") return Object.assign({}, x, { deleted: true });
        return Object.assign({}, x, { status: act });
      });
      cartSave(meta); renderCart();
    };
    renderCart();
  }

  function updateBadges() {
    var nN = notesAll().filter(function (x) { return x && !x.deleted && (x.status || "active") === "active"; }).length;
    var nR = remsAll().filter(function (x) { return x && !x.deleted && (x.status === "open" || x.status === "doing" || !x.status); }).length;
    var nC = inbox().filter(function (x) { return (x.status || "active") === "active"; }).length;
    document.querySelectorAll(".alerts .alert, .alert").forEach(function (el) {
      var t = (el.textContent || "").replace(/\d+/g, "").trim();
      var num = el.querySelector(".n"); if (!num) return;
      if (t.indexOf("یادداشت") !== -1) num.textContent = String(nN);
      if (t.indexOf("یادآوری") !== -1) num.textContent = String(nR);
      if (t.indexOf("کارتابل") !== -1) num.textContent = String(nC);
    });
  }

  function init(opts) {
    opts = opts || {};
    S.moduleId = String(opts.moduleId || opts.mod || global.MOD || "cashbox");
    S.moduleTitle = String(opts.moduleTitle || titleOf(S.moduleId));
    S.notesKey = "smart_mod_notes_" + S.moduleId;
    S.remsKey = "smart_mod_rem_" + S.moduleId;
    injectCss();
    mountNotes();
    mountRems();
    mountCart();
    updateBadges();
    window.addEventListener("storage", function (ev) {
      if (ev && (ev.key === CART_KEY || ev.key === "suite_cartable_ping")) {
        renderCart();
        var n = inbox().length;
        if (n > S.lastIn) toast("پیام/فایل جدید در کارتابل");
        S.lastIn = n;
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
    S.lastIn = inbox().length;
    return api;
  }

  var api = { version: 2, init: init, renderNotes: renderNotes, renderRems: renderRems, renderCart: renderCart };
  global.SuiteFacilities = api;

  function boot() {
    try {
      var sc = document.currentScript;
      if (sc && sc.getAttribute("data-module")) {
        init({ moduleId: sc.getAttribute("data-module"), moduleTitle: sc.getAttribute("data-title") || "" });
        return;
      }
    } catch (e) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      try {
        var scripts = document.getElementsByTagName("script");
        for (var i = scripts.length - 1; i >= 0; i--) {
          if (scripts[i].src && scripts[i].src.indexOf("suite-facilities.js") !== -1 && scripts[i].getAttribute("data-module")) {
            init({ moduleId: scripts[i].getAttribute("data-module"), moduleTitle: scripts[i].getAttribute("data-title") || "" });
            return;
          }
        }
      } catch (e) {}
    });
  } else {
    boot();
  }
})(window);
