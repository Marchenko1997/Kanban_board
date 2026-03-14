$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
$port = if ($env:PM_PORT) { $env:PM_PORT } else { "8080" }

Set-Location $repoRoot
docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
    throw "docker compose up failed with exit code $LASTEXITCODE"
}
Write-Host "Server started at http://localhost:$port"
