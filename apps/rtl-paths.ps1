function Get-RtlSavedPath([string]$Id) {
  $path = Join-Path $env:LOCALAPPDATA 'ahmadkhanloo\VibeHub\rtl-paths.json'
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $null }
  try {
    $state = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8) | ConvertFrom-Json
    $value = $state.PSObject.Properties[$Id].Value
    if ($value -and (Test-Path -LiteralPath $value -PathType Leaf)) { return [string]$value }
  } catch {}
  return $null
}

function Save-RtlPath([string]$Id, [string]$Path) {
  $file = Join-Path $env:LOCALAPPDATA 'ahmadkhanloo\VibeHub\rtl-paths.json'
  [IO.Directory]::CreateDirectory((Split-Path -Parent $file)) | Out-Null
  $state = [pscustomobject]@{ schemaVersion = 1 }
  if (Test-Path -LiteralPath $file -PathType Leaf) {
    try { $state = [IO.File]::ReadAllText($file, [Text.Encoding]::UTF8) | ConvertFrom-Json } catch {}
  }
  $state | Add-Member -MemberType NoteProperty -Name $Id -Value $Path -Force
  [IO.File]::WriteAllText($file, ($state | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
}

function Select-RtlExecutable([string]$Id, [string]$Title, [string]$Names) {
  if (-not $Gui) { return $null }
  try { Add-Type -AssemblyName System.Windows.Forms } catch { return $null }
  $message = "${Title} was not found. Choose its executable now?"
  $answer = [System.Windows.Forms.MessageBox]::Show($message, "$Title RTL", [System.Windows.Forms.MessageBoxButtons]::YesNo, [System.Windows.Forms.MessageBoxIcon]::Information)
  if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) { return $null }
  $dialog = New-Object System.Windows.Forms.OpenFileDialog
  $dialog.Title = "Select $Title executable"
  $dialog.Filter = 'Application executable (*.exe)|*.exe'
  $dialog.CheckFileExists = $true
  if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return $null }
  $allowed = @($Names -split '\|')
  if ([IO.Path]::GetFileName($dialog.FileName) -notin $allowed) {
    [System.Windows.Forms.MessageBox]::Show("Choose one of: $($allowed -join ', ')", "$Title RTL", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
    return $null
  }
  Save-RtlPath $Id $dialog.FileName
  return $dialog.FileName
}

function Get-RtlNodePath([string]$AdapterDir) {
  $bundled = @(
    (Join-Path $AdapterDir '..\..\runtime\node.exe')
    (Join-Path $AdapterDir '..\desktop\src-tauri\windows\payload\node.exe')
  ) | ForEach-Object { [IO.Path]::GetFullPath($_) } | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
  if ($bundled -and (Test-Path -LiteralPath $bundled -PathType Leaf)) {
    $version = & $bundled --version
    if ($LASTEXITCODE -eq 0 -and [version](($version -replace '^v', '')) -ge [version]'21.0') { return $bundled }
    throw 'The VibeHub bundled Node.js runtime is invalid. Reinstall VibeHub RTL.'
  }
  $system = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($system) {
    try {
      $version = & $system.Source --version
      if ($LASTEXITCODE -eq 0 -and [version](($version -replace '^v', '')) -ge [version]'21.0') { return $system.Source }
    } catch {}
  }
  throw 'Node.js 21 or newer was not found. Reinstall VibeHub RTL to add its private runtime.'
}


# Shared discovery; never launches a child PowerShell, opens a dialog or writes state.
function Get-RtlExecutable([string]$Id, [string]$AdapterDir) {
  $names = switch ($Id) {
    'zcode' { @('ZCode.exe') }
    'qoder' { @('Qoder.exe', 'Qoder IDE.exe') }
    'deepseek-harness' { @('DeepSeek Harness.exe') }
    'antigravity' { @('Antigravity.exe') }
    default { return $null }
  }
  $envName = switch ($Id) { 'zcode' {'ZCODE_RTL_EXE'} 'qoder' {'QODER_RTL_EXE'} 'deepseek-harness' {'DEEPSEEK_HARNESS_RTL_EXE'} 'antigravity' {'ANTIGRAVITY_RTL_EXE'} }
  $override = [Environment]::GetEnvironmentVariable($envName)
  if ($override) {
    if (Test-Path -LiteralPath $override -PathType Leaf) { return $override }
    throw "$envName is set but is not a file."
  }
  $saved = Get-RtlSavedPath $Id
  if ($saved -and [IO.Path]::GetFileName($saved) -in $names) { return $saved }
  if ($Id -eq 'qoder') {
    $oldFile = Join-Path $AdapterDir 'qoder-path.txt'
    if (Test-Path -LiteralPath $oldFile -PathType Leaf) {
      $old = [IO.File]::ReadAllText($oldFile, [Text.Encoding]::UTF8).Trim()
      if ($old -and (Test-Path -LiteralPath $old -PathType Leaf)) { return $old }
    }
  }
  $bases = switch ($Id) {
    'zcode' { @("$env:ProgramFiles\ZCode", "${env:ProgramFiles(x86)}\ZCode", "$env:LOCALAPPDATA\Programs\ZCode") }
    'qoder' { @("$env:LOCALAPPDATA\Programs\Qoder IDE", "$env:LOCALAPPDATA\Programs\Qoder") }
    'deepseek-harness' { @("$env:LOCALAPPDATA\Programs\DeepSeek Harness") }
    'antigravity' { @("$env:LOCALAPPDATA\Programs\antigravity") }
  }
  foreach ($base in $bases) {
    if ($Id -eq 'qoder') {
      $versions = Get-ChildItem -LiteralPath (Join-Path $base '.qoder-versions') -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^\d+(\.\d+){2,3}$' -and (Test-Path -LiteralPath (Join-Path $_.FullName 'resources\app.asar')) } |
        Sort-Object { [version]$_.Name } -Descending
      foreach ($version in $versions) { foreach ($name in $names) {
        $candidate = Join-Path $version.FullName $name
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
      } }
      if (-not (Test-Path -LiteralPath (Join-Path $base 'resources\app.asar'))) { continue }
    }
    foreach ($name in $names) {
      $candidate = Join-Path $base $name
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
  }
  # Slow custom-path fallback only when saved and standard paths did not resolve.
  if ($Id -eq 'qoder') {
    $running = Get-CimInstance Win32_Process -Filter "Name='Qoder.exe' OR Name='Qoder IDE.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -notmatch '--type=' -and $_.ExecutablePath } | Select-Object -First 1
    if ($running -and (Test-Path -LiteralPath (Join-Path (Split-Path $running.ExecutablePath) 'resources\app.asar'))) { return $running.ExecutablePath }
  }
  return $null
}
