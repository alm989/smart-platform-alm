این پوشه باید فایل‌های ماژول را داشته باشد.

از پوشه D:\smart-platform-alm این فایل‌ها را اینجا کپی کنید:
  suite.html, core.js, suite-facilities.js, facilities-autoload.js
  و همه *.html ماژول‌ها (cashbox.html, bank.html, ...)

دستور نمونه PowerShell:
  Copy-Item D:\smart-platform-alm\*.html D:\smart-platform-alm\server\public\ -Force
  Copy-Item D:\smart-platform-alm\core.js D:\smart-platform-alm\server\public\ -Force
  Copy-Item D:\smart-platform-alm\suite-facilities.js D:\smart-platform-alm\server\public\ -Force
  Copy-Item D:\smart-platform-alm\facilities-autoload.js D:\smart-platform-alm\server\public\ -Force
