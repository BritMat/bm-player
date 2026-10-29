package io.github.britmat.bmplayer;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.IntentSender;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.LinkedHashSet;

/**
 * Deleting pictures, videos and songs the page asks for (v3.45.0).
 *
 * Android 11 and later: one request for all of them, which Android shows as
 * its own question ("Allow BM Player to delete these 3 photos?"). Nothing
 * goes until the person says yes there, and no permission is needed.
 *
 * Android 7 to 10: the storage permission first (asked for once), then each
 * file goes at once, as Android does not ask, so the page asks before.
 * Android 10 refuses an app a file another app made unless the app has its
 * old wide access to storage (requestLegacyExternalStorage, in the manifest).
 * Where it refuses all the same, it offers a question about that one file
 * (a RecoverableSecurityException): that is asked, and the rest go on after.
 *
 * A whole folder (folder: true) also loses the folder itself on Android 7 to
 * 10, once it is empty. From Android 11 an app may not remove a folder it
 * did not make, so an empty one stays there, out of sight in BM Player.
 *
 * The answer is a 'deleted' event for the page:
 *   { kind, ids (the ones really gone), asked, cancelled, denied, error }
 */
final class MediaDelete {
    static final int REQ_ALL = 31, REQ_WRITE = 32, REQ_ONE = 33;
    static final String WRITE = "android.permission.WRITE_EXTERNAL_STORAGE";
    private static final int MAX = 5000;

    private final MainActivity a;
    private String kind = "";
    private long[] ids = new long[0];
    private boolean folder, busy;
    private long since;
    private int next;
    private final LinkedHashSet<String> dirs = new LinkedHashSet<String>();

    MediaDelete(MainActivity a) { this.a = a; }

    static Uri base(String kind) {
        if ("video".equals(kind)) return MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
        if ("image".equals(kind)) return MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        return MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
    }

    private Uri uri(long id) { return ContentUris.withAppendedId(base(kind), id); }

    /** JSON { kind: 'image' | 'video' | 'audio', ids: [...], folder }. On the main thread. */
    void start(String json) {
        // Busy for two minutes at most: an answer that never came holds nothing up for good.
        if (busy && System.currentTimeMillis() - since < 120000) { answer(null, "Another delete is still waiting for an answer.", false, false); return; }
        try {
            JSONObject o = new JSONObject(json);
            kind = o.optString("kind", "");
            if (!"image".equals(kind) && !"video".equals(kind) && !"audio".equals(kind)) throw new IllegalArgumentException("kind " + kind);
            JSONArray list = o.getJSONArray("ids");
            int n = Math.min(MAX, list.length());
            ids = new long[n];
            for (int k = 0; k < n; k++) ids[k] = list.getLong(k);
            folder = o.optBoolean("folder", false);
        } catch (Exception e) {
            BMLog.w("delete: " + e);
            kind = ""; ids = new long[0];
            answer(null, "That could not be read: " + e.getMessage(), false, false);
            return;
        }
        if (ids.length == 0) { answer(new long[0], null, false, false); return; }
        busy = true;
        since = System.currentTimeMillis();
        next = 0;
        dirs.clear();
        BMLog.i("delete: " + ids.length + " " + kind + (folder ? " (a folder)" : ""));
        if (Build.VERSION.SDK_INT >= 30) {
            try {
                ArrayList<Uri> uris = new ArrayList<Uri>();
                for (long id : ids) uris.add(uri(id));
                PendingIntent pi = MediaStore.createDeleteRequest(a.getContentResolver(), uris);
                a.startIntentSenderForResult(pi.getIntentSender(), REQ_ALL, null, 0, 0, 0);
            } catch (Exception e) {
                BMLog.w("delete request: " + e);
                busy = false;
                answer(null, "Android would not ask about deleting them: " + e.getMessage(), false, false);
            }
            return;
        }
        if (a.checkSelfPermission(WRITE) != PackageManager.PERMISSION_GRANTED) {
            a.getSharedPreferences("bm", Activity.MODE_PRIVATE).edit().putBoolean("asked:" + WRITE, true).apply();
            a.requestPermissions(new String[] { WRITE }, REQ_WRITE);
            return;
        }
        runOn();
    }

    /** Android's answer about the storage permission (Android 7 to 10). */
    void onPermission(boolean granted) {
        if (!busy) return;
        if (!granted) {
            busy = false;
            answer(new long[0], "BM Player may not change files on this phone. Allow it Files and media (storage) in the app's settings to delete from here.", false, true);
            return;
        }
        runOn();
    }

    /** Android's answer to its own question: all of them (Android 11+), or one file (Android 10). */
    void onResult(int request, int result) {
        if (!busy) return;
        if (request == REQ_ALL) {
            if (result == Activity.RESULT_OK) settle(false);
            else { busy = false; answer(new long[0], null, true, false); }
            return;
        }
        if (request == REQ_ONE) {
            if (result == Activity.RESULT_OK) runOn();     // the same file again, now allowed
            else settle(true);                             // the ones before it went
        }
    }

    /** Deletes from `next` on, off the main thread. Stops at a file Android wants asked about. */
    private void runOn() {
        new Thread(new Runnable() {
            public void run() {
                ContentResolver cr = a.getContentResolver();
                while (next < ids.length) {
                    Uri u = uri(ids[next]);
                    String path = pathOf(cr, u);
                    try {
                        cr.delete(u, null, null);
                        // On Android 7 to 10 the file goes with its entry. If it is still there, it goes too.
                        if (path != null) {
                            File f = new File(path);
                            if (f.exists() && !f.delete()) BMLog.w("delete: the file stayed: " + path);
                            File d = f.getParentFile();
                            if (d != null) dirs.add(d.getPath());
                        }
                        next++;
                    } catch (SecurityException e) {
                        if (Build.VERSION.SDK_INT >= 29 && e instanceof android.app.RecoverableSecurityException) {
                            final IntentSender is = ((android.app.RecoverableSecurityException) e).getUserAction().getActionIntent().getIntentSender();
                            a.ui.post(new Runnable() {
                                public void run() {
                                    try { a.startIntentSenderForResult(is, REQ_ONE, null, 0, 0, 0); }
                                    catch (Exception x) { BMLog.w("delete question: " + x); settle(true); }
                                }
                            });
                            return;
                        }
                        BMLog.w("delete " + u + ": " + e);
                        next++;
                    } catch (Exception e) {
                        BMLog.w("delete " + u + ": " + e);
                        next++;
                    }
                }
                if (folder) removeEmptyFolders();
                settle(false);
            }
        }).start();
    }

    private static String pathOf(ContentResolver cr, Uri u) {
        Cursor c = null;
        try {
            c = cr.query(u, new String[] { "_data" }, null, null, null);
            if (c != null && c.moveToFirst() && !c.isNull(0)) return c.getString(0);
        } catch (Exception ignored) {
        } finally { if (c != null) c.close(); }
        return null;
    }

    /**
     * The folders the files were in, gone once empty: only a folder of its
     * own (two levels or more below the storage's top, as DCIM/Camera is),
     * never a top one such as Music or DCIM.
     */
    private void removeEmptyFolders() {
        for (String p : dirs) {
            try {
                File d = new File(p);
                String[] left = d.list();
                if (left == null || left.length > 0) continue;
                String rel = p.replaceFirst("^/storage/emulated/\\d+/?", "").replaceFirst("^/storage/[^/]+/?", "").replaceFirst("^/sdcard/?", "");
                if (rel.length() == 0 || !rel.contains("/")) continue;
                if (d.delete()) BMLog.i("delete: the empty folder went too: " + rel);
            } catch (Exception e) { BMLog.w("delete folder " + p + ": " + e); }
        }
    }

    /** Which ids are really gone, asked of Android, off the main thread, then the answer. */
    private void settle(final boolean cancelled) {
        new Thread(new Runnable() {
            public void run() {
                ContentResolver cr = a.getContentResolver();
                long[] gone = new long[ids.length];
                int n = 0;
                for (long id : ids) {
                    Cursor c = null;
                    boolean there = false;
                    try {
                        c = cr.query(uri(id), new String[] { "_id" }, null, null, null);
                        there = c != null && c.moveToFirst();
                    } catch (Exception ignored) {
                    } finally { if (c != null) c.close(); }
                    if (!there) gone[n++] = id;
                }
                long[] out = new long[n];
                System.arraycopy(gone, 0, out, 0, n);
                busy = false;
                BMLog.i("delete: " + n + " of " + ids.length + " " + kind + " gone" + (cancelled ? ", the rest kept by the person" : ""));
                answer(out, null, cancelled && n < ids.length, false);
            }
        }).start();
    }

    private void answer(long[] gone, String error, boolean cancelled, boolean denied) {
        try {
            JSONObject o = new JSONObject();
            o.put("kind", kind);
            JSONArray g = new JSONArray();
            if (gone != null) for (long id : gone) g.put(id);
            o.put("ids", g);
            o.put("asked", ids.length);
            if (cancelled) o.put("cancelled", true);
            if (denied) o.put("denied", true);
            if (error != null) o.put("error", error);
            a.emit("deleted", o);
        } catch (Exception e) { BMLog.w("delete answer: " + e); }
    }
}
