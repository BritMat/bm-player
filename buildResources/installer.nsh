; BM Player — Custom NSIS installer header
; Included by electron-builder automatically

!macro customInit
  ; Set installer colors (optional: requires NSIS Modern UI)
!macroend

!macro customInstall
  ; Register file associations after install
  WriteRegStr HKCU "SOFTWARE\Classes\.mp4\OpenWithList\BMPlayer.exe" "" ""
  WriteRegStr HKCU "SOFTWARE\Classes\.mkv\OpenWithList\BMPlayer.exe" "" ""
  WriteRegStr HKCU "SOFTWARE\Classes\.avi\OpenWithList\BMPlayer.exe" "" ""
  WriteRegStr HKCU "SOFTWARE\Classes\.mp3\OpenWithList\BMPlayer.exe" "" ""
  WriteRegStr HKCU "SOFTWARE\Classes\.flac\OpenWithList\BMPlayer.exe" "" ""
!macroend

!macro customUnInstall
  ; Clean up registry entries on uninstall
  DeleteRegKey HKCU "SOFTWARE\Classes\.mp4\OpenWithList\BMPlayer.exe"
  DeleteRegKey HKCU "SOFTWARE\Classes\.mkv\OpenWithList\BMPlayer.exe"
  DeleteRegKey HKCU "SOFTWARE\Classes\.avi\OpenWithList\BMPlayer.exe"
  DeleteRegKey HKCU "SOFTWARE\Classes\.mp3\OpenWithList\BMPlayer.exe"
  DeleteRegKey HKCU "SOFTWARE\Classes\.flac\OpenWithList\BMPlayer.exe"
!macroend
