param([string]$Action)
# BM Player check helper. Called by BM-Player-Check.bat, one action at a time.
# Reads its paths from environment variables the batch file sets:
#   BMDIR    the folder holding the .bat and the zip
#   APPDIR   the unpacked app
#   RESULTS  where results are collected
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

switch ($Action) {

  'awake' {
    # Keep the screen on and the laptop awake for up to an hour, so a lock
    # screen can't spoil the screenshots. ES_CONTINUOUS, ES_SYSTEM_REQUIRED
    # and ES_DISPLAY_REQUIRED. Everything returns to normal when this exits.
    Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class BmAwake { [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f); }'
    [BmAwake]::SetThreadExecutionState([uint32]2147483651) | Out-Null
    Start-Sleep -Seconds 3600
  }

  'noquickedit' {
    # Clicking in a console window with QuickEdit on starts a text selection
    # and freezes whatever is writing to the window until a key is pressed.
    # A run where the fast checks took six minutes and two app starts timed
    # out looked exactly like that. This console only; it ends with the window.
    Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class BmCon { [DllImport("kernel32.dll")] public static extern IntPtr GetStdHandle(int h); [DllImport("kernel32.dll")] public static extern bool GetConsoleMode(IntPtr h, out uint m); [DllImport("kernel32.dll")] public static extern bool SetConsoleMode(IntPtr h, uint m); }'
    $h = [BmCon]::GetStdHandle(-10)
    [uint32]$m = 0
    if ([BmCon]::GetConsoleMode($h, [ref]$m)) {
      $n = [uint32]($m -bor 0x80)
      if (($n -band 0x40) -ne 0) { $n = [uint32]($n - 0x40) }
      [BmCon]::SetConsoleMode($h, $n) | Out-Null
      'QuickEdit off for this window'
    }
  }

  'release' {
    # Stop the keep-awake helper started earlier.
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*bm-helper.ps1*awake*' } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  }

  'sysinfo' {
    $o = New-Object System.Collections.Generic.List[string]
    $o.Add('BM Player check: this machine')
    $o.Add('')
    try {
      $os = Get-CimInstance Win32_OperatingSystem
      $o.Add("Windows:   $($os.Caption) $($os.Version) build $($os.BuildNumber) ($($os.OSArchitecture))")
      $cs = Get-CimInstance Win32_ComputerSystem
      $o.Add("Model:     $($cs.Manufacturer) $($cs.Model)")
      $o.Add(('RAM:       {0:N1} GB' -f ($cs.TotalPhysicalMemory / 1GB)))
      foreach ($c in Get-CimInstance Win32_Processor) { $o.Add("CPU:       $($c.Name.Trim()) ($($c.NumberOfCores) cores, $($c.NumberOfLogicalProcessors) threads)") }
      foreach ($g in Get-CimInstance Win32_VideoController) { $o.Add("GPU:       $($g.Name), driver $($g.DriverVersion), $($g.CurrentHorizontalResolution)x$($g.CurrentVerticalResolution)") }
    } catch { $o.Add('hardware query failed: ' + $_) }
    try {
      Add-Type -AssemblyName System.Windows.Forms
      foreach ($s in [System.Windows.Forms.Screen]::AllScreens) { $o.Add("Screen:    $($s.Bounds.Width)x$($s.Bounds.Height), primary: $($s.Primary)") }
      $dpi = (Get-ItemProperty 'HKCU:\Control Panel\Desktop\WindowMetrics' -ErrorAction Stop).AppliedDPI
      if ($dpi) { $o.Add("Scaling:   $([math]::Round($dpi / 96 * 100))%") }
    } catch {}
    $o.Add('Node:      ' + (& node -v 2>$null))
    $o.Add('npm:       ' + (& npm.cmd -v 2>$null))
    $n = Get-Command node -ErrorAction SilentlyContinue
    if ($n) { $o.Add("Node path: $($n.Source)") }
    # mpv.exe specifically: plain 'mpv' resolves to the mpv.com launcher.
    $mpv = Get-Command mpv.exe -ErrorAction SilentlyContinue
    if ($mpv) {
      $o.Add("mpv:       $($mpv.Source)")
      $o.Add('           ' + ((& mpv --version 2>$null) | Select-Object -First 1))
    } else { $o.Add('mpv:       NOT FOUND') }
    $ep = Join-Path $env:APPDIR 'node_modules\electron\package.json'
    if (Test-Path $ep) { $o.Add('Electron:  ' + (Get-Content $ep -Raw | ConvertFrom-Json).version) }
    $o | Set-Content -Encoding UTF8 (Join-Path $env:RESULTS 'sysinfo.txt')
  }

  'publish' {
    # The outcome is echoed by the batch file, where & | < > ^ and quotes are
    # commands: git's "HEAD -> main" would write the summary into a file.
    # Every line leaves here with those characters replaced.
    & {
      # Publish this release to GitHub. The batch file calls this only when
      # every check passed and the video check confirmed the default layout.
      # Never force-pushes: the commit goes on top of what is already there,
      # so nothing on GitHub can be overwritten. Never publishes a version
      # twice: each release is tagged, and an existing tag means skip. No
      # password is stored anywhere: git uses your own sign-in (Git for
      # Windows asks through the browser the first time). The last line
      # printed is the outcome, for the summary.
      $repo = 'https://github.com/BritMat/bm-player.git'
      if ($env:BM_PUBLISH_REPO) { $repo = $env:BM_PUBLISH_REPO }   # for testing against a local repository
      $work = Join-Path $env:BMDIR 'bm-player-git'
      $env:GIT_TERMINAL_PROMPT = '0'
      function Invoke-Git([string[]]$GitArgs, [int]$TimeoutMs = 600000) {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = 'git'
        $psi.Arguments = ($GitArgs | ForEach-Object { if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ } }) -join ' '
        $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true
        $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
        $proc = [System.Diagnostics.Process]::Start($psi)
        $errTask = $proc.StandardError.ReadToEndAsync()
        $out = $proc.StandardOutput.ReadToEnd()
        if (-not $proc.WaitForExit($TimeoutMs)) { try { $proc.Kill() } catch { }; return @{ code = 124; out = 'timed out' } }
        return @{ code = $proc.ExitCode; out = ($out + $errTask.Result).Trim() }
      }
      if (-not (Get-Command git -ErrorAction SilentlyContinue)) { 'skipped: Git is not installed. Install Git for Windows to publish.'; return }
      $pkg = Get-Content (Join-Path $env:APPDIR 'package.json') -Raw | ConvertFrom-Json
      $ver = [string]$pkg.version
      if ($ver -notmatch '^\d+\.\d+\.\d+$') { 'skipped: no valid version in package.json'; return }
      $tag = 'v' + $ver
      'Checking GitHub for ' + $tag + '...'
      $r = Invoke-Git @('ls-remote', '--tags', $repo, ('refs/tags/' + $tag))
      if ($r.code -ne 0) { 'FAILED: could not reach ' + $repo + ' - ' + ($r.out -split "`n")[0]; return }
      if ($r.out -match ('refs/tags/' + [regex]::Escape($tag))) { 'skipped: ' + $tag + ' is already on GitHub'; return }
      # Only ever forwards: never publish a version older than the newest one
      # already on GitHub, which running the checker with an old zip would do.
      $r = Invoke-Git @('ls-remote', '--tags', $repo)
      $newest = $null
      foreach ($line in ($r.out -split "`n")) {
        if ($line -match 'refs/tags/v(\d+\.\d+\.\d+)$') { $v = [version]$Matches[1]; if (-not $newest -or $v -gt $newest) { $newest = $v } }
      }
      if ($newest -and ([version]$ver) -le $newest) { 'skipped: ' + $tag + ' is not newer than v' + $newest + ', the newest on GitHub'; return }
      # A clone of its own, next to the batch file. It is emptied and refilled
      # below, so first make sure it really is that clone and nothing else.
      if (-not (Test-Path (Join-Path $work '.git'))) {
        if (Test-Path $work) { 'FAILED: ' + $work + ' exists but is not a git clone; move it away and run again'; return }
        $r = Invoke-Git @('clone', '-q', $repo, $work)
        if ($r.code -ne 0) { 'FAILED: could not clone ' + $repo + ' - ' + ($r.out -split "`n")[0]; return }
      } else {
        $r = Invoke-Git @('-C', $work, 'fetch', '-q', 'origin')
        if ($r.code -ne 0) { 'FAILED: could not fetch from GitHub - ' + ($r.out -split "`n")[0]; return }
      }
      if ((Split-Path $work -Leaf) -ne 'bm-player-git' -or -not (Test-Path (Join-Path $work '.git'))) { 'FAILED: unexpected work folder ' + $work; return }
      $r = Invoke-Git @('-C', $work, 'remote', 'get-url', 'origin')
      if ($r.out -ne $repo) { 'FAILED: ' + $work + ' points at ' + $r.out + ', not ' + $repo; return }
      $branch = 'main'
      $r = Invoke-Git @('-C', $work, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD')
      if ($r.code -eq 0 -and $r.out -match '^origin/(.+)$') { $branch = $Matches[1] }
      $r = Invoke-Git @('-C', $work, 'rev-parse', '--verify', '-q', ('origin/' + $branch))
      if ($r.code -eq 0) { $r = Invoke-Git @('-C', $work, 'checkout', '-q', '-B', $branch, ('origin/' + $branch)) }
      else { $r = Invoke-Git @('-C', $work, 'checkout', '-q', '-B', $branch) }
      if ($r.code -ne 0) { 'FAILED: could not check out ' + $branch + ' - ' + ($r.out -split "`n")[0]; return }
      # The repository matches the release: everything but the .git folder is
      # replaced by the release files, leaving out installed packages, build
      # output and test results.
      Get-ChildItem -LiteralPath $work -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force
      $skip = @('node_modules', 'dist', '.git', 'BM-Player-results')
      function Copy-Release([string]$from, [string]$to) {
        foreach ($e in (Get-ChildItem -LiteralPath $from -Force)) {
          if ($skip -contains $e.Name) { continue }
          $dest = Join-Path $to $e.Name
          if ($e.PSIsContainer) { New-Item -ItemType Directory -Path $dest -Force | Out-Null; Copy-Release $e.FullName $dest }
          elseif ($e.Extension -ne '.log') { Copy-Item -LiteralPath $e.FullName -Destination $dest -Force }
        }
      }
      try { Copy-Release $env:APPDIR $work } catch { 'FAILED: copying the release into the clone - ' + $_.Exception.Message; return }
      $r = Invoke-Git @('-C', $work, 'config', 'user.email')
      if (-not $r.out) {
        Invoke-Git @('-C', $work, 'config', 'user.name', 'Bristo') | Out-Null
        Invoke-Git @('-C', $work, 'config', 'user.email', 'reach.bristo@gmail.com') | Out-Null
      }
      Invoke-Git @('-C', $work, 'add', '-A') | Out-Null
      $r = Invoke-Git @('-C', $work, 'status', '--porcelain')
      if (-not $r.out) { 'skipped: the repository already matches ' + $tag; return }
      $r = Invoke-Git @('-C', $work, 'commit', '-q', '-m', ('BM Player ' + $tag), '-m', 'Published by BM-Player-Check after every check passed on a real Windows machine.')
      if ($r.code -ne 0) { 'FAILED: commit - ' + ($r.out -split "`n")[0]; return }
      $r = Invoke-Git @('-C', $work, 'tag', '-a', $tag, '-m', ('BM Player ' + $tag))
      if ($r.code -ne 0) { 'FAILED: tag - ' + ($r.out -split "`n")[0]; return }
      'Pushing ' + $tag + ' to ' + $branch + '... (the first time, Git may ask you to sign in to GitHub)'
      $r = Invoke-Git @('-C', $work, 'push', '-q', 'origin', ('HEAD:refs/heads/' + $branch))
      if ($r.code -ne 0) {
        Invoke-Git @('-C', $work, 'tag', '-d', $tag) | Out-Null
        if ($r.out -match 'non-fast-forward|fetch first|rejected') { 'FAILED: GitHub has newer changes than this release is based on; nothing was overwritten. Run the check again.'; return }
        'FAILED: push - ' + ($r.out -split "`n")[0] + ' (sign in to GitHub with Git, then run again)'; return
      }
      $r = Invoke-Git @('-C', $work, 'push', '-q', 'origin', ('refs/tags/' + $tag))
      if ($r.code -ne 0) { 'published ' + $tag + ' to ' + $branch + ', but the tag did not push: ' + ($r.out -split "`n")[0]; return }
      'published ' + $tag + ' to github.com/BritMat/bm-player (' + $branch + ')'
    } | ForEach-Object { ([string]$_) -replace '[&|<>^%!"()]', ' ' }
  }

  'zip' {
    $dest = Join-Path $env:BMDIR 'BM-Player-results.zip'
    if (Test-Path $dest) { Remove-Item $dest -Force }
    # Built by hand: Compress-Archive in Windows PowerShell 5.1 writes paths
    # with backslashes, which other tools only read with a warning.
    Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
    $root = (Resolve-Path $env:RESULTS).Path.TrimEnd('\')
    $zip = [IO.Compression.ZipFile]::Open($dest, 'Create')
    try {
      Get-ChildItem -LiteralPath $root -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel) | Out-Null
      }
    } finally { $zip.Dispose() }
    if (Test-Path $dest) { Write-Output $dest } else { exit 1 }
  }
}
