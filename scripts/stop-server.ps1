$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")

Set-Location $repoRoot
docker compose down
if ($LASTEXITCODE -ne 0) {
    throw "docker compose down failed with exit code $LASTEXITCODE"
}
Write-Host "Server stopped."
