package io.github.britmat.bmplayer;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Locale;

/**
 * The phone's music and videos, from Android's media index (MediaStore), as
 * JSON for the page. Short keys, since a phone can hold tens of thousands of
 * songs:
 *
 *   songs   i id, t title, a artist, al album, ai album id, aa album artist,
 *           d length (ms), n track number, y year, da added (s), s size,
 *           m type, p path, fn file name, mu 1 for music (not a ringtone or
 *           a recording), g genre
 *   videos  i id, t title, fn file name, d length (ms), s size, w and h,
 *           da added, m type, f folder, p path, o rotation
 *   images  i id, fn file name, s size, w and h, da added (s), dt taken
 *           (ms), m type, b album (folder), p path, o rotation (v3.42.0)
 *
 * Columns that only newer Android versions have are asked for first; if the
 * phone refuses them, the list is made again without.
 */
final class MediaLibrary {
    private MediaLibrary() { }

    static String audio(Context c) {
        String[] base = { "_id", "title", "artist", "album", "album_id", "duration", "track", "year", "date_added", "_size", "mime_type", "_data", "_display_name", "is_music" };
        ArrayList<String> more = new ArrayList<String>();
        more.add("album_artist");
        if (Build.VERSION.SDK_INT >= 30) more.add("genre");
        Cursor cur = query(c.getContentResolver(), MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, base, more);
        StringBuilder b = new StringBuilder(16 + (cur == null ? 0 : cur.getCount() * 240)).append('[');
        if (cur != null) {
            try {
                int iId = cur.getColumnIndex("_id"), iT = cur.getColumnIndex("title"), iA = cur.getColumnIndex("artist"), iAl = cur.getColumnIndex("album"),
                    iAi = cur.getColumnIndex("album_id"), iD = cur.getColumnIndex("duration"), iN = cur.getColumnIndex("track"), iY = cur.getColumnIndex("year"),
                    iDa = cur.getColumnIndex("date_added"), iS = cur.getColumnIndex("_size"), iM = cur.getColumnIndex("mime_type"), iP = cur.getColumnIndex("_data"),
                    iFn = cur.getColumnIndex("_display_name"), iMu = cur.getColumnIndex("is_music"), iAa = cur.getColumnIndex("album_artist"), iG = cur.getColumnIndex("genre");
                boolean first = true;
                while (cur.moveToNext()) {
                    if (!first) b.append(',');
                    first = false;
                    b.append("{\"i\":").append(cur.getLong(iId));
                    str(b, "t", cur, iT);
                    String artist = cur.isNull(iA) ? "" : cur.getString(iA);
                    if ("<unknown>".equals(artist)) artist = "";
                    b.append(",\"a\":").append(JSONObject.quote(artist));
                    str(b, "al", cur, iAl);
                    num(b, "ai", cur, iAi);
                    num(b, "d", cur, iD);
                    num(b, "n", cur, iN);
                    num(b, "y", cur, iY);
                    num(b, "da", cur, iDa);
                    num(b, "s", cur, iS);
                    str(b, "m", cur, iM);
                    str(b, "p", cur, iP);
                    str(b, "fn", cur, iFn);
                    num(b, "mu", cur, iMu);
                    if (iAa >= 0) str(b, "aa", cur, iAa);
                    if (iG >= 0) str(b, "g", cur, iG);
                    b.append('}');
                }
            } finally { cur.close(); }
        }
        return b.append(']').toString();
    }

    static String video(Context c) {
        String[] base = { "_id", "title", "_display_name", "duration", "_size", "width", "height", "date_added", "mime_type", "bucket_display_name", "_data" };
        ArrayList<String> more = new ArrayList<String>();
        if (Build.VERSION.SDK_INT >= 29) more.add("orientation");
        Cursor cur = query(c.getContentResolver(), MediaStore.Video.Media.EXTERNAL_CONTENT_URI, base, more);
        StringBuilder b = new StringBuilder(16 + (cur == null ? 0 : cur.getCount() * 220)).append('[');
        if (cur != null) {
            try {
                int iId = cur.getColumnIndex("_id"), iT = cur.getColumnIndex("title"), iFn = cur.getColumnIndex("_display_name"), iD = cur.getColumnIndex("duration"),
                    iS = cur.getColumnIndex("_size"), iW = cur.getColumnIndex("width"), iH = cur.getColumnIndex("height"), iDa = cur.getColumnIndex("date_added"),
                    iM = cur.getColumnIndex("mime_type"), iF = cur.getColumnIndex("bucket_display_name"), iP = cur.getColumnIndex("_data"), iO = cur.getColumnIndex("orientation");
                boolean first = true;
                while (cur.moveToNext()) {
                    if (!first) b.append(',');
                    first = false;
                    b.append("{\"i\":").append(cur.getLong(iId));
                    str(b, "t", cur, iT);
                    str(b, "fn", cur, iFn);
                    num(b, "d", cur, iD);
                    num(b, "s", cur, iS);
                    num(b, "w", cur, iW);
                    num(b, "h", cur, iH);
                    num(b, "da", cur, iDa);
                    str(b, "m", cur, iM);
                    str(b, "f", cur, iF);
                    str(b, "p", cur, iP);
                    if (iO >= 0) num(b, "o", cur, iO);
                    b.append('}');
                }
            } finally { cur.close(); }
        }
        return b.append(']').toString();
    }

    static String image(Context c) {
        String[] base = { "_id", "_display_name", "_size", "width", "height", "date_added", "datetaken", "mime_type", "bucket_display_name", "_data", "orientation" };
        Cursor cur = query(c.getContentResolver(), MediaStore.Images.Media.EXTERNAL_CONTENT_URI, base, new ArrayList<String>());
        StringBuilder b = new StringBuilder(16 + (cur == null ? 0 : cur.getCount() * 200)).append('[');
        if (cur != null) {
            try {
                int iId = cur.getColumnIndex("_id"), iFn = cur.getColumnIndex("_display_name"), iS = cur.getColumnIndex("_size"), iW = cur.getColumnIndex("width"),
                    iH = cur.getColumnIndex("height"), iDa = cur.getColumnIndex("date_added"), iDt = cur.getColumnIndex("datetaken"), iM = cur.getColumnIndex("mime_type"),
                    iB = cur.getColumnIndex("bucket_display_name"), iP = cur.getColumnIndex("_data"), iO = cur.getColumnIndex("orientation");
                boolean first = true;
                while (cur.moveToNext()) {
                    if (!first) b.append(',');
                    first = false;
                    b.append("{\"i\":").append(cur.getLong(iId));
                    str(b, "fn", cur, iFn);
                    num(b, "s", cur, iS);
                    num(b, "w", cur, iW);
                    num(b, "h", cur, iH);
                    num(b, "da", cur, iDa);
                    num(b, "dt", cur, iDt);
                    str(b, "m", cur, iM);
                    str(b, "b", cur, iB);
                    str(b, "p", cur, iP);
                    num(b, "o", cur, iO);
                    b.append('}');
                }
            } finally { cur.close(); }
        }
        return b.append(']').toString();
    }

    /** The columns wanted, or the base ones alone where the phone does not have the others. */
    private static Cursor query(ContentResolver cr, Uri uri, String[] base, ArrayList<String> more) {
        if (!more.isEmpty()) {
            ArrayList<String> all = new ArrayList<String>(Arrays.asList(base));
            all.addAll(more);
            try {
                return cr.query(uri, all.toArray(new String[0]), null, null, null);
            } catch (SecurityException e) {
                throw e;
            } catch (Exception e) {
                BMLog.w("media index without " + more + ": " + e.getMessage());
            }
        }
        return cr.query(uri, base, null, null, null);
    }

    private static void str(StringBuilder b, String key, Cursor c, int i) {
        String v = i < 0 || c.isNull(i) ? "" : c.getString(i);
        b.append(",\"").append(key).append("\":").append(JSONObject.quote(v == null ? "" : v));
    }

    private static void num(StringBuilder b, String key, Cursor c, int i) {
        long v = 0;
        if (i >= 0 && !c.isNull(i)) { try { v = c.getLong(i); } catch (Exception ignored) { } }
        b.append(",\"").append(key).append("\":").append(v);
    }

    /** Where a song or video is on the phone, or null. */
    static String pathOf(Context c, String kind, long id) {
        Uri base = "video".equals(kind) ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        Cursor cur = null;
        try {
            cur = c.getContentResolver().query(ContentUris.withAppendedId(base, id), new String[] { "_data" }, null, null, null);
            if (cur != null && cur.moveToFirst()) return cur.getString(0);
        } catch (Exception e) {
            BMLog.w("where is " + kind + " " + id + ": " + e.getMessage());
        } finally { if (cur != null) cur.close(); }
        return null;
    }

    /**
     * A file beside a song or video with the same name and one of the given
     * endings (lrc, srt, vtt), as JSON { name, text }, or null. Android 11 and
     * later only let an app read other files in shared folders with a
     * permission BM Player does not ask for, so there this mostly finds
     * nothing, and the page offers its file picker instead.
     */
    static String beside(Context c, String kind, long id, String exts) {
        String path = pathOf(c, kind, id);
        if (path == null) return null;
        File f = new File(path), dir = f.getParentFile();
        if (dir == null) return null;
        String name = f.getName();
        int dot = name.lastIndexOf('.');
        String stem = dot > 0 ? name.substring(0, dot) : name;
        String[] names = null;
        try { names = dir.list(); } catch (Exception ignored) { }
        for (String ext : exts.split(",")) {
            ext = ext.trim().toLowerCase(Locale.US);
            if (!ext.matches("[a-z0-9]{1,5}")) continue;
            File hit = null;
            if (names != null) {
                for (String n : names) if (n.equalsIgnoreCase(stem + "." + ext)) { hit = new File(dir, n); break; }
            } else hit = new File(dir, stem + "." + ext);
            if (hit == null) continue;
            try {
                if (!hit.isFile() || hit.length() > 2 * 1024 * 1024) continue;
                byte[] bytes = LocalServer.readAll(new FileInputStream(hit), 2 * 1024 * 1024);
                JSONObject o = new JSONObject();
                o.put("name", hit.getName());
                o.put("text", new String(bytes, "UTF-8"));
                return o.toString();
            } catch (Exception e) {
                // Not allowed, or gone: try the next ending.
            }
        }
        return null;
    }
}
