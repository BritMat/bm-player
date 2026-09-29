; mpv, the engine BM Player plays video with, is not inside the installer (it
; would add about 70 MB): the installer downloads it from mpv's Windows builds
; on GitHub and checks it against the SHA-256 the release was tested with.
;
; v3.25.2: everything that can fail happens at start-up (customInit, in
; .onInit), before the old version is removed or a file is copied: download,
; checksum, unpack into the installer's temporary folder, and a check that
; mpv.exe and mpv.com are there. On any failure the installer stops with the
; existing installation untouched (interactively it offers Retry or Cancel;
; silent installs, as updates and GitHub run them, exit with code 2). After
; the app's files are in place (customInstall) the verified mpv is copied in.
; It used to run after the files were copied, where stopping would have left
; BM Player half installed, and it did not stop at all.
;
; The checksum is .NET's SHA-256, called from PowerShell without any cmdlet:
; on GitHub, Windows PowerShell started from PowerShell 7 inherited its
; PSModulePath and could not load Get-FileHash ("not recognized"), which is
; why v3.25.1 fetched but never installed mpv. PSModulePath is cleared for it
; too, and certutil is the fallback. Each stage keeps a second way:
;   download: INetC, then Windows' curl.exe
;   checksum: PowerShell with .NET, then certutil.exe
;   unpack:   Windows' tar.exe (libarchive, which handles mpv's BCJ2), then Nsis7z
; and is written to %TEMP%\BM-Player-mpv-install.log, copied to
; resources\mpv-install.log once installed. The installer is a 32-bit program,
; so Windows' own 64-bit tools are reached through Sysnative.
;
; Only macros, no Function and no Var: electron-builder builds with -WX, and an
; unreferenced function or variable in its uninstaller pass is an error.
!include LogicLib.nsh
!include "${BUILD_RESOURCES_DIR}\mpv-source.nsh"

!macro bmLog text
  FileWrite $9 "${text}$\r$\n"
!macroend

; The path of a Windows tool: the 64-bit one when it exists, else the system folder's.
!macro bmTool out name
  StrCpy ${out} "$WINDIR\Sysnative\${name}"
  ${IfNot} ${FileExists} "${out}"
    StrCpy ${out} "$SYSDIR\${name}"
  ${EndIf}
!macroend

; customInit: fetch, verify and unpack mpv into $PLUGINSDIR\mpv, or stop.
!macro bmFetchMpv
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  Push $5
  Push $6
  Push $7
  Push $9
  InitPluginsDir
  FileOpen $9 "$TEMP\BM-Player-mpv-install.log" w
  !insertmacro bmLog "mpv ${MPV_BUILD} from ${MPV_URL}"
  ${Do}
    StrCpy $0 "OK"
    Delete "$PLUGINSDIR\mpv.7z"
    RMDir /r "$PLUGINSDIR\mpv"

    ; 1. Download: INetC, then curl.exe
    ${If} ${Silent}
      inetc::get /SILENT "${MPV_URL}" "$PLUGINSDIR\mpv.7z" /END
    ${Else}
      inetc::get /POPUP "" /CAPTION "BM Player: downloading mpv, the video engine" "${MPV_URL}" "$PLUGINSDIR\mpv.7z" /END
    ${EndIf}
    Pop $1
    !insertmacro bmLog "download with INetC: $1"
    ${If} $1 != "OK"
    ${OrIfNot} ${FileExists} "$PLUGINSDIR\mpv.7z"
      Delete "$PLUGINSDIR\mpv.7z"
      !insertmacro bmTool $3 "curl.exe"
      nsExec::ExecToStack '"$3" -L --fail --silent --show-error --retry 2 -o "$PLUGINSDIR\mpv.7z" "${MPV_URL}"'
      Pop $1
      Pop $2
      !insertmacro bmLog "download with $3: exit $1 $2"
      ${If} $1 != "0"
        StrCpy $0 "the download failed"
      ${EndIf}
    ${EndIf}

    ; 2. Checksum: .NET's SHA-256 through PowerShell (no cmdlets), then certutil.
    ;    The file and the expected hash go through the environment, so no
    ;    quoting can break the command.
    ${If} $0 == "OK"
      System::Call 'Kernel32::SetEnvironmentVariable(t "PSModulePath", p 0)'
      System::Call 'Kernel32::SetEnvironmentVariable(t "BM_MPV_FILE", t "$PLUGINSDIR\mpv.7z")'
      System::Call 'Kernel32::SetEnvironmentVariable(t "BM_MPV_SHA256", t "${MPV_SHA256}")'
      !insertmacro bmTool $3 "WindowsPowerShell\v1.0\powershell.exe"
      nsExec::ExecToStack `"$3" -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$$s = [IO.File]::OpenRead($$env:BM_MPV_FILE); try { $$h = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($$s)).Replace('-', '') } finally { $$s.Dispose() }; $$h; if ($$h -eq $$env:BM_MPV_SHA256) { exit 0 } else { exit 3 }"`
      Pop $1
      Pop $2
      !insertmacro bmLog "SHA-256 with PowerShell (.NET): exit $1, saw $2"
      ${If} $1 != "0"
        ; certutil prints the hash on a line of its own (lowercase, and without
        ; spaces on Windows 10 and later): look for the expected one in its output.
        !insertmacro bmTool $3 "certutil.exe"
        nsExec::ExecToStack '"$3" -hashfile "$PLUGINSDIR\mpv.7z" SHA256'
        Pop $1
        Pop $2
        StrCpy $5 "no"
        StrCpy $4 0
        ${Do}
          StrCpy $6 $2 64 $4
          StrLen $7 $6
          ${If} $7 < 64
            ${ExitDo}
          ${EndIf}
          ${If} $6 == "${MPV_SHA256}"
            StrCpy $5 "yes"
            ${ExitDo}
          ${EndIf}
          IntOp $4 $4 + 1
        ${Loop}
        !insertmacro bmLog "SHA-256 with certutil: exit $1, match $5"
        ${If} $5 != "yes"
          StrCpy $0 "the download did not match its checksum"
        ${EndIf}
      ${EndIf}
    ${EndIf}

    ; 3. Unpack into $PLUGINSDIR\mpv: tar.exe, then Nsis7z
    ${If} $0 == "OK"
      CreateDirectory "$PLUGINSDIR\mpv"
      !insertmacro bmTool $3 "tar.exe"
      nsExec::ExecToStack '"$3" -xf "$PLUGINSDIR\mpv.7z" -C "$PLUGINSDIR\mpv"'
      Pop $1
      Pop $2
      !insertmacro bmLog "unpack with $3: exit $1 $2"
      ${IfNot} ${FileExists} "$PLUGINSDIR\mpv\mpv.exe"
        ; Nsis7z unpacks into the output folder, which electron-builder's
        ; .onInit set: put it back afterwards.
        StrCpy $4 $OUTDIR
        SetOutPath "$PLUGINSDIR\mpv"
        Nsis7z::Extract "$PLUGINSDIR\mpv.7z"
        SetOutPath $4
        !insertmacro bmLog "unpack with Nsis7z: done"
      ${EndIf}
      ${IfNot} ${FileExists} "$PLUGINSDIR\mpv\mpv.exe"
      ${OrIfNot} ${FileExists} "$PLUGINSDIR\mpv\mpv.com"
        StrCpy $0 "the download could not be unpacked"
      ${EndIf}
    ${EndIf}
    Delete "$PLUGINSDIR\mpv.7z"

    ${If} $0 == "OK"
      !insertmacro bmLog "result: mpv ready to install"
      ${ExitDo}
    ${EndIf}
    !insertmacro bmLog "result: $0"
    ${If} ${Silent}
      ${ExitDo}
    ${EndIf}
    ${IfNot} ${Cmd} `MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "BM Player could not get mpv, the engine it plays video with: $0.$\r$\n$\r$\nCheck your internet connection and choose Retry, or Cancel to stop. Nothing has been changed." IDRETRY`
      ${ExitDo}
    ${EndIf}
    !insertmacro bmLog "retry"
  ${Loop}
  FileClose $9
  ${If} $0 != "OK"
    ; Stop before anything is changed: no half-installed BM Player.
    SetErrorLevel 2
    Pop $9
    Pop $7
    Pop $6
    Pop $5
    Pop $4
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Abort
  ${EndIf}
  Pop $9
  Pop $7
  Pop $6
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
!macroend

; customInstall: copy the verified mpv into place, with its log.
!macro bmPlaceMpv
  CreateDirectory "$INSTDIR\resources\mpv"
  CopyFiles /SILENT "$PLUGINSDIR\mpv\*.*" "$INSTDIR\resources\mpv"
  CopyFiles /SILENT "$TEMP\BM-Player-mpv-install.log" "$INSTDIR\resources\mpv-install.log"
!macroend
