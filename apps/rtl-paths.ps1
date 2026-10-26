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
  if (Test-Path -LiteralPath $bundled -PathType Leaf) {
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
