@echo off
setlocal EnableExtensions
title BM Player - automatic check
rem ==================================================================
rem  BM Player automatic check
rem
rem  Put this file in a folder next to the BM-Player-v*.zip and run it.
rem  Right-click then Run as administrator is fine. It needs no input.
rem  Takes roughly 10 to 20 minutes, mostly downloading Electron.
rem
rem  When it finishes it opens the folder. Send BM-Player-results.zip.
rem ==================================================================

rem Run as administrator starts in System32, so go to this file's folder.
cd /d "%~dp0"
set "BMDIR=%~dp0"
set "BMBAT=%~f0"
set "RESULTS=%BMDIR%BM-Player-results"
set "PS=powershell -NoProfile -ExecutionPolicy Bypass"
rem Makes a skipped check exit 3, so it is reported as skipped, not passed.
set "BM_STRICT=1"
if exist "%RESULTS%" rmdir /s /q "%RESULTS%"
mkdir "%RESULTS%" >nul 2>&1
set "LOG=%RESULTS%\run-log.txt"

echo.
echo  BM Player automatic check
echo  -------------------------
echo  You can leave this running. It will open a window or two by itself.
echo  Please don't use the mouse over those windows while it runs.
echo.
call :say "Started"
echo Folder: "%BMDIR%" >> "%LOG%"

rem ---------- 1. find the newest BM-Player zip ----------
set "ZIPNAME="
for /f "usebackq delims=" %%Z in (`%PS% -Command "$z = Get-ChildItem -LiteralPath $env:BMDIR -Filter 'BM-Player-v*.zip' | Sort-Object { $m = [regex]::Match($_.Name, '\d+\.\d+\.\d+'); if ($m.Success) { [version]$m.Value } else { [version]'0.0.0' } } -Descending | Select-Object -First 1; if ($z) { $z.Name }"`) do set "ZIPNAME=%%Z"
if not defined ZIPNAME goto :nozip
call :say "Using %ZIPNAME%"
set "OLDZIP="
%PS% -Command "$v = [regex]::Match($env:ZIPNAME, '\d+\.\d+\.\d+').Value; if (-not $v -or [version]$v -lt [version]'3.22.4') { exit 1 }" >nul 2>&1
if errorlevel 1 set "OLDZIP=1"
if defined OLDZIP call :say "NOTE: this zip is older than v3.22.4, which has fixes for Windows. Put BM-Player-v3.22.4.zip here for the best results."

rem ---------- 2. unpack it ----------
call :say "Unpacking..."
set "APPNAME="
for /f "usebackq delims=" %%T in (`%PS% -Command "$ProgressPreference = 'SilentlyContinue'; Add-Type -AssemblyName System.IO.Compression.FileSystem; $p = Join-Path $env:BMDIR $env:ZIPNAME; $z = [IO.Compression.ZipFile]::OpenRead($p); $top = ($z.Entries | ForEach-Object { ($_.FullName -split '/')[0] } | Group-Object | Sort-Object Count -Descending | Select-Object -First 1).Name; $z.Dispose(); Expand-Archive -LiteralPath $p -DestinationPath $env:BMDIR -Force; $top"`) do set "APPNAME=%%T"
if not defined APPNAME goto :badzip
set "APPDIR=%BMDIR%%APPNAME%"
if not exist "%APPDIR%\package.json" goto :badzip
%PS% -Command "Get-ChildItem -LiteralPath $env:APPDIR -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notlike '*\node_modules\*' } | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1

rem ---------- 3. add the check scripts carried inside this file ----------
%PS% -Command "$m = '#BM' + 'PAYLOAD#'; $t = [IO.File]::ReadAllText($env:BMBAT); $i = $t.LastIndexOf($m); if ($i -lt 0) { exit 1 }; $b = $t.Substring($i + $m.Length) -replace '\s', ''; $j = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b)) | ConvertFrom-Json; $n = 0; foreach ($p in $j.PSObject.Properties) { $f = Join-Path $env:APPDIR $p.Name; New-Item -ItemType Directory -Force -Path (Split-Path $f) | Out-Null; [IO.File]::WriteAllBytes($f, [Convert]::FromBase64String($p.Value)); $n++ }; 'check scripts written: ' + $n" >> "%LOG%" 2>&1
if errorlevel 1 goto :badpayload
if not exist "%APPDIR%\scripts\field-check.mjs" goto :badpayload

rem Keep the laptop awake while this runs, so a lock screen can't spoil it.
start "" /min %PS% -WindowStyle Hidden -File "%APPDIR%\tools\bm-helper.ps1" -Action awake

rem A click inside this window would pause the check (QuickEdit), and Ctrl+C
rem stops the check that is running. The last run had both.
%PS% -File "%APPDIR%\tools\bm-helper.ps1" -Action noquickedit >> "%LOG%" 2>&1
call :say "Please don't click inside this window or press Ctrl+C while it runs. It takes about 15 minutes."

rem ---------- 4. Node.js 22.12 or newer ----------
rem Electron 44 needs Node 22.12 or newer. With Node 20.12 the packages
rem installed, then Electron's download failed with ERR_REQUIRE_ESM and no
rem app check could run. So check the version first and upgrade if needed.
call :nodever
if "%NODEOK%"=="1" goto :node_ok
if defined NODEV call :say "Node.js %NODEV% is too old, 22.12 or newer is needed. Upgrading with winget, a few minutes..."
if not defined NODEV call :say "Node.js not found. Installing it with winget, a few minutes..."
set "WINGET=winget"
where winget >nul 2>&1
if errorlevel 1 set "WINGET=%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe"
"%WINGET%" upgrade -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements >> "%LOG%" 2>&1
"%WINGET%" install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements >> "%LOG%" 2>&1
set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH%"
call :nodever
if not "%NODEOK%"=="1" goto :nonode
:node_ok
echo Node in use: >> "%LOG%"
where node >> "%LOG%" 2>&1
call :say "Node.js %NODEV%"

rem ---------- 5. mpv ----------
set "MPVDIR="
where mpv >nul 2>&1
if not errorlevel 1 goto :mpv_ok
for %%D in ("%BMDIR%mpv" "%ProgramFiles%\mpv" "%LOCALAPPDATA%\Programs\mpv" "%USERPROFILE%\scoop\apps\mpv\current" "%ProgramData%\chocolatey\bin" "%LOCALAPPDATA%\Microsoft\WinGet\Links" "%LOCALAPPDATA%\Programs\BM Player\resources\mpv" "%ProgramFiles%\BM Player\resources\mpv") do if exist "%%~D\mpv.exe" if not defined MPVDIR set "MPVDIR=%%~D"
if defined MPVDIR goto :mpv_add
call :say "Looking for mpv.exe in your Desktop, Documents, Downloads and project folders..."
for /f "usebackq delims=" %%P in (`%PS% -Command "$r = @('Desktop','Documents','Downloads','source','Projects','GitHub','OneDrive\Desktop','OneDrive\Documents') | ForEach-Object { Join-Path $env:USERPROFILE $_ } | Where-Object { Test-Path $_ }; $f = Get-ChildItem -Path $r -Filter 'mpv.exe' -Recurse -Depth 6 -File -ErrorAction SilentlyContinue | Select-Object -First 1; if ($f) { $f.DirectoryName }"`) do set "MPVDIR=%%P"
if not defined MPVDIR goto :mpv_missing
:mpv_add
set "PATH=%MPVDIR%;%PATH%"
echo mpv folder: "%MPVDIR%" >> "%LOG%"
:mpv_ok
call :say "mpv found"
goto :mpv_done
:mpv_missing
call :say "mpv was NOT found. Everything else runs, but the video checks will be skipped."
:mpv_done

rem ---------- 6. dependencies ----------
call :say "Installing dependencies. This downloads Electron, so it takes a few minutes..."
pushd "%APPDIR%"
call npm install --no-audit --no-fund >> "%LOG%" 2>&1
if errorlevel 1 call :say "WARNING: npm install reported errors, see run-log.txt"
set "NOELECTRON="
if exist "node_modules\electron\dist\electron.exe" goto :electron_ok
call :say "Electron's program file is missing after install. Trying its installer once more..."
node node_modules\electron\install.js >> "%LOG%" 2>&1
if exist "node_modules\electron\dist\electron.exe" goto :electron_ok
call :say "Electron could not be installed, so the app can't start. Running the fast checks only."
set "NOELECTRON=1"
:electron_ok

rem ---------- your own video, if you put one next to this file ----------
rem Passed through an environment variable, so characters like and-signs or
rem plus signs in the file name can't upset this script.
set "BM_USER_VIDEO="
for /f "usebackq delims=" %%V in (`%PS% -Command "$x = @('.mp4','.mkv','.webm','.avi','.mov','.m4v','.ts','.m2ts','.wmv','.flv'); $f = Get-ChildItem -LiteralPath $env:BMDIR -File | Where-Object { $x -contains $_.Extension.ToLower() } | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($f) { $f.FullName }"`) do set "BM_USER_VIDEO=%%V"
if defined BM_USER_VIDEO call :say "Found a video of yours next to this file. It will be used to check playback, audio tracks and subtitles."
if not defined BM_USER_VIDEO call :say "No video of yours next to this file, so only the generated test video is used."

rem ---------- 7. the checks ----------
set "E2E_SHOTS=%RESULTS%\app-screenshots"
call :say "Check 1 of 4: fast checks, about a minute..."
call npm test > "%RESULTS%\1-fast-checks.log" 2>&1
call :result R1 %ERRORLEVEL%
call :say "   %R1%"

set "R2=not run, Electron missing"
set "R3=not run, Electron missing"
set "R4=not run, Electron missing"
if defined NOELECTRON goto :checks_done
rem The first start after a download can be slow while Windows scans the
rem new program; two starts timed out in the last run. Start it once first.
call :say "Starting BM Player once to warm up. The first start after a download can be slow..."
node scripts\e2e.mjs --part=warmup > "%RESULTS%\2-warmup.log" 2>&1
for /f "usebackq delims=" %%W in (`findstr /c:"warm-up:" "%RESULTS%\2-warmup.log"`) do call :say "   %%W"
call :say "Check 2 of 4: the real app, startup, tabs, themes, 3D fox, effects..."
node scripts\e2e.mjs --part=a > "%RESULTS%\2-app-part-a.log" 2>&1
call :result R2 %ERRORLEVEL%
call :say "   %R2%"

call :say "Check 3 of 4: the real app, music, mini bar, visualiser, video, PiP, stop..."
node scripts\e2e.mjs --part=b > "%RESULTS%\3-app-part-b.log" 2>&1
call :result R3 %ERRORLEVEL%
call :say "   %R3%"

call :say "Check 4 of 4: controls over a playing video, two ways, then your video if you gave one..."
node scripts\field-check.mjs --out "%RESULTS%\video-layer" > "%RESULTS%\4-video-layer.log" 2>&1
call :result R4 %ERRORLEVEL% finished
call :say "   %R4%"
:checks_done

rem ---------- publish to GitHub, only when everything passed ----------
rem Never force-pushes and never publishes a version twice: see the publish
rem action in bm-helper.ps1. A file named BM-NO-PUBLISH.txt next to this
rem batch file turns publishing off.
set "R5=not attempted"
if exist "%BMDIR%BM-NO-PUBLISH.txt" (set "R5=skipped: BM-NO-PUBLISH.txt is present" & goto :publish_done)
if not "%R1%"=="all passed" (set "R5=skipped: not every check passed" & goto :publish_done)
if not "%R2%"=="all passed" (set "R5=skipped: not every check passed" & goto :publish_done)
if not "%R3%"=="all passed" (set "R5=skipped: not every check passed" & goto :publish_done)
if not "%R4%"=="finished" (set "R5=skipped: the video check did not finish" & goto :publish_done)
findstr /c:"THE DEFAULT WORKS" "%RESULTS%\video-layer\summary.txt" >nul 2>&1 || (set "R5=skipped: the video check did not confirm the default" & goto :publish_done)
rem Anything the video check flagged also stops it: a failed step with your
rem video, a timeout, an error, the app not launching or not reaching mpv, a
rem layout mismatch. Not the comparison run's note that the controls could
rem not be checked, which only means the mouse moved.
findstr /l /c:"   FAIL  " /c:"DEADLINE" /c:"   error: " /c:"could not launch" /c:"could not ask mpv" /c:"could not capture" /c:"did NOT show" /c:"NOTE: asked for" "%RESULTS%\video-layer\summary.txt" >nul 2>&1 && (set "R5=skipped: the video check flagged a problem, see SUMMARY" & goto :publish_done)
call :say "Every check passed: publishing this release to GitHub..."
%PS% -File "%APPDIR%\tools\bm-helper.ps1" -Action publish > "%RESULTS%\5-publish.log" 2>&1
for /f "usebackq delims=" %%P in ("%RESULTS%\5-publish.log") do set "R5=%%P"
:publish_done
call :say "   %R5%"

rem ---------- 8. collect ----------
call :say "Collecting system details and packing the results..."
%PS% -File "%APPDIR%\tools\bm-helper.ps1" -Action sysinfo >> "%LOG%" 2>&1
taskkill /F /IM mpv.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1
%PS% -File "%APPDIR%\tools\bm-helper.ps1" -Action release >nul 2>&1
popd

> "%RESULTS%\SUMMARY.txt" echo BM Player automatic check
>> "%RESULTS%\SUMMARY.txt" echo.
>> "%RESULTS%\SUMMARY.txt" echo 1. fast checks ..................... %R1%
>> "%RESULTS%\SUMMARY.txt" echo 2. real app, startup and looks ..... %R2%
>> "%RESULTS%\SUMMARY.txt" echo 3. real app, playback and PiP ...... %R3%
>> "%RESULTS%\SUMMARY.txt" echo 4. video layer question ............ %R4%
>> "%RESULTS%\SUMMARY.txt" echo 5. publish to GitHub ............... %R5%
if defined OLDZIP >> "%RESULTS%\SUMMARY.txt" echo NOTE: run with %ZIPNAME%, older than v3.22.4
if defined NOELECTRON >> "%RESULTS%\SUMMARY.txt" echo NOTE: Electron could not be installed, see run-log.txt
>> "%RESULTS%\SUMMARY.txt" echo.
if exist "%RESULTS%\video-layer\summary.txt" type "%RESULTS%\video-layer\summary.txt" >> "%RESULTS%\SUMMARY.txt"

%PS% -File "%APPDIR%\tools\bm-helper.ps1" -Action zip >nul 2>&1

echo.
echo  ==================================================================
type "%RESULTS%\SUMMARY.txt"
echo  ==================================================================
echo.
if exist "%BMDIR%BM-Player-results.zip" (
  echo  Done. Please send this file:
  echo    BM-Player-results.zip
) else (
  echo  Done, but the results could not be zipped.
  echo  Please zip the BM-Player-results folder yourself and send it.
)
echo.
start "" "%BMDIR%"
pause
exit /b 0

rem ---------- problems ----------
:nozip
call :say "No BM-Player-v*.zip was found next to this file. Put the zip in the same folder and run again."
goto :stop
:badzip
call :say "The zip could not be unpacked, or it isn't a BM Player zip."
goto :stop
:badpayload
call :say "The check scripts inside this .bat could not be written. Was the file edited or truncated?"
goto :stop
:nonode
call :say "Node.js 22.12 or newer is needed and could not be installed automatically."
call :say "Install the LTS version from nodejs.org, then run this again."
goto :stop
:stop
echo.
echo  See "%LOG%" for details.
%PS% -File "%APPDIR%\tools\bm-helper.ps1" -Action release >nul 2>&1
pause
exit /b 1

:nodever
rem Sets NODEV (like v22.12.0) and NODEOK=1 when it is 22.12 or newer.
set "NODEV=" & set "NMAJ=0" & set "NMIN=0" & set "NODEOK=0"
where node >nul 2>&1
if errorlevel 1 exit /b 0
for /f "delims=" %%v in ('node -v') do set "NODEV=%%v"
for /f "tokens=1,2 delims=.v" %%a in ('node -v') do (set "NMAJ=%%a" & set "NMIN=%%b")
if %NMAJ% GTR 22 set "NODEOK=1"
if %NMAJ% EQU 22 if %NMIN% GEQ 12 set "NODEOK=1"
exit /b 0

:result
rem %1 variable to set, %2 exit code, %3 word for success (default: all passed)
set "OKWORD=%~3"
if not defined OKWORD set "OKWORD=all passed"
if "%~2"=="0" (set "%~1=%OKWORD%") else if "%~2"=="3" (set "%~1=SKIPPED, see its log") else (set "%~1=SOME FAILED")
exit /b 0

:say
echo  [%TIME:~0,8%] %~1
>> "%LOG%" echo [%TIME:~0,8%] %~1
exit /b 0

rem ---------- everything below is data for the script above ----------
