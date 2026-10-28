param([Parameter(Mandatory = $true)][string]$Root)

$ErrorActionPreference = 'SilentlyContinue'
$rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\')
$injectors = @('apps\ZCode\injector.mjs', 'apps\Qoder\injector.mjs', 'apps\DeepSeekHarness\injector.mjs', 'apps\Antigravity\injector.mjs') |
  ForEach-Object { [IO.Path]::GetFullPath((Join-Path $rootPath $_)) }

foreach ($process in Get-CimInstance Win32_Process -Filter "Name='node.exe'") {
  foreach ($injector in $injectors) {
    if ($process.CommandLine -match [regex]::Escape($injector)) {
      Stop-Process -Id $process.ProcessId -Force
      break
    }
  }
}
