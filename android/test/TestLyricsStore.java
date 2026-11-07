package io.github.britmat.bmplayer;

import java.io.File;
import java.nio.file.Files;

/**
 * LyricsStore.java (v3.50.0) on a computer: what the page keeps comes back
 * as it was written, in any script, names that could reach outside its
 * folder are refused, and clearing keeps the person's own choices.
 * Run by scripts/stream-check.mjs.
 */
public final class TestLyricsStore {
    private static int failed = 0;
    private static void ok(boolean c, String what) {
        System.out.println((c ? "  ok   " : "  FAIL ") + what);
        if (!c) failed++;
    }

    public static void main(String[] args) throws Exception {
        File dir = new File(Files.createTempDirectory("bm-lyrics-").toFile(), "lyrics");
        LyricsStore s = new LyricsStore(dir);
        System.out.println("LyricsStore");
        String words = "{\"found\":{\"synced\":\"[00:01.00]ഇന്ന് നല്ല മഴയാണ് तुम ही हो\"}}";
        ok(s.read("sf-0123456789abcdef") == null, "nothing there yet");
        ok(s.write("sf-0123456789abcdef", words), "written, the folder made");
        ok(words.equals(s.read("sf-0123456789abcdef")), "read back as written, Malayalam and Hindi too");
        ok(s.write("sf-0123456789abcdef", "{\"v\":2}") && "{\"v\":2}".equals(s.read("sf-0123456789abcdef")), "written again: the new one");
        ok(!new File(dir, "sf-0123456789abcdef.tmp").exists(), "nothing half written left beside it");
        String[] bad = { "../outside", "a/b", "Sf-ABC", "pins.json", "", "x y", null, new String(new char[97]).replace('\0', 'a') };
        boolean refused = true;
        for (String n : bad) { if (s.write(n, "{}") || s.read(n) != null) { refused = false; System.out.println("    let through: " + n); } }
        ok(refused, "names that are not the page's own are refused, none can reach outside the folder");
        ok(!new File(dir.getParentFile(), "outside.json").exists(), "and nothing was written outside it");
        StringBuilder big = new StringBuilder(); while (big.length() <= 2 * 1024 * 1024) big.append("0123456789");
        ok(!s.write("sl-big", big.toString()) && s.read("sl-big") == null, "more than 2 MB is not kept");
        ok(s.write("sf-1111111111111111", "{}") && s.write("sl-2222222222222222", "{}") && s.write("pins", "{\"f:x\":1}") && s.write("abcdef0123456789", "{}"), "a song's file, the song loosely, the choices, an answer");
        ok(s.count() == 2, "two songs counted as saved (" + s.count() + "): their files' names only");
        int n = s.clear();
        ok(n == 2, "clear says two songs had lyrics (" + n + ")");
        ok(s.read("sf-1111111111111111") == null && s.read("sl-2222222222222222") == null && s.read("abcdef0123456789") == null, "cleared: the lyrics and the answers");
        ok("{\"f:x\":1}".equals(s.read("pins")), "the person's own choices kept");
        ok(s.count() == 0, "none counted after");
        if (failed > 0) { System.out.println("LyricsStore: " + failed + " failed"); System.exit(1); }
        System.out.println("LyricsStore: all passed");
    }
}
