# Create local zip snapshot for v1.6.0
$root = 'D:\smart-platform-alm'
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$dest = "D:\smart-platform-alm-v1.6.0-$stamp.zip"
if (-not (Test-Path $root)) { throw "missing $root" }
# exclude heavy/temp
$exclude = @('node_modules', '.git', 'backups')
Write-Host "Zipping to $dest ..."
# Compress-Archive does not support exclude well — zip main folders
$items = Get-ChildItem $root -Force | Where-Object {
  $exclude -notcontains $_.Name
}
Compress-Archive -Path ($items.FullName) -DestinationPath $dest -Force
Write-Host "OK $dest"
Get-Item $dest | Select-Object FullName, Length, LastWriteTime
