# Orchestra installer wrapper — Codex-native (PowerShell 5.1+)
#   .\install-codex.ps1 "C:\path\to\project"
#   .\install-codex.ps1 "C:\path\to\project" -Packs claude
#   .\install-codex.ps1 "C:\path\to\project" -NoPacks
#   .\install-codex.ps1 "C:\path\to\project" -Uninstall
param(
    [string]$Target = ".",
    [string]$Packs = "",
    [switch]$NoPacks,
    [switch]$Uninstall
)

$node = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $node) {
    Write-Error "Node.js is required (used by the installer and the guard hook). Install it and ensure 'node' is on PATH."
    exit 1
}

$installArgs = @((Join-Path $PSScriptRoot "install-codex.js"), $Target)
if ($Packs -ne "") { $installArgs += @("--packs", $Packs) }
if ($NoPacks) { $installArgs += "--no-packs" }
if ($Uninstall) { $installArgs += "--uninstall" }
& node @installArgs
exit $LASTEXITCODE
