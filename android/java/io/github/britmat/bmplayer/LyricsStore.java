package io.github.britmat.bmplayer;

import android.content.Context;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.Charset;
import java.util.regex.Pattern;

/**
 * Lyrics kept on the phone (v3.50.0), for the page's lyrics-core.js: what
 * LRCLIB found or did not find for each song, the lyrics saved for songs
 * (under their file and the song itself), and the person's own choices
 * (pins). One small JSON file each, in the app's own storage.
 *
 * They were in the page's localStorage until now, which holds a few
 * megabytes for everything the page keeps: a thousand songs' answers at
 * most, the oldest dropped first, and when it filled up the lyrics of songs
 * played a while ago went, so a song found once came back without them.
 * Here they stay until the person clears them (Settings) or clears the
 * app's storage.
 *
 * Names are the page's own (lowercase letters, digits and dashes): nothing
 * here can name a file outside the folder.
 */
final class LyricsStore {
    private static final Pattern NAME = Pattern.compile("[a-z0-9-]{1,96}");
    private static final int MAX = 2 * 1024 * 1024;
    private static final Charset UTF8 = Charset.forName("UTF-8");
    private final File dir;

    LyricsStore(Context c) { this(new File(c.getFilesDir(), "lyrics")); }
    LyricsStore(File dir) { this.dir = dir; }

    private File file(String name) {
        if (name == null || !NAME.matcher(name).matches()) return null;
        if (!dir.isDirectory() && !dir.mkdirs()) return null;
        return new File(dir, name + ".json");
    }

    /** The JSON kept under that name, or null. */
    synchronized String read(String name) {
        File f = file(name);
        if (f == null || !f.isFile() || f.length() > MAX) return null;
        byte[] b = new byte[(int) f.length()];
        FileInputStream in = null;
        try {
            in = new FileInputStream(f);
            int got = 0;
            while (got < b.length) { int n = in.read(b, got, b.length - got); if (n < 0) break; got += n; }
            return new String(b, 0, got, UTF8);
        } catch (IOException e) { return null; }
        finally { try { if (in != null) in.close(); } catch (IOException ignored) { } }
    }

    /**
     * Kept under that name, whole or not at all (written beside it, then put
     * in its place). Only the person's choices wait for the disk: the page
     * waits for every call here, and the rest can be looked up again.
     */
    synchronized boolean write(String name, String json) {
        File f = file(name);
        if (f == null || json == null) return false;
        byte[] b = json.getBytes(UTF8);
        if (b.length > MAX) return false;
        File tmp = new File(dir, name + ".tmp");
        FileOutputStream out = null;
        try {
            out = new FileOutputStream(tmp);
            out.write(b);
            if (name.equals("pins")) out.getFD().sync();
            out.close(); out = null;
            if (!tmp.renameTo(f)) { f.delete(); if (!tmp.renameTo(f)) return false; }
            return true;
        } catch (IOException e) { tmp.delete(); return false; }
        finally { try { if (out != null) out.close(); } catch (IOException ignored) { } }
    }

    /** How many songs have lyrics saved (one file each under the song's file: sf-...). */
    synchronized int count() {
        String[] names = dir.list();
        if (names == null) return 0;
        int n = 0;
        for (String s : names) if (s.startsWith("sf-") && s.endsWith(".json")) n++;
        return n;
    }

    /** Everything but the person's own choices cleared. Gives how many songs had lyrics saved. */
    synchronized int clear() {
        File[] files = dir.listFiles();
        if (files == null) return 0;
        int n = 0;
        for (File f : files) {
            String s = f.getName();
            if (s.equals("pins.json")) continue;
            if (s.startsWith("sf-") && s.endsWith(".json")) n++;
            f.delete();
        }
        return n;
    }
}
