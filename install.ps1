# Installs the Sizzle skill for Claude Code into ~\.claude\skills\sizzle
#   irm https://mhfrough.github.io/sizzle/install.ps1 | iex
# Running it again updates the skill. For other agents: npx skills add mhfrough/sizzle
# Works in Windows PowerShell 5.1 and PowerShell 7. The script block keeps its settings out of your session.
& {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'   # the progress bar makes downloads very slow in 5.1
  # Windows PowerShell 5.1 may default to old TLS versions that GitHub refuses
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

  $dir = Join-Path $HOME '.claude\skills\sizzle'
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('sizzle-' + [Guid]::NewGuid())
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  try {
    $zip = Join-Path $tmp 'sizzle.zip'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/mhfrough/sizzle/archive/refs/heads/main.zip' -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $src = Join-Path $tmp 'sizzle-main\skills\sizzle'
    if (-not (Test-Path (Join-Path $src 'SKILL.md'))) {
      throw 'Download failed: skills/sizzle not found in the archive. Nothing was changed.'
    }
    if (Test-Path $dir) { Remove-Item -Recurse -Force $dir }
    New-Item -ItemType Directory -Force -Path (Split-Path $dir) | Out-Null
    Copy-Item -Recurse -Path $src -Destination $dir
  } finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  }

  Write-Host "Sizzle installed to $dir"
  Write-Host "Restart Claude Code, then ask: make a promo reel for this app."
}
