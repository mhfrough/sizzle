# Installs the Sizzle skill for Claude Code (~\.claude\skills\sizzle) or Cursor (~\.cursor\skills\sizzle)
#   irm https://mhfrough.github.io/sizzle/install.ps1 | iex                               # Claude Code
#   $env:SIZZLE_AGENT='cursor'; irm https://mhfrough.github.io/sizzle/install.ps1 | iex   # Cursor
# Running it again updates the skill. For other agents: npx skills add mhfrough/sizzle
# Works in Windows PowerShell 5.1 and PowerShell 7. The script block keeps its settings out of your session.
& {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'   # the progress bar makes downloads very slow in 5.1
  # Windows PowerShell 5.1 may default to old TLS versions that GitHub refuses
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

  $agent = if ($env:SIZZLE_AGENT) { $env:SIZZLE_AGENT.ToLower() } else { 'claude' }
  switch ($agent) {
    'claude' { $dir = Join-Path $HOME '.claude\skills\sizzle'; $app = 'Claude Code' }
    'cursor' { $dir = Join-Path $HOME '.cursor\skills\sizzle'; $app = 'Cursor' }
    default  { throw "Unknown agent '$agent'. Set SIZZLE_AGENT to claude or cursor." }
  }
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
  # Cursor also loads skills from ~\.claude\skills, so a Claude Code copy would show up twice
  if ($agent -eq 'cursor' -and (Test-Path (Join-Path $HOME '.claude\skills\sizzle\SKILL.md'))) {
    Write-Host "Note: Cursor also reads ~\.claude\skills\sizzle, so you may see Sizzle twice. Keep one of them."
  }
  Write-Host "Restart $app, then ask: make a promo reel for this app."
}
