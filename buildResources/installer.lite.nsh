# NSIS custom installer macros for BM Player Lite (v1.9.0)
#
# Identical in structure to buildResources/installer.nsh but registers
# the app under "BM Player Lite" instead of "BM Player" so that:
#   (a) the Lite installer's file associations don't overwrite the
#       Professional installer's (and vice versa) when both are
#       installed side-by-side on the same machine;
#   (b) the Windows "Default Apps" picker shows two distinct entries
#       ("BM Player" and "BM Player Lite") instead of one stomping
#       the other.
#
# Reference: https://learn.microsoft.com/en-us/windows/win32/shell/default-programs
!macro customInstall
  WriteRegStr HKCU "Software\RegisteredApplications" "BM Player Lite" "Software\Clients\Media\BM Player Lite\Capabilities"
  WriteRegStr HKCU "Software\Clients\Media\BM Player Lite\Capabilities" "ApplicationName" "BM Player Lite"
  WriteRegStr HKCU "Software\Clients\Media\BM Player Lite\Capabilities" "ApplicationDescription" "A lightweight media player for low-spec hardware (4GB RAM, Intel UHD 610 class GPU)"
  WriteRegStr HKCU "Software\Classes\BMPlayerLite.Video" "" "Video file (BM Player Lite)"
  WriteRegStr HKCU "Software\Classes\BMPlayerLite.Video\DefaultIcon" "" "$INSTDIR\BM Player Lite.exe,0"
  WriteRegStr HKCU "Software\Classes\BMPlayerLite.Video\shell\open\command" "" '"$INSTDIR\BM Player Lite.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\BMPlayerLite.Audio" "" "Audio file (BM Player Lite)"
  WriteRegStr HKCU "Software\Classes\BMPlayerLite.Audio\DefaultIcon" "" "$INSTDIR\BM Player Lite.exe,0"
  WriteRegStr HKCU "Software\Classes\BMPlayerLite.Audio\shell\open\command" "" '"$INSTDIR\BM Player Lite.exe" "%1"'
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend
!macro customUninstall
  DeleteRegKey HKCU "Software\Clients\Media\BM Player Lite"
  DeleteRegValue HKCU "Software\RegisteredApplications" "BM Player Lite"
  DeleteRegKey HKCU "Software\Classes\BMPlayerLite.Video"
  DeleteRegKey HKCU "Software\Classes\BMPlayerLite.Audio"
!macroend
