; mpv, the engine BM Player plays video with, is not inside the installer (it
; would add about 70 MB): the installer downloads it from mpv's Windows builds
; on GitHub, checks it against the SHA-256 the release was tested with, and
; unpacks it into resources\mpv, where the app looks first. If that fails,
; BM Player still installs, and the installer says how to get mpv.
;
; v3.25.1: the first version unpacked with the Nsis7z plugin only, and on
; GitHub's Windows machine no mpv.exe appeared. mpv's archives use the BCJ2
; filter, which not every 7-Zip decoder supports (Python's py7zr refuses it).
; Each stage now has two independent ways, and every step is written to
; resources\mpv-install.log, so a failure says exactly where it happened:
;   download: the INetC plugin (with a progress bar), then Windows' curl.exe
;   unpack:   Windows' tar.exe (libarchive, which unpacks this archive), then Nsis7z
; The installer is a 32-bit program, so Windows' own 64-bit tools are reached
; through Sysnative, with the ordinary system folder as a fallback.
!include LogicLib.nsh
!include "${BUILD_RESOURCES_DIR}\mpv-source.nsh"

; The log file handle lives in $9 (saved and restored with the other registers:
; a declared Var would be an unused-variable warning in electron-builder's
; uninstaller pass, and it builds with -WX, warnings as errors).
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

!macro bmGetMpv
  Push $0
  Push $1
  Push $2
  Push $3
  Push $9
  ${IfNot} ${FileExists} "$INSTDIR\resources\mpv\mpv.exe"
    InitPluginsDir
    CreateDirectory "$INSTDIR\resources\mpv"
    FileOpen $9 "$INSTDIR\resources\mpv-install.log" w
    !insertmacro bmLog "mpv ${MPV_BUILD} from ${MPV_URL}"
    DetailPrint "Downloading mpv ${MPV_BUILD} from GitHub..."

    ; 1. Download: INetC, then curl.exe
    ${If} ${Silent}
      inetc::get /SILENT "${MPV_URL}" "$PLUGINSDIR\mpv.7z" /END
    ${Else}
      inetc::get /CAPTION "Downloading mpv, the video engine" "${MPV_URL}" "$PLUGINSDIR\mpv.7z" /END
    ${EndIf}
    Pop $0
    !insertmacro bmLog "download with INetC: $0"
    ${If} $0 != "OK"
    ${OrIfNot} ${FileExists} "$PLUGINSDIR\mpv.7z"
      Delete "$PLUGINSDIR\mpv.7z"
      !insertmacro bmTool $3 "curl.exe"
      nsExec::ExecToStack '"$3" -L --fail --silent --show-error --retry 2 -o "$PLUGINSDIR\mpv.7z" "${MPV_URL}"'
      Pop $1
      Pop $2
      !insertmacro bmLog "download with $3: exit $1 $2"
      ${If} $1 == "0"
        StrCpy $0 "OK"
      ${Else}
        StrCpy $0 "the download failed (INetC and curl)"
      ${EndIf}
    ${EndIf}

    ; 2. Exactly the build the release was tested with, or nothing. The path
    ;    goes through the environment, so no quoting can break the command.
    ${If} $0 == "OK"
      ; PowerShell compares and answers with its exit code (0: the same), so
      ; nothing it prints can upset the comparison; the hash it saw is logged.
      System::Call 'Kernel32::SetEnvironmentVariable(t "BM_MPV_FILE", t "$PLUGINSDIR\mpv.7z")'
      System::Call 'Kernel32::SetEnvironmentVariable(t "BM_MPV_SHA256", t "${MPV_SHA256}")'
      nsExec::ExecToStack 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$$h = (Get-FileHash -Algorithm SHA256 -LiteralPath $$env:BM_MPV_FILE).Hash; Write-Output $$h; if ($$h -eq $$env:BM_MPV_SHA256) { exit 0 } else { exit 3 }"'
      Pop $1
      Pop $2
      !insertmacro bmLog "SHA-256 check: exit $1, saw $2 expected ${MPV_SHA256}"
      ${If} $1 != "0"
        StrCpy $0 "the download did not match its checksum"
      ${EndIf}
    ${EndIf}

    ; 3. Unpack: tar.exe, then Nsis7z
    ${If} $0 == "OK"
      !insertmacro bmTool $3 "tar.exe"
      nsExec::ExecToStack '"$3" -xf "$PLUGINSDIR\mpv.7z" -C "$INSTDIR\resources\mpv"'
      Pop $1
      Pop $2
      !insertmacro bmLog "unpack with $3: exit $1 $2"
      ${IfNot} ${FileExists} "$INSTDIR\resources\mpv\mpv.exe"
        SetOutPath "$INSTDIR\resources\mpv"
        Nsis7z::Extract "$PLUGINSDIR\mpv.7z"
        SetOutPath "$INSTDIR"
        !insertmacro bmLog "unpack with Nsis7z: done"
      ${EndIf}
      ${IfNot} ${FileExists} "$INSTDIR\resources\mpv\mpv.exe"
        StrCpy $0 "the download could not be unpacked"
      ${EndIf}
    ${EndIf}
    Delete "$PLUGINSDIR\mpv.7z"

    ${If} ${FileExists} "$INSTDIR\resources\mpv\mpv.exe"
      DetailPrint "mpv ${MPV_BUILD} installed."
      !insertmacro bmLog "result: mpv.exe installed"
    ${Else}
      DetailPrint "mpv was not installed: $0"
      !insertmacro bmLog "result: not installed: $0"
      ${IfNot} ${Silent}
        MessageBox MB_OK|MB_ICONEXCLAMATION "BM Player is installed, but mpv, the engine it plays video with, could not be downloaded ($0).$\r$\n$\r$\nConnect to the internet and run this installer again, or put mpv.exe in:$\r$\n$INSTDIR\resources\mpv"
      ${EndIf}
    ${EndIf}
    FileClose $9
  ${EndIf}
  Pop $9
  Pop $3
  Pop $2
  Pop $1
  Pop $0
!macroend
