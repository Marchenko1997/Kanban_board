param(
    [switch]$KeepServerRunning
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Run-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [scriptblock]$Action
    )

    Write-Host ""
    Write-Host "==> $Name" -ForegroundColor Cyan
    & $Action
    Write-Host "OK: $Name" -ForegroundColor Green
}

function Wait-ForJsonEndpoint {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,
        [int]$TimeoutSeconds = 90
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            return Invoke-RestMethod -Uri $Url -Method Get
        } catch {
            Start-Sleep -Seconds 2
        }
    }

    throw "Endpoint did not become ready in time: $Url"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$startScript = Join-Path $scriptDir "start-server.ps1"
$stopScript = Join-Path $scriptDir "stop-server.ps1"
$port = if ($env:PM_PORT) { $env:PM_PORT } else { "8080" }
$baseUrl = "http://localhost:$port"

$uvCommand = Get-Command uv -ErrorAction SilentlyContinue
if ($uvCommand) {
    $uvPath = $uvCommand.Source
} else {
    $fallbackUvPath = Join-Path $env:USERPROFILE ".local\bin\uv.exe"
    if (Test-Path $fallbackUvPath) {
        $uvPath = $fallbackUvPath
    } else {
        throw "uv was not found in PATH or at $fallbackUvPath."
    }
}

$serverStarted = $false

try {
    Run-Step -Name "Sync backend dependencies with uv" -Action {
        Set-Location $backendDir
        & $uvPath sync --dev
    }

    Run-Step -Name "Run backend tests (uv + pytest)" -Action {
        Set-Location $backendDir
        & $uvPath run python -m pytest -q
    }

    Run-Step -Name "Install frontend dependencies" -Action {
        Set-Location $frontendDir
        npm.cmd ci
    }

    Run-Step -Name "Run frontend unit tests" -Action {
        Set-Location $frontendDir
        npm.cmd run test:unit
    }

    Run-Step -Name "Run frontend e2e tests" -Action {
        Set-Location $frontendDir
        npm.cmd run test:e2e
    }

    Run-Step -Name "Start Docker stack" -Action {
        Set-Location $repoRoot
        & $startScript
        $script:serverStarted = $true
    }

    Run-Step -Name "Validate health endpoint" -Action {
        $health = Wait-ForJsonEndpoint -Url "$baseUrl/api/health" -TimeoutSeconds 120
        if ($health.status -ne "ok") {
            throw "Unexpected health status: $($health | ConvertTo-Json -Compress)"
        }
    }

    Run-Step -Name "Validate board endpoint" -Action {
        $board = Invoke-RestMethod -Uri "$baseUrl/api/users/user/board" -Method Get
        if (-not $board.columns -or -not $board.cards) {
            throw "Board payload missing columns/cards."
        }
    }

    Run-Step -Name "Validate AI ping endpoint" -Action {
        $ping = Invoke-RestMethod -Uri "$baseUrl/api/ai/ping" -Method Post
        if (-not $ping.reply) {
            throw "AI ping did not return reply."
        }
    }

    Run-Step -Name "Validate AI chat endpoint" -Action {
        $payload = @{
            message = "Reply with one short hello and do not update the board."
            history = @()
        } | ConvertTo-Json -Depth 10

        $chat = Invoke-RestMethod -Uri "$baseUrl/api/users/user/ai-chat" -Method Post -Body $payload -ContentType "application/json"
        if (-not $chat.assistant_message) {
            throw "AI chat did not return assistant_message."
        }
        if ($null -eq $chat.board) {
            throw "AI chat did not return board payload."
        }
    }

    Run-Step -Name "Validate DB persistence across container restart" -Action {
        $board = Invoke-RestMethod -Uri "$baseUrl/api/users/user/board" -Method Get
        $originalTitle = [string]$board.columns[0].title
        $tempTitle = "Persist-" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

        $board.columns[0].title = $tempTitle
        $updatePayload = $board | ConvertTo-Json -Depth 30
        Invoke-RestMethod -Uri "$baseUrl/api/users/user/board" -Method Put -Body $updatePayload -ContentType "application/json" | Out-Null

        Set-Location $repoRoot
        docker compose down
        if ($LASTEXITCODE -ne 0) {
            throw "docker compose down failed with exit code $LASTEXITCODE"
        }
        docker compose up -d
        if ($LASTEXITCODE -ne 0) {
            throw "docker compose up -d failed with exit code $LASTEXITCODE"
        }

        $null = Wait-ForJsonEndpoint -Url "$baseUrl/api/health" -TimeoutSeconds 120
        $afterRestart = Invoke-RestMethod -Uri "$baseUrl/api/users/user/board" -Method Get
        if ([string]$afterRestart.columns[0].title -ne $tempTitle) {
            throw "Board title did not persist across restart."
        }

        $afterRestart.columns[0].title = $originalTitle
        $restorePayload = $afterRestart | ConvertTo-Json -Depth 30
        Invoke-RestMethod -Uri "$baseUrl/api/users/user/board" -Method Put -Body $restorePayload -ContentType "application/json" | Out-Null
    }

    Write-Host ""
    Write-Host "Full validation completed successfully." -ForegroundColor Green
}
finally {
    if ($serverStarted -and -not $KeepServerRunning) {
        try {
            Set-Location $repoRoot
            & $stopScript
        } catch {
            Write-Warning "Failed to stop Docker stack automatically. Please run scripts/stop-server.ps1 manually."
        }
    }
}
