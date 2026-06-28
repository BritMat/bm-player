!macro customInstall
  WriteRegStr HKCU "Software\RegisteredApplications" "BM Player" "Software\Clients\Media\BM Player\Capabilities"
  WriteRegStr HKCU "Software\Clients\Media\BM Player\Capabilities" "ApplicationName" "BM Player"
  WriteRegStr HKCU "Software\Clients\Media\BM Player\Capabilities" "ApplicationDescription" "A professional media player powered by mpv"
  WriteRegStr HKCU "Software\Classes\BMPlayer.Video" "" "Video file"
  WriteRegStr HKCU "Software\Classes\BMPlayer.Video\DefaultIcon" "" "$INSTDIR\BM Player.exe,0"
  WriteRegStr HKCU "Software\Classes\BMPlayer.Video\shell\open\command" "" '"$INSTDIR\BM Player.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\BMPlayer.Audio" "" "Audio file"
  WriteRegStr HKCU "Software\Classes\BMPlayer.Audio\DefaultIcon" "" "$INSTDIR\BM Player.exe,0"
  WriteRegStr HKCU "Software\Classes\BMPlayer.Audio\shell\open\command" "" '"$INSTDIR\BM Player.exe" "%1"'
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend
!macro customUninstall
  DeleteRegKey HKCU "Software\Clients\Media\BM Player"
  DeleteRegValue HKCU "Software\RegisteredApplications" "BM Player"
  DeleteRegKey HKCU "Software\Classes\BMPlayer.Video"
  DeleteRegKey HKCU "Software\Classes\BMPlayer.Audio"
!macroend
