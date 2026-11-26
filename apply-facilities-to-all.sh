#!/usr/bin/env bash
# اعمال امکانات یکپارچه روی همه ماژول‌ها
# اجرا: bash apply-facilities-to-all.sh
set -euo pipefail
cd "$(dirname "$0")"

patch_one() {
  local file="$1" id="$2" title="$3"
  [[ -f "$file" ]] || { echo "skip missing: $file"; return 0; }
  local tmp
  tmp="$(mktemp)"
  # CSP
  sed "s/script-src 'unsafe-inline'/script-src 'self' 'unsafe-inline'/g" "$file" > "$tmp"
  if grep -q 'suite-facilities\.js' "$tmp"; then
    echo "already wired: $file"
    mv "$tmp" "$file"
    return 0
  fi
  # inject after core.js
  awk -v id="$id" -v title="$title" '
    { print }
    /<script src="core\.js"><\/script>/ && !done {
      print "<script src=\"suite-facilities.js\" data-module=\"" id "\" data-title=\"" title "\"></script>"
      print "<script src=\"facilities-autoload.js\"></script>"
      done=1
    }
  ' "$tmp" > "$file"
  rm -f "$tmp"
  echo "patched: $file -> $id"
}

patch_one accounting.html accounting "حسابداری"
patch_one archive.html archive "بایگانی"
patch_one assistant.html assistant "دستیار"
patch_one audit.html audit "حسابرسی"
patch_one bank.html bank "بانک"
patch_one budget.html budget "بودجه"
patch_one cashbox.html cashbox "صندوق"
patch_one ceo.html ceo "مدیرعامل"
patch_one chat.html chat "چت"
patch_one contracts.html contracts "قراردادها"
patch_one correspondence.html correspondence "مکاتبات"
patch_one customers.html customers "مشتریان"
patch_one file-hub.html filehub "هاب فایل"
patch_one fixedassets.html fixedassets "دارایی ثابت"
patch_one fleet.html fleet "ناوگان"
patch_one lawyer.html lawyer "وکیل"
patch_one manager.html manager "مدیریت"
patch_one meeting.html meeting "متینگ"
patch_one multicompany.html multicompany "چندشرکتی"
patch_one payroll.html payroll "حقوق"
patch_one personnel.html personnel "پرسنلی"
patch_one pettycash.html pettycash "تنخواه"
patch_one pr-media.html pr "روابط عمومی"
patch_one production.html production "تولید"
patch_one projects.html projects "پروژه"
patch_one purchase.html purchase "خرید"
patch_one sales.html sales "فروش"
patch_one secretariat.html secretariat "دبیرخانه"
patch_one secretary.html secretary "منشی"
patch_one sysadmin.html sysadmin "مدیر سیستم"
patch_one tax.html tax "مالیات"
patch_one warehouse.html warehouse "انبار"
patch_one change-engine.html change-engine "موتور تغییر"
patch_one control-center.html control-center "مرکز کنترل"

echo "Done."
