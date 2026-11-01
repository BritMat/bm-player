package io.github.britmat.bmplayer;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import org.json.JSONObject;

import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Locale;

/**
 * Files in and out (v3.47.0, from MainActivity): Android's file picker for
 * the folder button, the files Android keeps for the app so Home can open
 * them again, sending files to other apps, and opening one in another app.
 * The page asks for these through Bridge, as a.files. Moved as they were:
 * nothing here changed.
 */
final class Files {
    static final int REQ_PICK_VIDEO = 12, REQ_PICK_AUDIO = 13, REQ_PICK_IMAGE = 14, REQ_PICK_PDF = 15, REQ_PICK_ANY = 16;
    private final MainActivity a;

    Files(MainActivity a) { this.a = a; }

    /**
     * A video or song chosen with Android's file picker (the folder button).
     * It comes to the page as an 'open' event, as a file from another app
     * does, and plays from /opened/N: mpv opens it by its address, which a
     * file chosen inside the page would not have.
     */
    void pickMedia(String kind) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        // MKV files are often listed as application/x-matroska, not as video.
        String[] video = { "video/*", "application/x-matroska", "application/mp4" }, audio = { "audio/*", "application/ogg", "application/x-flac" };
        String[] types; int req;
        if ("audio".equals(kind)) { types = audio; req = REQ_PICK_AUDIO; }
        else if ("image".equals(kind)) { types = new String[] { "image/*" }; req = REQ_PICK_IMAGE; }
        else if ("pdf".equals(kind)) { types = new String[] { "application/pdf" }; req = REQ_PICK_PDF; }
        else if ("any".equals(kind)) { types = new String[] { "video/*", "audio/*", "image/*", "application/pdf", "application/x-matroska", "application/mp4", "application/ogg", "application/x-flac" }; req = REQ_PICK_ANY; }
        else { types = video; req = REQ_PICK_VIDEO; }
        i.putExtra(Intent.EXTRA_MIME_TYPES, types);
        try { a.startActivityForResult(i, req); }
        catch (ActivityNotFoundException e) { BMLog.w("no file picker: " + e); }
    }

    /** Android's answer to pickMedia (MainActivity.onActivityResult). False when the request was not one of its. */
    boolean onResult(int request, int result, Intent data) {
        if (request < REQ_PICK_VIDEO || request > REQ_PICK_ANY) return false;
        if (result == Activity.RESULT_OK && data != null && data.getData() != null) {
            Uri u = data.getData();
            String type = null;
            try { type = a.getContentResolver().getType(u); } catch (Exception ignored) { }
            String name = displayName(u);
            String kind = request == REQ_PICK_VIDEO ? "video" : request == REQ_PICK_AUDIO ? "audio" : request == REQ_PICK_IMAGE ? "image"
                    : request == REQ_PICK_PDF ? "pdf" : kindOf(type, name);
            // Kept by Android for the app (v3.42.0), so Home can open it again after a restart.
            String key = null;
            try {
                a.getContentResolver().takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                key = rememberDoc(u, type, name);
            } catch (Exception e) { BMLog.w("could not keep access to the file: " + e.getMessage()); }
            a.openFile(u, type, kind, "chosen", key);
        }
        return true;
    }

    /** What a file is, by its type or, where the type says little, its name: video, audio, image or pdf. */
    static String kindOf(String type, String name) {
        String t = type == null ? "" : type.toLowerCase(Locale.US), n = name == null ? "" : name.toLowerCase(Locale.US);
        if (t.startsWith("video/") || t.endsWith("/x-matroska") || n.matches(".*\\.(mkv|mp4|m4v|webm|avi|mov|ts|m2ts|flv|wmv|3gp)$")) return "video";
        if (t.startsWith("image/")) return "image";
        if (t.contains("pdf") || n.endsWith(".pdf")) return "pdf";
        return "audio";
    }

    /** A song, video or picture by its address in the page (/media/KIND/ID, /opened/N) as Android's. */
    Uri uriOf(String src) {
        if (src == null) return null;
        // All here (v3.45.0), so sharing works when mpv could not start.
        String s = src.split("\\?")[0];
        try {
            if (s.startsWith("/media/image/")) return android.content.ContentUris.withAppendedId(MediaDelete.base("image"), Long.parseLong(s.substring(13)));
            if (s.startsWith("/media/video/")) return android.content.ContentUris.withAppendedId(MediaDelete.base("video"), Long.parseLong(s.substring(13)));
            if (s.startsWith("/media/audio/")) return android.content.ContentUris.withAppendedId(MediaDelete.base("audio"), Long.parseLong(s.substring(13)));
            if (s.startsWith("/opened/") && a.server != null) return a.server.uri(Integer.parseInt(s.substring(8)));
        } catch (NumberFormatException ignored) { }
        return null;
    }

    /** Sent to another app (a chat, an email), as the file itself. */
    void shareFile(String src, String type) {
        Uri u = uriOf(src);
        if (u == null) return;
        try {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType(type != null && type.length() > 0 ? type : "*/*");
            i.putExtra(Intent.EXTRA_STREAM, u);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            a.startActivity(Intent.createChooser(i, "Share"));
        } catch (Exception e) { BMLog.w("share file: " + e); }
    }

    /**
     * Several files to another app at once (v3.45.0): JSON { srcs, type }.
     * One goes as a single file, as shareFile sends it.
     */
    void shareFiles(String json) {
        ArrayList<Uri> uris = new ArrayList<Uri>();
        String type = "*/*";
        try {
            JSONObject o = new JSONObject(json);
            org.json.JSONArray srcs = o.getJSONArray("srcs");
            for (int k = 0; k < srcs.length() && uris.size() < 500; k++) { Uri u = uriOf(srcs.getString(k)); if (u != null) uris.add(u); }
            String t = o.optString("type", "");
            if (t.length() > 0) type = t;
        } catch (Exception e) { BMLog.w("share files: " + e); return; }
        if (uris.isEmpty()) return;
        try {
            Intent i;
            if (uris.size() == 1) { i = new Intent(Intent.ACTION_SEND); i.putExtra(Intent.EXTRA_STREAM, uris.get(0)); }
            else { i = new Intent(Intent.ACTION_SEND_MULTIPLE); i.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris); }
            i.setType(type);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            a.startActivity(Intent.createChooser(i, "Share"));
        } catch (Exception e) { BMLog.w("share files: " + e); }
    }

    // ── files Android keeps for the app (v3.42.0) ────────────────────
    /** A chosen file remembered under a short key, for Home to open again later. At most 40. */
    String rememberDoc(Uri u, String type, String name) throws Exception {
        String key = shortHash(u.toString());
        android.content.SharedPreferences p = a.getSharedPreferences("docs", Context.MODE_PRIVATE);
        JSONObject all = new JSONObject(p.getString("all", "{}"));
        JSONObject o = new JSONObject();
        o.put("u", u.toString()); o.put("t", type == null ? "" : type); o.put("n", name == null ? "" : name); o.put("at", System.currentTimeMillis());
        all.remove(key);
        all.put(key, o);
        while (all.length() > 40) {
            String oldest = null; long at = Long.MAX_VALUE;
            for (Iterator<String> it = all.keys(); it.hasNext(); ) { String k = it.next(); long t = all.getJSONObject(k).optLong("at"); if (t < at) { at = t; oldest = k; } }
            if (oldest == null) break;
            try { a.getContentResolver().releasePersistableUriPermission(Uri.parse(all.getJSONObject(oldest).getString("u")), Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (Exception ignored) { }
            all.remove(oldest);
        }
        p.edit().putString("all", all.toString()).apply();
        return key;
    }

    /** A remembered file's address in the page again (/opened/N), or null when it is gone or no longer allowed. */
    String reopen(String key) {
        try {
            JSONObject o = new JSONObject(a.getSharedPreferences("docs", Context.MODE_PRIVATE).getString("all", "{}")).optJSONObject(key);
            if (o == null) return null;
            Uri u = Uri.parse(o.getString("u"));
            android.content.res.AssetFileDescriptor f = a.getContentResolver().openAssetFileDescriptor(u, "r");
            if (f == null) return null;
            f.close();
            String t = o.optString("t", "");
            return "/opened/" + a.server.register(u, t.length() > 0 ? t : null);
        } catch (Exception e) { BMLog.w("reopen " + key + ": " + e.getMessage()); return null; }
    }

    static String shortHash(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-1").digest(s.getBytes("UTF-8"));
            StringBuilder b = new StringBuilder();
            for (int k = 0; k < 6; k++) b.append(String.format(Locale.US, "%02x", d[k]));
            return b.toString();
        } catch (Exception e) { return Integer.toHexString(s.hashCode()); }
    }

    /** A video in another app (VLC, the phone's own player): Android asks which. */
    void openWith(String src) {
        Uri u = uriOf(src);
        if (u == null) return;
        String type = null;
        try { type = a.getContentResolver().getType(u); } catch (Exception ignored) { }
        if (type == null && src.startsWith("/opened/")) {
            try { type = a.server.type(Integer.parseInt(src.substring(8))); } catch (Exception ignored) { }
        }
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(u, type != null ? type : src.startsWith("/media/audio/") ? "audio/*" : src.startsWith("/media/image/") ? "image/*" : "video/*");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent chooser = Intent.createChooser(i, "Open with");
        chooser.putExtra(Intent.EXTRA_EXCLUDE_COMPONENTS, new ComponentName[] { new ComponentName(a, MainActivity.class) });
        try { a.startActivity(chooser); }
        catch (Exception e) { BMLog.w("open with: " + e); a.toastShort("No other app on this phone can open it."); }
    }

    /** A file's name as the app that holds it gives it, or the last part of its address. */
    String displayName(Uri u) {
        String name = null;
        try {
            Cursor c = a.getContentResolver().query(u, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null);
            if (c != null) { try { if (c.moveToFirst()) name = c.getString(0); } finally { c.close(); } }
        } catch (Exception ignored) { }
        if (name == null) name = u.getLastPathSegment();
        return name == null ? "" : name;
    }
}
