package io.github.britmat.bmplayer;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Which release on GitHub carries the newest Android app (v3.44.0, the
 * updater). The answer to GitHub's list of releases, read here, with no
 * Android in it, so the build can try it on a computer
 * (scripts/updater-check.mjs).
 *
 * Every release is marked pre-release on GitHub (DEVELOPMENT.md, v3.22.4), so
 * GitHub's "latest release" is none of them: the list is read instead, and the
 * newest version with an APK wins, whichever release it is on. The APK's name
 * says its version: BM-Player-3.44.0-android.apk, as android/build-apk.mjs
 * names it and the checker uploads it. Drafts, and an upload that is not
 * finished, are passed over.
 */
final class Releases {
    private Releases() { }

    static final Pattern APK = Pattern.compile("^BM-Player-(\\d{1,4})\\.(\\d{1,4})\\.(\\d{1,4})-android\\.apk$");
    private static final Pattern HEX64 = Pattern.compile("^[0-9a-f]{64}$");

    /** One APK on a release. */
    static final class Apk {
        String version, tag, name, url, page, sha256, published;
        long size;
        boolean prerelease;

        JSONObject json() throws JSONException {
            JSONObject o = new JSONObject();
            o.put("version", version);
            o.put("tag", tag);
            o.put("name", name);
            o.put("url", url);
            o.put("page", page);
            o.put("size", size);
            o.put("sha256", sha256 == null ? "" : sha256);
            o.put("published", published == null ? "" : published);
            o.put("prerelease", prerelease);
            return o;
        }

        static Apk from(JSONObject o) {
            if (o == null || o.optString("version", "").length() == 0) return null;
            Apk a = new Apk();
            a.version = o.optString("version");
            a.tag = o.optString("tag");
            a.name = o.optString("name");
            a.url = o.optString("url");
            a.page = o.optString("page");
            a.size = o.optLong("size");
            a.sha256 = o.optString("sha256", "");
            if (a.sha256.length() == 0) a.sha256 = null;
            a.published = o.optString("published", "");
            a.prerelease = o.optBoolean("prerelease");
            return a.url.startsWith("https://github.com/") ? a : null;
        }
    }

    /** The newest APK in GitHub's list of releases (JSON), or null when no release has one. */
    static Apk newest(String json) throws JSONException {
        JSONArray list = new JSONArray(json);
        Apk best = null;
        for (int i = 0; i < list.length(); i++) {
            JSONObject r = list.optJSONObject(i);
            if (r == null || r.optBoolean("draft")) continue;
            JSONArray assets = r.optJSONArray("assets");
            if (assets == null) continue;
            for (int k = 0; k < assets.length(); k++) {
                JSONObject x = assets.optJSONObject(k);
                if (x == null) continue;
                String name = x.optString("name", "");
                Matcher m = APK.matcher(name);
                if (!m.matches()) continue;
                if (!"uploaded".equals(x.optString("state", "uploaded"))) continue;
                String url = x.optString("browser_download_url", "");
                if (!url.startsWith("https://github.com/")) continue;
                String v = Integer.parseInt(m.group(1)) + "." + Integer.parseInt(m.group(2)) + "." + Integer.parseInt(m.group(3));
                if (best != null && compare(v, best.version) <= 0) continue;
                Apk a = new Apk();
                a.version = v;
                a.tag = r.optString("tag_name", "v" + v);
                a.name = name;
                a.url = url;
                a.page = r.optString("html_url", "https://github.com/BritMat/bm-player/releases");
                a.size = x.optLong("size", 0);
                a.sha256 = sha256Of(x.optString("digest", ""));
                a.published = r.optString("published_at", "");
                a.prerelease = r.optBoolean("prerelease");
                best = a;
            }
        }
        return best;
    }

    /** GitHub's "sha256:..." for an asset (on uploads since mid 2025), as lower-case hex, or null. */
    static String sha256Of(String digest) {
        if (digest == null) return null;
        String d = digest.trim().toLowerCase(Locale.US);
        if (!d.startsWith("sha256:")) return null;
        d = d.substring(7);
        return HEX64.matcher(d).matches() ? d : null;
    }

    /** Below 0 when a is older than b, 0 the same, above 0 newer. "v3.44.0", "3.44" and "3.44.0-beta" read as 3.44.0. */
    static int compare(String a, String b) {
        int[] x = parts(a), y = parts(b);
        for (int i = 0; i < 3; i++) if (x[i] != y[i]) return x[i] < y[i] ? -1 : 1;
        return 0;
    }

    static int[] parts(String v) {
        int[] p = new int[3];
        if (v == null) return p;
        String s = v.trim();
        if (s.startsWith("v") || s.startsWith("V")) s = s.substring(1);
        int dash = s.indexOf('-');
        if (dash >= 0) s = s.substring(0, dash);
        String[] bits = s.split("\\.");
        for (int i = 0; i < 3 && i < bits.length; i++) {
            try { p[i] = Integer.parseInt(bits[i].replaceAll("[^0-9]", "")); } catch (NumberFormatException e) { p[i] = 0; }
        }
        return p;
    }

    /** The version code android/build-apk.mjs gives a version: 3.44.0 is 34400. */
    static int code(String v) {
        int[] p = parts(v);
        return p[0] * 10000 + p[1] * 100 + p[2];
    }
}
