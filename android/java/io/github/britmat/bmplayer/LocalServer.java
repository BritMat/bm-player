package io.github.britmat.bmplayer;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.SparseArray;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Everything the page loads, from https://appassets.androidplatform.net:
 *
 *   /...                      the app's own files (assets/www)
 *   /media/audio/ID           a song, by its MediaStore id, in parts (HTTP
 *   /media/video/ID           ranges), so the player can seek without
 *                             reading the whole file first
 *   /media/image/ID?fit=N     a picture (v3.42.0); with fit, one larger than
 *                             N pixels comes scaled down to fit N
 *   /opened/N                 a file another app asked BM Player to open
 *   /art/album/ID?s=PX        album art, at most PX pixels across
 *   /art/audio/ID?s=PX        a song's own picture, else its album's
 *   /thumb/video/ID?s=PX      a picture from a video
 *   /thumb/image/ID?s=PX      a small copy of a picture
 *   /api/library/audio        the phone's music, as JSON (MediaLibrary)
 *   /api/library/video        the phone's videos
 *   /api/library/image        the phone's pictures
 *   /api/beside/KIND/ID       a lyrics or subtitle file beside the song or
 *                             video (?ext=lrc,srt,vtt), where Android lets
 *                             the app read it
 *   /net/lrclib/api/...       LRCLIB (lrclib.net), asked by Java with the
 *                             app's name as LRCLIB asks, for lyrics
 *
 * Nothing else is loaded from anywhere: a request for any other address
 * gets an empty answer, so nothing leaves the phone but the lyrics lookups
 * (artist, title, album and length).
 *
 * Called by the WebView on threads of its own, never the main thread.
 */
final class LocalServer {
    private final Context app;
    private final ContentResolver cr;
    private final SparseArray<Uri> opened = new SparseArray<Uri>();
    private final SparseArray<String> openedTypes = new SparseArray<String>();
    private int nextOpened = 1;

    LocalServer(Context c) {
        app = c.getApplicationContext();
        cr = app.getContentResolver();
    }

    /** A file another app gave us to open: the page plays it from /opened/N. */
    synchronized int register(Uri u, String type) {
        int n = nextOpened++;
        opened.put(n, u);
        openedTypes.put(n, type);
        return n;
    }

    /** The file behind /opened/N, for mpv, or null. */
    synchronized Uri uri(int n) { return opened.get(n); }

    /** Its type, as the other app said, or null. */
    synchronized String type(int n) { return openedTypes.get(n); }

    WebResourceResponse handle(WebResourceRequest req) {
        Uri u = req.getUrl();
        String scheme = u.getScheme();
        if (!"https".equals(scheme) && !"http".equals(scheme)) return null;   // data:, blob: and the like are the WebView's own
        if (!MainActivity.HOST.equals(u.getHost())) return text(403, "BM Player does not load anything from other addresses.");
        String path = u.getPath();
        if (path == null || path.length() == 0 || "/".equals(path)) path = "/index.html";
        try {
            if (path.startsWith("/media/")) return media(path, req, u);
            if (path.startsWith("/opened/")) return opened(path, req);
            if (path.startsWith("/art/")) return art(path, u);
            if (path.startsWith("/thumb/")) return thumb(path, u);
            if (path.startsWith("/api/")) return api(path, u);
            if (path.startsWith("/net/lrclib/")) return lrclib(u);
            return asset(path);
        } catch (SecurityException e) {
            BMLog.w(path + ": not allowed (" + e.getMessage() + ")");
            return text(403, "BM Player is not allowed to read that.");
        } catch (FileNotFoundException e) {
            return text(404, "Not found.");
        } catch (NumberFormatException e) {
            return text(404, "Not found.");
        } catch (Throwable t) {
            BMLog.w(path + ": " + t);
            return text(500, String.valueOf(t));
        }
    }

    // ── the app's own files ──────────────────────────────────────────
    private WebResourceResponse asset(String path) {
        if (path.contains("..")) return text(400, "Bad address.");
        InputStream in;
        try { in = app.getAssets().open("www" + path); }
        catch (IOException e) { return text(404, "Not found: " + path); }
        Map<String, String> h = new HashMap<String, String>();
        h.put("Cache-Control", "no-cache");
        String type = typeOf(path);
        return new WebResourceResponse(type, type.startsWith("text/") || type.endsWith("json") ? "utf-8" : null, 200, "OK", h, in);
    }

    static String typeOf(String path) {
        String p = path.toLowerCase(Locale.US);
        int dot = p.lastIndexOf('.');
        String ext = dot < 0 ? "" : p.substring(dot + 1);
        if (ext.equals("html")) return "text/html";
        if (ext.equals("js") || ext.equals("mjs")) return "text/javascript";   // module scripts need it said
        if (ext.equals("css")) return "text/css";
        if (ext.equals("json")) return "application/json";
        if (ext.equals("svg")) return "image/svg+xml";
        if (ext.equals("png")) return "image/png";
        if (ext.equals("jpg") || ext.equals("jpeg")) return "image/jpeg";
        if (ext.equals("webp")) return "image/webp";
        if (ext.equals("woff2")) return "font/woff2";
        if (ext.equals("txt")) return "text/plain";
        if (ext.equals("wasm")) return "application/wasm";
        return "application/octet-stream";
    }

    // ── songs and videos, in parts ───────────────────────────────────
    private WebResourceResponse media(String path, WebResourceRequest req, Uri u) throws IOException {
        String[] p = path.split("/");                      // "", "media", "audio", "123"
        if (p.length < 4) return text(404, "Not found.");
        long id = Long.parseLong(p[3]);
        if ("image".equals(p[2])) {
            Uri pic = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
            String fit = u.getQueryParameter("fit");
            if (fit != null) {
                // A photo bigger than the screen can show is sent scaled (a 50-megapixel one
                // decoded whole by the page would take hundreds of megabytes).
                byte[] b = Art.fitted(app, pic, Math.max(512, Math.min(8192, Integer.parseInt(fit))));
                if (b != null) {
                    Map<String, String> h = new HashMap<String, String>();
                    h.put("Cache-Control", "no-store");
                    return new WebResourceResponse("image/jpeg", null, 200, "OK", h, new ByteArrayInputStream(b));
                }
            }
            return stream(pic, null, req);
        }
        Uri base = "video".equals(p[2]) ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        return stream(ContentUris.withAppendedId(base, id), null, req);
    }

    private WebResourceResponse opened(String path, WebResourceRequest req) throws IOException {
        int n = Integer.parseInt(path.substring("/opened/".length()).split("/")[0]);
        Uri u; String type;
        synchronized (this) { u = opened.get(n); type = openedTypes.get(n); }
        if (u == null) return text(404, "Not found.");
        return stream(u, type, req);
    }

    private WebResourceResponse stream(Uri uri, String type, WebResourceRequest req) throws IOException {
        if (type == null) type = cr.getType(uri);
        if (type == null) type = "application/octet-stream";
        // MKV is the same container as WebM, which the web engine knows by that name.
        if (type.endsWith("/x-matroska")) type = type.substring(0, type.indexOf('/')) + "/webm";
        AssetFileDescriptor afd = cr.openAssetFileDescriptor(uri, "r");
        if (afd == null) throw new FileNotFoundException(uri.toString());
        long total = afd.getLength();
        if (total < 0) { try { total = afd.getParcelFileDescriptor().getStatSize(); } catch (Exception ignored) { } }
        InputStream in = afd.createInputStream();
        Map<String, String> h = new HashMap<String, String>();
        h.put("Accept-Ranges", "bytes");
        h.put("Cache-Control", "no-store");
        h.put("Access-Control-Allow-Origin", "*");
        String range = header(req, "Range");
        if (range != null && total > 0) {
            long[] r = parseRange(range, total);
            if (r == null) {
                in.close();
                h.put("Content-Range", "bytes */" + total);
                return new WebResourceResponse(type, null, 416, "Range Not Satisfiable", h, new ByteArrayInputStream(new byte[0]));
            }
            skipFully(in, r[0]);
            long len = r[1] - r[0] + 1;
            h.put("Content-Range", "bytes " + r[0] + "-" + r[1] + "/" + total);
            h.put("Content-Length", String.valueOf(len));
            return new WebResourceResponse(type, null, 206, "Partial Content", h, new Limited(in, len));
        }
        if (total > 0) h.put("Content-Length", String.valueOf(total));
        return new WebResourceResponse(type, null, 200, "OK", h, in);
    }

    /** "bytes=START-END", "bytes=START-" or "bytes=-LAST" as { from, to }, or null when it is outside the file. */
    static long[] parseRange(String v, long total) {
        String s = v.trim().toLowerCase(Locale.US);
        if (!s.startsWith("bytes=")) return new long[] { 0, total - 1 };
        s = s.substring(6);
        int comma = s.indexOf(',');
        if (comma >= 0) s = s.substring(0, comma);           // only the first part is answered
        int dash = s.indexOf('-');
        if (dash < 0) return new long[] { 0, total - 1 };
        String a = s.substring(0, dash).trim(), b = s.substring(dash + 1).trim();
        long from, to;
        try {
            if (a.length() == 0) {                             // the last N bytes
                long n = Long.parseLong(b);
                from = Math.max(0, total - n);
                to = total - 1;
            } else {
                from = Long.parseLong(a);
                to = b.length() == 0 ? total - 1 : Math.min(Long.parseLong(b), total - 1);
            }
        } catch (NumberFormatException e) { return new long[] { 0, total - 1 }; }
        if (from >= total || from > to) return null;
        return new long[] { from, to };
    }

    private static void skipFully(InputStream in, long n) throws IOException {
        byte[] buf = null;
        while (n > 0) {
            long k = in.skip(n);
            if (k > 0) { n -= k; continue; }
            if (buf == null) buf = new byte[8192];
            int r = in.read(buf, 0, (int) Math.min(buf.length, n));
            if (r < 0) throw new IOException("the file ended early");
            n -= r;
        }
    }

    /** At most n bytes of a stream. */
    static final class Limited extends FilterInputStream {
        private long left;
        Limited(InputStream in, long n) { super(in); left = n; }
        @Override public int read() throws IOException {
            if (left <= 0) return -1;
            int b = super.read();
            if (b >= 0) left--;
            return b;
        }
        @Override public int read(byte[] b, int off, int len) throws IOException {
            if (left <= 0) return -1;
            int r = super.read(b, off, (int) Math.min(len, left));
            if (r > 0) left -= r;
            return r;
        }
        @Override public long skip(long n) throws IOException {
            long k = super.skip(Math.min(n, left));
            if (k > 0) left -= k;
            return k;
        }
        @Override public int available() throws IOException { return (int) Math.min(super.available(), left); }
    }

    // ── pictures ─────────────────────────────────────────────────────
    private WebResourceResponse art(String path, Uri u) {
        String[] p = path.split("/");                      // "", "art", "album" or "audio", "123"
        if (p.length < 4) return text(404, "Not found.");
        long id = Long.parseLong(p[3]);
        int size = size(u, 256);
        byte[] b = "album".equals(p[2]) ? Art.album(app, id, size) : Art.track(app, id, size);
        return picture(b);
    }

    private WebResourceResponse thumb(String path, Uri u) {
        String[] p = path.split("/");                      // "", "thumb", "video" or "image", "123"
        if (p.length < 4) return text(404, "Not found.");
        if ("image".equals(p[2])) return picture(Art.image(app, Long.parseLong(p[3]), size(u, 256)));
        return picture(Art.video(app, Long.parseLong(p[3]), size(u, 320)));
    }

    private static int size(Uri u, int def) {
        try { String s = u.getQueryParameter("s"); if (s != null) return Math.max(48, Math.min(1024, Integer.parseInt(s))); }
        catch (Exception ignored) { }
        return def;
    }

    private static WebResourceResponse picture(byte[] b) {
        if (b == null) return text(404, "No picture.");
        Map<String, String> h = new HashMap<String, String>();
        h.put("Cache-Control", "max-age=86400");
        return new WebResourceResponse("image/jpeg", null, 200, "OK", h, new ByteArrayInputStream(b));
    }

    // ── the library ──────────────────────────────────────────────────
    private WebResourceResponse api(String path, Uri u) throws IOException {
        if (path.equals("/api/library/audio")) return json(MediaLibrary.audio(app));
        if (path.equals("/api/library/video")) return json(MediaLibrary.video(app));
        if (path.equals("/api/library/image")) return json(MediaLibrary.image(app));
        if (path.startsWith("/api/beside/")) {
            String[] p = path.split("/");                  // "", "api", "beside", "audio", "123"
            if (p.length < 5) return text(404, "Not found.");
            String ext = u.getQueryParameter("ext");
            String found = MediaLibrary.beside(app, p[3], Long.parseLong(p[4]), ext == null ? "lrc,srt,vtt" : ext);
            return found == null ? text(404, "None.") : json(found);
        }
        if (path.equals("/api/ping")) return text(200, "ok");
        return text(404, "Not found.");
    }

    // ── LRCLIB ───────────────────────────────────────────────────────
    /**
     * A lyrics lookup, passed on to lrclib.net as it is. Asked from here and
     * not from the page because LRCLIB asks to be told the app's name (the
     * User-Agent), which a page cannot set. 599 means it was not reached.
     */
    private WebResourceResponse lrclib(Uri u) {
        String rest = u.getEncodedPath().substring("/net/lrclib".length());
        if (!rest.startsWith("/api/")) return text(400, "Bad address.");
        String q = u.getEncodedQuery();
        String url = "https://lrclib.net" + rest + (q == null ? "" : "?" + q);
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(8000);
            c.setReadTimeout(15000);
            c.setRequestProperty("User-Agent", "BM Player " + BuildInfo.VERSION_NAME + " for Android (https://github.com/BritMat/bm-player)");
            c.setRequestProperty("Accept", "application/json");
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            byte[] body = in == null ? new byte[0] : readAll(in, 4 * 1024 * 1024);
            if (code < 100 || code > 599 || (code >= 300 && code < 400)) code = 502;
            Map<String, String> h = new HashMap<String, String>();
            h.put("Cache-Control", "no-store");
            return new WebResourceResponse("application/json", "utf-8", code, code == 200 ? "OK" : "Status " + code, h, new ByteArrayInputStream(body));
        } catch (IOException e) {
            BMLog.w("LRCLIB not reached: " + e);
            return text(599, "LRCLIB could not be reached: " + e.getMessage());
        } finally {
            if (c != null) c.disconnect();
        }
    }

    // ── helpers ──────────────────────────────────────────────────────
    static byte[] readAll(InputStream in, int max) throws IOException {
        try {
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int r;
            while ((r = in.read(buf)) > 0) {
                o.write(buf, 0, r);
                if (o.size() > max) throw new IOException("too large");
            }
            return o.toByteArray();
        } finally { in.close(); }
    }

    private static String header(WebResourceRequest req, String name) {
        Map<String, String> h = req.getRequestHeaders();
        if (h == null) return null;
        for (Map.Entry<String, String> e : h.entrySet()) if (name.equalsIgnoreCase(e.getKey())) return e.getValue();
        return null;
    }

    private static WebResourceResponse json(String s) throws IOException {
        Map<String, String> h = new HashMap<String, String>();
        h.put("Cache-Control", "no-store");
        return new WebResourceResponse("application/json", "utf-8", 200, "OK", h, new ByteArrayInputStream(s.getBytes("UTF-8")));
    }

    static WebResourceResponse text(int code, String s) {
        Map<String, String> h = new HashMap<String, String>();
        h.put("Cache-Control", "no-store");
        byte[] b;
        try { b = s.getBytes("UTF-8"); } catch (Exception e) { b = new byte[0]; }
        String reason = code == 200 ? "OK" : code == 404 ? "Not Found" : code == 403 ? "Forbidden" : code == 599 ? "Not Reached" : "Error";
        return new WebResourceResponse("text/plain", "utf-8", code, reason, h, new ByteArrayInputStream(b));
    }
}
