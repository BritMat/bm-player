; The mpv build the installer downloads: the plain 64-bit build from
; shinchiro/mpv-winbuild-cmake, as kept in this repository's own mpv-<build>
; release (v3.50.0: shinchiro deletes builds after about a month). The
; release job on GitHub rewrites this file with the exact archive it tested
; and that archive's SHA-256. What is here is for a build made by hand,
; which has nothing to check against: it points at the copy, and the
; checksum is left for the release job to fill in.
!define MPV_BUILD "20261105"
!define MPV_URL "https://github.com/BritMat/bm-player/releases/download/mpv-20261105/mpv-x86_64-20261105.7z"
!define MPV_SHA256 "0000000000000000000000000000000000000000000000000000000000000000"
