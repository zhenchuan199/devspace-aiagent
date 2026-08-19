$ErrorActionPreference = "Stop"

$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($currentIdentity)
$administrator = [Security.Principal.WindowsBuiltInRole]::Administrator
if (-not $principal.IsInRole($administrator)) {
  throw "Run this script from an elevated PowerShell session."
}

$taskName = "DevSpace MCP"
$taskUser = $currentIdentity.Name
$repoRoot = $PSScriptRoot
$node = (Get-Command node.exe -ErrorAction Stop).Source
$bootstrap = Join-Path $repoRoot "start-devspace.mjs"
$cli = Join-Path $repoRoot "dist\cli.js"

if (-not (Test-Path -LiteralPath $bootstrap)) {
  throw "Missing startup wrapper: $bootstrap"
}
if (-not (Test-Path -LiteralPath $cli)) {
  throw "DevSpace is not built. Run npm.cmd run build in '$repoRoot' first."
}

$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500
}

$taskAction = New-ScheduledTaskAction `
  -Execute $node `
  -Argument "`"$bootstrap`"" `
  -WorkingDirectory $repoRoot

$taskTrigger = New-ScheduledTaskTrigger -AtLogOn -User $taskUser

$taskPrincipal = New-ScheduledTaskPrincipal `
  -UserId $taskUser `
  -LogonType S4U `
  -RunLevel Limited

$taskSettings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew `
  -Hidden

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $taskAction `
  -Trigger $taskTrigger `
  -Principal $taskPrincipal `
  -Settings $taskSettings `
  -Force | Out-Null

Start-ScheduledTask -TaskName $taskName

$started = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if ($task.State -eq "Running") {
    $started = $true
    break
  }
  Start-Sleep -Milliseconds 500
}

if (-not $started) {
  $taskInfo = Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction SilentlyContinue
  throw "DevSpace task was registered but did not remain running. LastTaskResult=$($taskInfo.LastTaskResult)"
}

Write-Host "DevSpace scheduled task registered successfully."
Write-Host "Repository: $repoRoot"
Write-Host "Node: $node"
