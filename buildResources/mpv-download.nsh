; mpv, the engine BM Player plays video with, is not inside the installer (it
; would add about 70 MB): the installer downloads it from mpv's Windows builds
; on GitHub, checks it against the SHA-256 the release was tested with, and
; unpacks it into resources\mpv, where the app looks first. If that fails,
; BM Player still installs, and the installer says how to get mpv.
!include LogicLib.nsh
!include "${BUILD_RESOURCES_DIR}\mpv-source.nsh"

!macro bmGetMpv
  ${IfNot} ${FileExists} "$INSTDIR\resources\mpv\mpv.exe"
    InitPluginsDir
    DetailPrint "Downloading mpv ${MPV_BUILD} from GitHub..."
    ${If} ${Silent}
      inetc::get /SILENT "${MPV_URL}" "$PLUGINSDIR\mpv.7z" /END
    ${Else}
      inetc::get /CAPTION "Downloading mpv, the video engine" "${MPV_URL}" "$PLUGINSDIR\mpv.7z" /END
    ${EndIf}
    Pop $0
    ${If} $0 == "OK"
      ; Exactly the build the release was tested with, or nothing. The path
      ; goes through the environment, so no quoting can break the command.
      System::Call 'Kernel32::SetEnvironmentVariable(t "BM_MPV_FILE", t "$PLUGINSDIR\mpv.7z")'
      nsExec::ExecToStack 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "(Get-FileHash -Algorithm SHA256 -LiteralPath $$env:BM_MPV_FILE).Hash"'
      Pop $1
      Pop $2
      StrCpy $2 $2 64
      ${If} $2 == "${MPV_SHA256}"
        CreateDirectory "$INSTDIR\resources\mpv"
        SetOutPath "$INSTDIR\resources\mpv"
        Nsis7z::Extract "$PLUGINSDIR\mpv.7z"
        SetOutPath "$INSTDIR"
        ${IfNot} ${FileExists} "$INSTDIR\resources\mpv\mpv.exe"
          StrCpy $0 "the download did not contain mpv.exe"
        ${EndIf}
      ${Else}
        StrCpy $0 "the download did not match its checksum"
      ${EndIf}
      Delete "$PLUGINSDIR\mpv.7z"
    ${EndIf}
    ${If} ${FileExists} "$INSTDIR\resources\mpv\mpv.exe"
      DetailPrint "mpv ${MPV_BUILD} installed."
    ${Else}
      DetailPrint "mpv was not installed: $0"
      ${IfNot} ${Silent}
        MessageBox MB_OK|MB_ICONEXCLAMATION "BM Player is installed, but mpv, the engine it plays video with, could not be downloaded ($0).$\r$\n$\r$\nConnect to the internet and run this installer again, or put mpv.exe in:$\r$\n$INSTDIR\resources\mpv"
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend
