# Build a clean web-only deploy folder for Netlify drag-drop.
# Excludes scraper/ (has a 312MB cookie profile, must NOT be public), .claude/, temp files.
# Paths use $PSScriptRoot (no hard-coded non-ASCII path), so encoding can't corrupt them.
# Usage: powershell -ExecutionPolicy Bypass -File make_deploy.ps1
$src = $PSScriptRoot
$dst = "$PSScriptRoot-deploy"
$items = @(
  "index.html", "app.js", "styles.css", "manifest.webmanifest",
  "service-worker.js", "netlify.toml", "assets", "data", "netlify"
)
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Path $dst | Out-Null
foreach ($it in $items) {
  $p = Join-Path $src $it
  if (Test-Path $p) { Copy-Item $p -Destination $dst -Recurse -Force }
}
$size = (Get-ChildItem $dst -Recurse -File | Measure-Object Length -Sum).Sum
Write-Output ("Built " + $dst + " (" + [math]::Round($size/1MB,2) + " MB)")
Get-ChildItem $dst | Select-Object Name