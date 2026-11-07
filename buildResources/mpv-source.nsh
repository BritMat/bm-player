; The mpv build the installer downloads: the plain 64-bit build from
; shinchiro/mpv-winbuild-cmake, as kept in this repository's own mpv-<build>
; release (v3.50.0: shinchiro deletes builds after about a month). The
; release job on GitHub rewrites this file with the exact archive it tested
; and that archive's SHA-256.
!define MPV_BUILD "20261105"
!define MPV_URL "https://github.com/BritMat/bm-player/releases/download/mpv-20261105/mpv-x86_64-20261105-git-3138fc8eea.7z"
!define MPV_SHA256 "89aa56f9769f81f783576183212e7b4802c91909ecf860b4468113cbfd106d93"
