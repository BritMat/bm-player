package io.github.britmat.bmplayer;

import java.nio.file.Files;
import java.nio.file.Paths;

/**
 * Releases.java, which picks the update from GitHub's list of releases, tried
 * on a computer against android/test/releases.json: GitHub's answer as its API
 * gives it, with a draft, an upload still going, a file from elsewhere, a
 * checksum in capitals and releases out of order (scripts/updater-check.mjs).
 */
public class TestReleases {
    static int fails = 0;
    static void ok(boolean c, String what) { System.out.println((c ? "  ok   " : "  FAIL ") + what); if (!c) fails++; }
    public static void main(String[] a) throws Exception {
        String json = new String(Files.readAllBytes(Paths.get(a[0])), "UTF-8");
        Releases.Apk n = Releases.newest(json);
        ok(n != null, "an APK is found");
        ok("3.45.0".equals(n.version), "the newest finished, published APK wins: 3.45.0 (not the draft's 3.47.0, the unfinished 3.45.1, or a file from elsewhere): " + n.version);
        ok(n.url.equals("https://github.com/BritMat/bm-player/releases/download/v3.45.0/BM-Player-3.45.0-android.apk"), "its download address");
        ok(n.size == 30500000, "its size");
        ok("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".equals(n.sha256), "GitHub's SHA-256");
        ok(!n.prerelease && "v3.45.0".equals(n.tag) && n.page.endsWith("/v3.45.0"), "its tag, page and pre-release flag");
        ok(Releases.sha256Of("sha256:9C77BFF66B641C1F73C51A7534BE6AFAAD007DBA61F559390FB0F3DE3906372C").equals("9c77bff66b641c1f73c51a7534be6afaad007dba61f559390fb0f3de3906372c"), "an upper-case digest is read");
        ok(Releases.sha256Of("sha256:aaaa") == null && Releases.sha256Of("md5:00") == null && Releases.sha256Of(null) == null, "a short or other digest is not");
        ok(Releases.compare("3.44.0", "3.43.2") > 0 && Releases.compare("v3.44.0", "3.44.0") == 0 && Releases.compare("3.9.0", "3.10.0") < 0, "versions compare as numbers (3.9 before 3.10)");
        ok(Releases.compare("3.44", "3.44.0") == 0 && Releases.compare("3.44.1-beta", "3.44.1") == 0 && Releases.compare("", "0.0.0") == 0, "and short or tagged ones");
        ok(Releases.code("3.44.0") == 34400 && Releases.code("3.43.2") == 34302, "version codes as the build makes them");
        ok(Releases.newest("[]") == null, "no releases: nothing");
        ok(Releases.newest("[{\"tag_name\":\"v1\",\"assets\":[]}]") == null, "releases without an APK: nothing");
        Releases.Apk back = Releases.Apk.from(n.json());
        ok(back != null && back.version.equals(n.version) && back.size == n.size && n.sha256.equals(back.sha256) && back.url.equals(n.url), "kept and read back");
        ok(Releases.Apk.from(new org.json.JSONObject("{\"version\":\"9.9.9\",\"url\":\"https://evil.example/x.apk\"}")) == null, "a kept one from elsewhere is refused");
        boolean threw = false;
        try { Releases.newest("{\"message\":\"API rate limit exceeded\"}"); } catch (org.json.JSONException e) { threw = true; }
        ok(threw, "GitHub's error object is not read as a list");
        System.out.println(fails == 0 ? "\nReleases: all passed" : "\nReleases: " + fails + " failed");
        System.exit(fails == 0 ? 0 : 1);
    }
}
