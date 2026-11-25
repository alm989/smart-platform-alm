# Register daily mirror of backups to backupExtraDir
# Run PowerShell AS ADMINISTRATOR once:
#   cd D:\smart-platform-alm\server
#   powershell -ExecutionPolicy Bypass -File .\scripts\register-daily-mirror.ps1

$ErrorActionPreference = "Stop"
$ServerDir = Split-Path -Parent $PSScriptRoot
if (-not $ServerDir) { $ServerDir = "D:\smart-platform-alm\server" }

$TaskName = "SmartSuite-BackupMirror"
$Script = Join-Path $ServerDir "scripts\mirror-backups.js"
$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) {
  Write-Host "node not found in PATH"
  exit 1
}
if (-not (Test-Path $Script)) {
  Write-Host "missing $Script"
  exit 1
}

# Remove old task if exists
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$Arg = "`"$Script`""
$Action = New-ScheduledTaskAction -Execute $Node -Argument $Arg -WorkingDirectory $ServerDir
# Every day at 03:00 (after server dailyBackupHour 02:00)
$Trigger = New-ScheduledTaskTrigger -Daily -At 3:00am
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "Mirror Smart Suite backups to backupExtraDir" | Out-Null

Write-Host "OK: Scheduled task '$TaskName' daily 03:00"
Write-Host "  Node: $Node"
Write-Host "  Work: $ServerDir"
Write-Host "  Run:  node scripts\mirror-backups.js"
Write-Host ""
Write-Host "Check: Get-ScheduledTask -TaskName $TaskName"
Write-Host "Test:  Start-ScheduledTask -TaskName $TaskName"
