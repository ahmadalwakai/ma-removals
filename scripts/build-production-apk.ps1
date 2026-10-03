param(
  [string]$DestinationDir = "C:\Users\Administrator\OneDrive\Desktop\chat assisted",
  [string]$BuildRoot = "C:\ma-admin-build"
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$workspaceRoot = Split-Path -Parent $projectRoot
$repoOutputDir = Join-Path $workspaceRoot "ma-removals\builds\admin-app"
$apkName = "maremovals-admin-production-release.apk"

function Remove-BuildRoot {
  if (Test-Path -LiteralPath $BuildRoot) {
    $resolved = (Resolve-Path -LiteralPath $BuildRoot).Path
    if ($resolved -ne $BuildRoot) {
      throw "Unexpected build cleanup path: $resolved"
    }
    Stop-AndroidBuildDaemons
    $lastError = $null
    for ($attempt = 1; $attempt -le 5; $attempt++) {
      try {
        Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction Stop
      }
      catch {
        $lastError = $_.Exception.Message
      }
      if (Test-Path -LiteralPath $resolved) {
        try {
          [System.IO.Directory]::Delete("\\?\$resolved", $true)
        }
        catch {
          $lastError = $_.Exception.Message
        }
      }
      if (-not (Test-Path -LiteralPath $resolved)) {
        return
      }
      Start-Sleep -Seconds 2
      Stop-AndroidBuildDaemons
    }
    throw "Unable to remove build workspace after retries: $lastError"
  }
}

function Stop-AndroidBuildDaemons {
  $daemons = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq "java.exe" -and ($_.CommandLine -match "GradleDaemon" -or $_.CommandLine -match "KotlinCompileDaemon")
  }
  foreach ($daemon in $daemons) {
    Stop-Process -Id $daemon.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Preparing Android production build workspace..."
Remove-BuildRoot

$robocopy = "C:\Windows\System32\robocopy.exe"
if (-not (Test-Path -LiteralPath $robocopy)) {
  throw "robocopy.exe not found: $robocopy"
}
& $robocopy $projectRoot $BuildRoot /MIR /XD .git .expo .gradle .cxx node_modules /NFL /NDL /NJH /NJS /NP | Out-Null
$robocopyExit = $LASTEXITCODE
if ($robocopyExit -gt 7) {
  throw "robocopy failed with exit code $robocopyExit"
}

Write-Host "Building release APK..."
Push-Location (Join-Path $BuildRoot "android")
try {
  $env:NODE_ENV = "production"
  & .\gradlew.bat assembleRelease
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle assembleRelease failed with exit code $LASTEXITCODE"
  }
}
finally {
  & .\gradlew.bat --stop | Out-Null
  Pop-Location
}

$releaseApk = Join-Path $BuildRoot "android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path -LiteralPath $releaseApk)) {
  throw "Release APK not found: $releaseApk"
}

New-Item -ItemType Directory -Path $DestinationDir -Force | Out-Null
New-Item -ItemType Directory -Path $repoOutputDir -Force | Out-Null

$desktopApk = Join-Path $DestinationDir $apkName
$repoApk = Join-Path $repoOutputDir $apkName
Copy-Item -LiteralPath $releaseApk -Destination $desktopApk -Force
Copy-Item -LiteralPath $releaseApk -Destination $repoApk -Force

Write-Host "Copied APK to:"
Write-Host "  $desktopApk"
Write-Host "  $repoApk"

$cleaned = $false
for ($attempt = 1; $attempt -le 4 -and -not $cleaned; $attempt++) {
  try {
    if ($attempt -gt 1) {
      Stop-AndroidBuildDaemons
    }
    Remove-BuildRoot
    $cleaned = $true
  }
  catch {
    if ($attempt -eq 4) {
      Write-Warning "Build succeeded, but temporary cleanup needs a retry: $($_.Exception.Message)"
    }
    else {
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
}
