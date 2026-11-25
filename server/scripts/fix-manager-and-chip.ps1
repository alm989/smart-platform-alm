# Fix manager leftover + sync chip position (run on user PC)
$ErrorActionPreference = 'Continue'

# --- manager.html: remove stage text before <script> ---
foreach ($f in @(
  (Join-Path $PSScriptRoot '..\..\manager.html'),
  (Join-Path $PSScriptRoot '..\public\manager.html'),
  'D:\smart-platform-alm\manager.html',
  'D:\smart-platform-alm\server\public\manager.html'
)) {
  if (!(Test-Path $f)) { continue }
  $t = [IO.File]::ReadAllText($f)
  $o = $t
  # remove junk block between toast and script
  $t = [regex]::Replace($t, '(?s)(</div>\s*)مدیریت\s*[—\-]\s*مرحله\s*۲\s*\(اسکریپت کامل\)\s*جایگزین\s*<!--\s*STAGE2_SCRIPT\s*-->\s*در HTML مرحله ۱:\s*html\s*(<script>)', '${1}${2}')
  $t = [regex]::Replace($t, '(?s)مدیریت\s*[—\-]\s*مرحله\s*۲\s*\(اسکریپت کامل\)\s*', '')
  $t = [regex]::Replace($t, '(?s)جایگزین\s*<!--\s*STAGE2_SCRIPT\s*-->\s*در HTML مرحله ۱:\s*', '')
  $t = [regex]::Replace($t, '(?m)^\s*html\s*\r?\n(?=\s*<script>)', '')
  if ($t -ne $o) {
    [IO.File]::WriteAllText($f, $t, [Text.UTF8Encoding]::new($false))
    Write-Host "manager FIXED: $f"
  } else {
    Write-Host "manager check: $f"
    Select-String -Path $f -Pattern 'مرحله ۲|STAGE2|اسکریپت کامل' | Select-Object -First 5 LineNumber, Line
  }
}

# --- core.js: force chip to bottom-left (all modules) ---
$hook = @'

/* force sync chip bottom-left — avoid cartable overlap */
(function () {
  if (window.__sfChipPosFix) return;
  window.__sfChipPosFix = true;
  function fix() {
    try {
      var el = document.getElementById("sfSyncChip");
      if (!el) return;
      el.style.position = "fixed";
      el.style.left = "12px";
      el.style.right = "auto";
      el.style.bottom = "12px";
      el.style.zIndex = "50";
      el.style.pointerEvents = "none";
    } catch (e) {}
  }
  fix();
  setInterval(fix, 800);
  if (document.body) {
    new MutationObserver(fix).observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      fix();
      new MutationObserver(fix).observe(document.body, { childList: true, subtree: true });
    });
  }
})();
'@

foreach ($cf in @(
  'D:\smart-platform-alm\core.js',
  'D:\smart-platform-alm\server\public\core.js'
)) {
  if (!(Test-Path $cf)) { continue }
  $c = [IO.File]::ReadAllText($cf)
  if ($c -match '__sfChipPosFix') { Write-Host "core already $cf"; continue }
  [IO.File]::WriteAllText($cf, $c + "`n" + $hook, [Text.UTF8Encoding]::new($false))
  Write-Host "core chip-fix $cf"
}

# server-bridge style strings if present
foreach ($p in @(
  'D:\smart-platform-alm\server-bridge.js',
  'D:\smart-platform-alm\server\public\server-bridge.js'
)) {
  if (!(Test-Path $p)) { continue }
  $t = [IO.File]::ReadAllText($p)
  $t2 = $t.Replace('bottom:12px;right:12px', 'bottom:12px;left:12px;right:auto')
  $t2 = $t2.Replace('bottom: 12px; right: 12px', 'bottom:12px;left:12px;right:auto')
  if ($t2 -ne $t) {
    [IO.File]::WriteAllText($p, $t2, [Text.UTF8Encoding]::new($false))
    Write-Host "bridge $p"
  }
}

Write-Host 'DONE. Hard refresh: Ctrl+Shift+R'
