# Orchestra installer wrapper (PowerShell 5.1+)
#   .\install.ps1 "C:\path\to\project"
#   .\install.ps1 "C:\path\to\project" -Specialists modeler
#   .\install.ps1 "C:\path\to\project" -Uninstall
param(
    [string]$Target = ".",
    [string]$Specialists = "",
    [switch]$Uninstall
)

$node = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $node) {
    Write-Error "Node.js is required (used by the installer and the guard hook). Install it and ensure 'node' is on PATH."
    exit 1
}

$installArgs = @((Join-Path $PSScriptRoot "install.js"), $Target)
if ($Specialists -ne "") { $installArgs += @("--specialists", $Specialists) }
if ($Uninstall) { $installArgs += "--uninstall" }
& node @installArgs
exit $LASTEXITCODE
