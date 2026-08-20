# Orchestra installer wrapper (PowerShell 5.1+)
#   .\install.ps1 "C:\path\to\project"
#   .\install.ps1 "C:\path\to\project" -Packs codex
#   .\install.ps1 "C:\path\to\project" -Specialists modeler
#   .\install.ps1 "C:\path\to\project" -NoPacks
#   .\install.ps1 "C:\path\to\project" -Uninstall
#   .\install.ps1 -Scan "C:\code"                 report which installs are behind
#   .\install.ps1 -Scan "C:\code" -Update         ...and bring the stale ones up
#   .\install.ps1 -Lint                           frontmatter lint only (CI / contributors)
param(
    [string]$Target = ".",
    [string]$Packs = "",
    [string]$Specialists = "",
    [switch]$NoPacks,
    [switch]$Uninstall,
    [string]$Scan = "",
    [switch]$Update,
    [int]$Depth = 0,
    [switch]$Lint
)

$node = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $node) {
    Write-Error "Node.js is required (used by the installer and the guard hook). Install it and ensure 'node' is on PATH."
    exit 1
}

if ($Lint) {
    # Lint mode checks frontmatter only; a Target other than "." scopes it.
    $installArgs = @((Join-Path $PSScriptRoot "install.js"), "--lint")
    if ($Target -ne ".") { $installArgs += $Target }
} elseif ($Scan -ne "") {
    # Scan mode searches a directory instead of installing into one, so the
    # target is deliberately omitted — the installer refuses both at once.
    $installArgs = @((Join-Path $PSScriptRoot "install.js"), "--scan", $Scan)
    if ($Update) { $installArgs += "--update" }
    if ($Depth -gt 0) { $installArgs += @("--depth", "$Depth") }
} else {
    $installArgs = @((Join-Path $PSScriptRoot "install.js"), $Target)
    if ($Packs -ne "") { $installArgs += @("--packs", $Packs) }
    if ($NoPacks) { $installArgs += "--no-packs" }
    if ($Specialists -ne "") { $installArgs += @("--specialists", $Specialists) }
    if ($Uninstall) { $installArgs += "--uninstall" }
}
& node @installArgs
exit $LASTEXITCODE
