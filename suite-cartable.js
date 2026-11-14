/**
 * suite-cartable.js — کارتابل مشترک سراسری سوئیت
 * - یادداشت/یادآوری در ماژول‌ها محلی می‌مانند
 * - کارتابل بین همه ماژول‌ها فایل ارسال/دریافت می‌کند
 * - IndexedDB برای بدنه فایل + localStorage برای متادیتا
 * - بدون eval، با escape برای XSS
 *
 * اتصال کم‌تهاجمی:
 *   <script src="core.js"></script>
 *   <script src="suite-cartable.js"></script>
 *   <script>SuiteCartable.init({ moduleId: 'bank' });</script>
 *
 * اگر #p-cartable موجود باشد، UI داخل همان پنل mount می‌شود.
 */
(function (global) {
  "use strict";

  var META_KEY = "suite_cartable_v1";
  var DB_NAME = "suite_cartable_db";
  var DB_VER = 1;
  var STORE = "files";
  var MAX_BYTES = 2.5 * 1024 * 1024;
  var VERSION = 1;

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
    { id: "filehub", title: "هاب فایل" },
    { id: "tax", title: "مالیات" },
    { id: "budget", title: "بودجه" },
    { id: "audit", title: "حسابرسی" }
  ];

  var state = {
    moduleId: "bank",
    moduleTitle: "بانک",
    root: null,
    ready: false,
    db: null,
    lastSeenCount: 0
  };

  function esc(s) {
    if (global.SmartCore && typeof global.SmartCore.esc === "function") {
      return global.SmartCore.esc(s);
    }
    return String(s == null ? "" : s)
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, """)
      .replace(/'/g, "&#39;");
  }

  function uid() {
    if (global.SmartCore && typeof global.SmartCore.uid === "function") return global.SmartCore.uid();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function userName() {
    try {
      if (global.SmartCore && typeof global.SmartCore.userName === "function") return global.SmartCore.userName();
    } catch (e) {}
    try {
      var a = JSON.parse(localStorage.getItem("smart_users_suite_brain") || "null");
      if (a && a.session) return a.session.name || a.session.user || "کاربر";
    } catch (e2) {}
    return "کاربر";
  }

  function toast(msg, err) {
    if (global.SmartCore && typeof global.SmartCore.toast === "function") {
      global.SmartCore.toast(msg, !!err);
      return;
    }
    var el = document.getElementById("sc-cart-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "sc-cart-toast";
      el.setAttribute(
        "style",
        "position:fixed;bottom:14px;left:50%;transform:translateX(-50%);padding:9px 14px;border-radius:12px;font-weight:700;font-size:.8rem;z-index:10000;opacity:0;transition:.15s;font-family:Tahoma,sans-serif;pointer-events:none;color:#fff"
      );
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = err ? "#ef4444" : "#22c55e";
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.style.opacity = "0";
    }, 2400);
  }

  function moduleList() {
    if (global.SmartCore && Array.isArray(global.SmartCore.MODULES) && global.SmartCore.MODULES.length) {
      return global.SmartCore.MODULES.map(function (m) {
        return { id: m.id, title: m.title || m.id };
      });
    }
    return FALLBACK_MODULES.slice();
  }

  function titleOf(id) {
    var m = moduleList().find(function (x) {
      return x.id === id;
    });
    return (m && m.title) || id;
  }

  /* ---------- meta (localStorage) ---------- */
  function loadMeta() {
    try {
      var raw = localStorage.getItem(META_KEY);
      if (!raw) return { items: [] };
      var o = JSON.parse(raw);
      if (!o || !Array.isArray(o.items)) return { items: [] };
      return o;
    } catch (e) {
      return { items: [] };
    }
  }

  function saveMeta(meta) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
      return true;
    } catch (e) {
      toast("ذخیره متادیتای کارتابل ناموفق", true);
      return false;
    }
  }

  /* ---------- IndexedDB ---------- */
  function openDb() {
    return new Promise(function (resolve, reject) {
      if (state.db) {
        resolve(state.db);
        return;
      }
      if (!global.indexedDB) {
        reject(new Error("IndexedDB در دسترس نیست"));
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (ev) {
        var db = ev.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = function (ev) {
        state.db = ev.target.result;
        resolve(state.db);
      };
      req.onerror = function () {
        reject(req.error || new Error("باز شدن IndexedDB ناموفق"));
      };
    });
  }

  function idbPut(rec) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(rec);
        tx.oncomplete = function () {
          resolve(true);
        };
        tx.onerror = function () {
          reject(tx.error);
        };
      });
    });
  }

  function idbGet(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readonly");
        var req = tx.objectStore(STORE).get(id);
        req.onsuccess = function () {
          resolve(req.result || null);
        };
        req.onerror = function () {
          reject(req.error);
        };
      });
    });
  }

  function idbDel(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = function () {
          resolve(true);
        };
        tx.onerror = function () {
          reject(tx.error);
        };
      });
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        resolve(null);
        return;
      }
      if (file.size > MAX_BYTES) {
        reject(new Error("حداکثر حجم فایل ۲٫۵ مگابایت است"));
        return;
      }
      var fr = new FileReader();
      fr.onload = function () {
        resolve({
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl: fr.result
        });
      };
      fr.onerror = function () {
        reject(new Error("خواندن فایل ناموفق"));
      };
      fr.readAsDataURL(file);
    });
  }

  /* ---------- domain ops ---------- */
  function listForModule(modId) {
    var meta = loadMeta();
    return (meta.items || []).filter(function (it) {
      return it && (it.to === modId || it.from === modId) && !it.deleted;
    });
  }

  function inbox(modId) {
    return listForModule(modId).filter(function (it) {
      return it.to === modId;
    });
  }

  function outbox(modId) {
    return listForModule(modId).filter(function (it) {
      return it.from === modId;
    });
  }

  function activeInboxCount(modId) {
    return inbox(modId).filter(function (it) {
      return (it.status || "active") === "active";
    }).length;
  }

  function sendItem(opts) {
    opts = opts || {};
    var to = String(opts.to || "").trim();
    var subject = String(opts.subject || "").trim();
    var body = String(opts.body || "").trim();
    var file = opts.file || null;

    if (!to) return Promise.reject(new Error("گیرنده را انتخاب کنید"));
    if (!subject && !body && !file) return Promise.reject(new Error("موضوع، متن یا فایل لازم است"));

    return readFileAsDataUrl(file).then(function (fileRec) {
      var id = uid();
      var item = {
        id: id,
        from: state.moduleId,
        fromTitle: state.moduleTitle || titleOf(state.moduleId),
        to: to,
        toTitle: titleOf(to),
        subject: subject || (fileRec ? fileRec.name : "بدون موضوع"),
        body: body,
        status: "active",
        hasFile: !!fileRec,
        fileName: fileRec ? fileRec.name : "",
        fileType: fileRec ? fileRec.type : "",
        fileSize: fileRec ? fileRec.size : 0,
        createdAt: nowIso(),
        createdBy: userName(),
        deleted: false
      };

      var chain = Promise.resolve();
      if (fileRec) {
        chain = idbPut({
          id: id,
          name: fileRec.name,
          type: fileRec.type,
          size: fileRec.size,
          dataUrl: fileRec.dataUrl,
          savedAt: nowIso()
        });
      }

      return chain.then(function () {
        var meta = loadMeta();
        meta.items = meta.items || [];
        meta.items.unshift(item);
        if (meta.items.length > 800) meta.items = meta.items.slice(0, 800);
        saveMeta(meta);

        try {
          if (global.SmartCore && typeof global.SmartCore.audit === "function") {
            global.SmartCore.audit("cartable:send", item.subject, state.moduleId);
          }
          if (global.SmartCore && typeof global.SmartCore.emit === "function") {
            global.SmartCore.emit("cartable:send", item);
          }
        } catch (e) {}

        try {
          localStorage.setItem("suite_cartable_ping", String(Date.now()));
        } catch (e2) {}

        return item;
      });
    });
  }

  function setStatus(id, status) {
    var meta = loadMeta();
    var found = null;
    (meta.items || []).forEach(function (it) {
      if (it && it.id === id) {
        it.status = status;
        it.updatedAt = nowIso();
        found = it;
      }
    });
    if (!found) return false;
    saveMeta(meta);
    return true;
  }

  function softDelete(id) {
    var meta = loadMeta();
    var found = null;
    (meta.items || []).forEach(function (it) {
      if (it && it.id === id) {
        it.deleted = true;
        it.deletedAt = nowIso();
        found = it;
      }
    });
    if (!found) return Promise.resolve(false);
    saveMeta(meta);
    return idbDel(id).then(
      function () {
        return true;
      },
      function () {
        return true;
      }
    );
  }

  function downloadItem(id) {
    return idbGet(id).then(function (rec) {
      if (!rec || !rec.dataUrl) {
        toast("فایلی برای دانلود نیست", true);
        return false;
      }
      var a = document.createElement("a");
      a.href = rec.dataUrl;
      a.download = rec.name || "cartable-file";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    });
  }

  /* ---------- UI ---------- */
  function injectStyles() {
    if (document.getElementById("suite-cartable-css")) return;
    var st = document.createElement("style");
    st.id = "suite-cartable-css";
    st.textContent =
      ".sc-cart{font-family:Tahoma,Segoe UI,sans-serif;text-align:right}" +
      ".sc-cart h3{margin:0 0 8px;font-size:.88rem;color:#7dd3fc}" +
      ".sc-cart .sc-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
      "@media(max-width:700px){.sc-cart .sc-row{grid-template-columns:1fr}}" +
      ".sc-cart label{display:block;font-size:.68rem;color:#94a3b8;margin:5px 0 2px}" +
      ".sc-cart input,.sc-cart select,.sc-cart textarea{width:100%;padding:7px;border-radius:9px;border:1px solid #334155;background:#020617;color:#e2e8f0;font-family:inherit;font-size:12.5px;box-sizing:border-box}" +
      ".sc-cart textarea{min-height:70px;resize:vertical}" +
      ".sc-cart .sc-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}" +
      ".sc-cart .sc-btn{border:none;border-radius:9px;padding:7px 12px;font-weight:700;font-size:.72rem;cursor:pointer;font-family:inherit}" +
      ".sc-cart .sc-btn-p{background:#0ea5e9;color:#fff}" +
      ".sc-cart .sc-btn-g{background:#334155;color:#e2e8f0}" +
      ".sc-cart .sc-btn-b{background:#7f1d1d;color:#fecaca}" +
      ".sc-cart .sc-btn-ok{background:#166534;color:#bbf7d0}" +
      ".sc-cart .sc-lists{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}" +
      "@media(max-width:850px){.sc-cart .sc-lists{grid-template-columns:1fr}}" +
      ".sc-cart .sc-box{background:#0f172a;border:1px solid #334155;border-radius:12px;padding:10px}" +
      ".sc-cart .sc-box h4{margin:0 0 8px;font-size:.78rem;color:#93c5fd}" +
      ".sc-cart .sc-item{background:#1e293b;border:1px solid #334155;border-right:4px solid #38bdf8;border-radius:10px;padding:10px;margin:8px 0}" +
      ".sc-cart .sc-item.saved{border-right-color:#22c55e;opacity:.92}" +
      ".sc-cart .sc-item .t{font-weight:800;color:#e2e8f0;font-size:.76rem;margin-bottom:4px}" +
      ".sc-cart .sc-item .m{font-size:.68rem;color:#94a3b8;line-height:1.8}" +
      ".sc-cart .sc-item .a{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid #334155}" +
      ".sc-cart .sc-empty{color:#64748b;font-size:.74rem;text-align:center;padding:12px}" +
      ".sc-cart .sc-badge{display:inline-block;background:#0ea5e9;color:#fff;border-radius:999px;padding:1px 7px;font-size:.62rem;margin-right:6px}" +
      ".sc-cart .sc-note{font-size:.68rem;color:#94a3b8;margin-top:6px;line-height:1.7}";
    document.head.appendChild(st);
  }

  function ensureRoot() {
    if (state.root && document.body.contains(state.root)) return state.root;

    var host = document.getElementById("suiteCartRoot");
    if (!host) {
      var panel = document.getElementById("p-cartable");
      if (panel) {
        var card = panel.querySelector(".card") || panel;
        host = document.createElement("div");
        host.id = "suiteCartRoot";
        card.appendChild(host);
      }
    }
    if (!host) {
      host = document.createElement("div");
      host.id = "suiteCartRoot";
      host.style.display = "none";
      document.body.appendChild(host);
    }
    state.root = host;
    return host;
  }

  function recipientOptionsHtml() {
    var list = moduleList().filter(function (m) {
      return m.id !== state.moduleId;
    });
    return list
      .map(function (m) {
        return '<option value="' + esc(m.id) + '">' + esc(m.title) + "</option>";
      })
      .join("");
  }

  function itemHtml(it, role) {
    var st = it.status === "saved" ? "saved" : "active";
    var stLabel = st === "saved" ? "بایگانی‌شده" : "فعال";
    var when = (it.createdAt || "").replace("T", " ").slice(0, 19);
    var html =
      '<div class="sc-item ' +
      st +
      '" data-id="' +
      esc(it.id) +
      '">' +
      '<div class="t">' +
      esc(it.subject || "—") +
      " <span class=\"sc-badge\">" +
      esc(stLabel) +
      "</span></div>" +
      '<div class="m">' +
      (role === "in"
        ? "از: " + esc(it.fromTitle || it.from)
        : "به: " + esc(it.toTitle || it.to)) +
      " · " +
      esc(it.createdBy || "") +
      " · " +
      esc(when) +
      (it.hasFile ? " · فایل: " + esc(it.fileName || "پیوست") : "") +
      (it.body ? "<br>" + esc(it.body).slice(0, 220) : "") +
      "</div>" +
      '<div class="a">';

    if (it.hasFile) {
      html +=
        '<button type="button" class="sc-btn sc-btn-g" data-act="dl" data-id="' +
        esc(it.id) +
        '">دانلود</button>';
    }
    if (role === "in" && st === "active") {
      html +=
        '<button type="button" class="sc-btn sc-btn-ok" data-act="save" data-id="' +
        esc(it.id) +
        '">بایگانی</button>';
    }
    if (role === "in" && st === "saved") {
      html +=
        '<button type="button" class="sc-btn sc-btn-g" data-act="activate" data-id="' +
        esc(it.id) +
        '">فعال‌سازی</button>';
    }
    html +=
      '<button type="button" class="sc-btn sc-btn-b" data-act="del" data-id="' +
      esc(it.id) +
      '">حذف</button></div></div>';
    return html;
  }

  function renderLists() {
    var root = ensureRoot();
    var inEl = root.querySelector("#scCartIn");
    var outEl = root.querySelector("#scCartOut");
    if (!inEl || !outEl) return;

    var inItems = inbox(state.moduleId).sort(function (a, b) {
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
    var outItems = outbox(state.moduleId).sort(function (a, b) {
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });

    inEl.innerHTML = inItems.length
      ? inItems.map(function (it) {
          return itemHtml(it, "in");
        }).join("")
      : '<div class="sc-empty">صندوق ورودی خالی است</div>';

    outEl.innerHTML = outItems.length
      ? outItems.map(function (it) {
          return itemHtml(it, "out");
        }).join("")
      : '<div class="sc-empty">ارسالی ثبت نشده</div>';

    var badge = root.querySelector("#scCartBadge");
    if (badge) {
      var n = activeInboxCount(state.moduleId);
      badge.textContent = n ? String(n) : "0";
      badge.style.display = n ? "inline-block" : "none";
    }

    updateSideAlert(n);
  }

  function updateSideAlert(n) {
    n = typeof n === "number" ? n : activeInboxCount(state.moduleId);
    var el = document.getElementById("alertCartable");
    if (el) {
      var num = el.querySelector(".n");
      if (num) num.textContent = String(n);
    }
    try {
      document.dispatchEvent(
        new CustomEvent("suite-cartable-count", {
          detail: { moduleId: state.moduleId, count: n }
        })
      );
    } catch (e) {}
  }

  function bindUi() {
    var root = ensureRoot();
    if (root._scBound) return;
    root._scBound = true;

    root.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      var id = btn.getAttribute("data-id");
      if (act === "dl") {
        downloadItem(id).catch(function (err) {
          toast((err && err.message) || "خطا در دانلود", true);
        });
      } else if (act === "save") {
        setStatus(id, "saved");
        renderLists();
        toast("بایگانی شد");
      } else if (act === "activate") {
        setStatus(id, "active");
        renderLists();
        toast("فعال شد");
      } else if (act === "del") {
        if (!confirm("حذف این مورد از کارتابل؟")) return;
        softDelete(id).then(function () {
          renderLists();
          toast("حذف شد");
        });
      } else if (act === "refresh") {
        renderLists();
        toast("بروزرسانی شد");
      }
    });

    var sendBtn = root.querySelector("#scCartSend");
    if (sendBtn) {
      sendBtn.addEventListener("click", function () {
        var to = (root.querySelector("#scCartTo") || {}).value || "";
        var subject = (root.querySelector("#scCartSubject") || {}).value || "";
        var body = (root.querySelector("#scCartBody") || {}).value || "";
        var fileInput = root.querySelector("#scCartFile");
        var file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

        sendBtn.disabled = true;
        sendItem({ to: to, subject: subject, body: body, file: file })
          .then(function () {
            if (root.querySelector("#scCartSubject")) root.querySelector("#scCartSubject").value = "";
            if (root.querySelector("#scCartBody")) root.querySelector("#scCartBody").value = "";
            if (fileInput) fileInput.value = "";
            renderLists();
            toast("ارسال شد");
          })
          .catch(function (err) {
            toast((err && err.message) || "ارسال ناموفق", true);
          })
          .then(function () {
            sendBtn.disabled = false;
          });
      });
    }
  }

  function mountUi() {
    injectStyles();
    var root = ensureRoot();
    root.className = (root.className || "") + " sc-cart";
    root.innerHTML =
      "<h3>کارتابل مشترک <span class=\"sc-badge\" id=\"scCartBadge\" style=\"display:none\">0</span></h3>" +
      '<div class="sc-note">ارسال و دریافت فایل بین ماژول‌های سوئیت. یادداشت و یادآوری هر ماژول جدا و محلی است.</div>' +
      '<div class="sc-box" style="margin-top:10px">' +
      "<h4>ارسال جدید · مبدأ: " +
      esc(state.moduleTitle || state.moduleId) +
      "</h4>" +
      '<div class="sc-row">' +
      "<div><label>گیرنده *</label><select id=\"scCartTo\">" +
      recipientOptionsHtml() +
      "</select></div>" +
      '<div><label>موضوع</label><input id="scCartSubject" maxlength="120" placeholder="موضوع نامه / فایل"></div>' +
      "</div>" +
      '<label>متن</label><textarea id="scCartBody" placeholder="توضیح کوتاه"></textarea>' +
      '<label>پیوست (حداکثر ۲٫۵MB)</label><input id="scCartFile" type="file">' +
      '<div class="sc-actions">' +
      '<button type="button" class="sc-btn sc-btn-p" id="scCartSend">ثبت و ارسال</button>' +
      '<button type="button" class="sc-btn sc-btn-g" data-act="refresh">بروزرسانی لیست</button>' +
      "</div></div>" +
      '<div class="sc-lists">' +
      '<div class="sc-box"><h4>صندوق ورودی</h4><div id="scCartIn"></div></div>' +
      '<div class="sc-box"><h4>ارسالی‌ها</h4><div id="scCartOut"></div></div>' +
      "</div>";

    bindUi();
    renderLists();
  }

  function onStorage(ev) {
    if (!ev) return;
    if (ev.key === META_KEY || ev.key === "suite_cartable_ping") {
      renderLists();
      var n = activeInboxCount(state.moduleId);
      if (n > state.lastSeenCount) {
        toast("فایل جدید در کارتابل");
      }
      state.lastSeenCount = n;
    }
  }

  function init(opts) {
    opts = opts || {};
    state.moduleId = String(opts.moduleId || opts.mod || global.MOD || "bank");
    state.moduleTitle = String(opts.moduleTitle || titleOf(state.moduleId));

    openDb()
      .then(function () {
        state.ready = true;
        mountUi();
        state.lastSeenCount = activeInboxCount(state.moduleId);
        window.addEventListener("storage", onStorage);

        /* وقتی پنل کارتابل باز شد، لیست تازه شود */
        document.addEventListener("click", function (e) {
          var t = e.target.closest("[data-panel]");
          if (t && t.getAttribute("data-panel") === "p-cartable") {
            setTimeout(renderLists, 30);
          }
        });

        if (typeof opts.onReady === "function") opts.onReady();
      })
      .catch(function (err) {
        console.warn("[SuiteCartable]", err);
        toast((err && err.message) || "راه‌اندازی کارتابل ناموفق", true);
        /* fallback UI بدون فایل باینری */
        state.ready = true;
        mountUi();
      });

    return api;
  }

  var api = {
    version: VERSION,
    init: init,
    send: sendItem,
    refresh: renderLists,
    inbox: function () {
      return inbox(state.moduleId);
    },
    outbox: function () {
      return outbox(state.moduleId);
    },
    activeCount: function () {
      return activeInboxCount(state.moduleId);
    },
    download: downloadItem,
    setStatus: setStatus,
    remove: softDelete,
    META_KEY: META_KEY
  };

  global.SuiteCartable = api;

  /* auto-init: <script src="suite-cartable.js" data-module="bank" data-title="بانک"></script> */
  function auto() {
    try {
      var sc = document.currentScript;
      if (sc && sc.getAttribute("data-module")) {
        init({
          moduleId: sc.getAttribute("data-module"),
          moduleTitle: sc.getAttribute("data-title") || ""
        });
      }
    } catch (e) {}
  }
  auto();
})(window);
