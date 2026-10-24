
/* Smart Suite Core - local brain for personal PC */
(function (g) {
  "use strict";
  var DB_NAME = "smart_suite_local_db";
  var DB_VER = 1;
  var REGISTRY_KEY = "smart_suite_registry_v2";

  var MODULES = [
    { id: "secretary", file: "secretary.html", title: "منشی هوشمند", icon: "🤖", storageKeys: ["smart_secretary_v1"] },
    { id: "assistant", file: "assistant.html", title: "دستیار هوشمند", icon: "🧠", storageKeys: ["smart_assistant_v1"] },
    { id: "accounting", file: "accounting.html", title: "حسابداری", icon: "📒", storageKeys: ["smart_accounting_v1"] },
    { id: "cash-bank", file: "cash-bank.html", title: "نقد و بانک", icon: "🏦", storageKeys: ["smart_bank_v1"] },
    { id: "fund", file: "fund.html", title: "صندوق", icon: "🗃️", storageKeys: ["smart_fund_v1"] },
    { id: "petty-cash", file: "petty-cash.html", title: "تنخواه", icon: "💵", storageKeys: ["smart_petty_v1"] },
    { id: "sales", file: "sales.html", title: "فروش", icon: "🛒", storageKeys: ["smart_sales_v1"] },
    { id: "warehouse", file: "warehouse.html", title: "خرید و انبار", icon: "📦", storageKeys: ["smart_warehouse_v1"] },
    { id: "customers", file: "customers.html", title: "مشتریان", icon: "👤", storageKeys: ["smart_customers_v1"] },
    { id: "hr-payroll", file: "hr-payroll.html", title: "منابع انسانی", icon: "👥", storageKeys: ["smart_hr_v1"] },
    { id: "fixed-assets", file: "fixed-assets.html", title: "دارایی ثابت", icon: "🏢", storageKeys: ["smart_assets_v1"] },
    { id: "documents", file: "documents.html", title: "مدیریت اسناد", icon: "📄", storageKeys: ["smart_docs_v1"] },
    { id: "lawyer", file: "lawyer.html", title: "وکیل هوشمند", icon: "⚖️", storageKeys: ["smart_lawyer_v1"] },
    { id: "pr-media", file: "pr-media.html", title: "روابط عمومی", icon: "📢", storageKeys: ["smart_pr_v1"] },
    { id: "management", file: "management.html", title: "مدیریت", icon: "📋", storageKeys: ["smart_mgmt_v1"] },
    { id: "budget", file: "budget.html", title: "بودجه و کنترل", icon: "📊", storageKeys: ["smart_budget_v1"] },
    { id: "tax-budget", file: "tax-budget.html", title: "مالیات", icon: "🧾", storageKeys: ["smart_tax_v1"] },
    { id: "projects", file: "projects.html", title: "مدیریت پروژه", icon: "📁", storageKeys: ["smart_projects_v1"] },
    { id: "contracts", file: "contracts.html", title: "قراردادها", icon: "📝", storageKeys: ["smart_contracts_v1"] },
    { id: "fleet", file: "fleet.html", title: "ناوگان", icon: "🚚", storageKeys: ["smart_fleet_v1"] },
    { id: "production", file: "production.html", title: "تولید", icon: "🏭", storageKeys: ["smart_prod_v1"] },
    { id: "ceo", file: "ceo.html", title: "مدیرعامل", icon: "👔", storageKeys: ["smart_ceo_v1"] },
    { id: "control-center", file: "control-center.html", title: "کنترلر", icon: "🎛️", storageKeys: ["smart_control_v1"] },
    { id: "change-engine", file: "change-engine.html", title: "موتور تغییرات", icon: "⚙️", storageKeys: ["smart_patches_v1"] },
    { id: "multi-company", file: "multi-company.html", title: "چند شرکتی", icon: "🏛️", storageKeys: ["smart_multicompany_v1"] },
    { id: "brain", file: "brain.html", title: "مغز متفکر", icon: "🧬", storageKeys: ["smart_brain_v1"] }
  ];

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!g.indexedDB) { reject(new Error("IndexedDB پشتیبانی نمی‌شود")); return; }
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots", { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function scanLocalStorage() {
    var report = [];
    MODULES.forEach(function (m) {
      var size = 0, found = [];
      (m.storageKeys || []).forEach(function (k) {
        var v = localStorage.getItem(k);
        if (v != null) { found.push(k); size += v.length; }
      });
      report.push({ id: m.id, title: m.title, file: m.file, keys: found, bytes: size, ok: found.length > 0 });
    });
    var extra = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf("smart_") === 0) extra.push(key);
    }
    return { modules: report, allSmartKeys: extra, totalBytes: extra.reduce(function (s, k) { return s + (localStorage.getItem(k) || "").length; }, 0) };
  }

  function exportAllJSON() {
    var data = { exportedAt: new Date().toISOString(), version: 2, store: {} };
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("smart_") === 0) {
        try { data.store[k] = JSON.parse(localStorage.getItem(k)); }
        catch (e) { data.store[k] = localStorage.getItem(k); }
      }
    }
    return data;
  }

  function importAllJSON(data) {
    if (!data || !data.store) throw new Error("فایل نامعتبر");
    Object.keys(data.store).forEach(function (k) {
      var v = data.store[k];
      localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    });
  }

  function downloadBackup() {
    var blob = new Blob([JSON.stringify(exportAllJSON(), null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "smart-suite-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
  }

  function saveSnapshotToIDB() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("snapshots", "readwrite");
        var store = tx.objectStore("snapshots");
        var row = { at: new Date().toISOString(), payload: exportAllJSON() };
        var req = store.add(row);
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function listSnapshots() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("snapshots", "readonly");
        var req = tx.objectStore("snapshots").getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  g.SmartCore = {
    MODULES: MODULES,
    scanLocalStorage: scanLocalStorage,
    exportAllJSON: exportAllJSON,
    importAllJSON: importAllJSON,
    downloadBackup: downloadBackup,
    saveSnapshotToIDB: saveSnapshotToIDB,
    listSnapshots: listSnapshots,
    openDB: openDB
  };
})(window);
