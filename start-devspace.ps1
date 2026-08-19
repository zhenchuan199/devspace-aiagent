$ErrorActionPreference = "Stop"

$env:DEVSPACE_TRUST_PROXY = "1"
$repoRoot = $PSScriptRoot
$node = (Get-Command node.exe -ErrorAction Stop).Source
$cli = Join-Path $repoRoot "dist\cli.js"
$stdoutLog = Join-Path $repoRoot "devspace-named.stdout.log"
$stderrLog = Join-Path $repoRoot "devspace-named.stderr.log"

if (-not (Test-Path -LiteralPath $cli)) {
  throw "DevSpace is not built. Run npm.cmd run build in '$repoRoot' first."
}

$gitBash = $env:DEVSPACE_GIT_BASH
if (-not $gitBash -or -not (Test-Path -LiteralPath $gitBash)) {
  $git = Get-Command git.exe -ErrorAction SilentlyContinue
  if ($git) {
    $gitDir = Split-Path -Parent $git.Source
    $gitRoot = Split-Path -Parent $gitDir
    $gitBash = @(
      (Join-Path $gitDir "bash.exe"),
      (Join-Path $gitRoot "bin\bash.exe")
    ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  }
}

if ($gitBash -and (Test-Path -LiteralPath $gitBash)) {
  $env:Path = "$(Split-Path -Parent $gitBash);$env:Path"
}

& $node $cli serve 1>> $stdoutLog 2>> $stderrLog
exit $LASTEXITCODE
