package io.github.britmat.bmplayer;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.media.AudioManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Locale;

/**
 * BM Player for Android: one window with a WebView that shows the app's
 * pages (assets/www), served from https://appassets.androidplatform.net by
 * LocalServer along with the phone's music and videos. That address is the
 * one Android sets aside for an app's own pages: it never reaches the
 * internet, and it gives the page an origin of its own, which the Web Audio
 * analyser (the visualiser) needs to hear the music.
 *
 * The page asks Android for things through Bridge (window.BMAndroid), and
 * Android tells the page through window.BMNative.event(type, data).
 *
 * Videos play with mpv (MpvPlayer), in a SurfaceView behind the WebView:
 * while one is open the WebView is see-through, so the page's controls sit
 * over the picture.
 *
 * Built with the plain Android SDK tools and no Gradle (android/build-apk.mjs).
 * Anything newer than Android 7.0 (API 24) is behind a version check.
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String ORIGIN = "https://" + HOST;
    /** The window, for the playback service to reach the page. Null when there is none. */
    static volatile MainActivity current;

    final Handler ui = new Handler(Looper.getMainLooper());
    FrameLayout root;
    WebView web;
    LocalServer server;
    MpvPlayer mpv;
    private boolean videoBehind;
    private WebChromeClient chrome;
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;
    private ValueCallback<Uri[]> fileCallback;
    private boolean pageReady;
    private JSONObject pendingOpen;
    private int barColor = 0xFF080B14;
    private boolean lightBars, immersiveOn;
    private BroadcastReceiver power;
    private PermissionRequest pendingMic;

    private static final int REQ_FILE = 11, REQ_MEDIA = 7, REQ_PICK_VIDEO = 12, REQ_PICK_AUDIO = 13, REQ_PICK_IMAGE = 14, REQ_PICK_PDF = 15,
            REQ_PICK_ANY = 16, REQ_MIC = 21;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        current = this;
        BMLog.init(getApplicationContext());
        BMLog.i("start " + BuildInfo.VERSION_NAME + " (" + BuildInfo.VERSION_CODE + ") on Android " + Build.VERSION.RELEASE
                + " (API " + Build.VERSION.SDK_INT + "), " + Build.MANUFACTURER + " " + Build.MODEL + ", WebView " + webViewVersion());
        // The volume keys set the music's volume, even while nothing plays.
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        Window w = getWindow();
        w.setStatusBarColor(barColor);
        w.setNavigationBarColor(barColor);
        root = new FrameLayout(this);
        root.setBackgroundColor(barColor);
        setContentView(root);
        server = new LocalServer(getApplicationContext());
        mpv = new MpvPlayer(this);
        try {
            makeWeb();
        } catch (Throwable t) {
            // No WebView: being updated, turned off, or missing (some phones without Google's apps).
            BMLog.e("no WebView: " + t);
            TextView tv = new TextView(this);
            tv.setText("BM Player shows its screens with Android System WebView, and it could not be started on this phone.\n\n"
                    + "If it is being updated, wait a minute and open BM Player again. Otherwise install or turn on "
                    + "\"Android System WebView\" (or Google Chrome) from the Play Store.\n\n" + t);
            tv.setTextColor(0xFFE4EAF6);
            tv.setTextSize(16);
            int pad = (int) (24 * getResources().getDisplayMetrics().density);
            tv.setPadding(pad, pad * 2, pad, pad);
            root.addView(tv);
            return;
        }
        listenPower();
        handleIntent(getIntent());
    }

    private void makeWeb() {
        web = new WebView(this);
        web.setBackgroundColor(videoBehind ? Color.TRANSPARENT : barColor);
        // Above mpv's picture, when there is one, so the page's controls show over it.
        View video = mpv == null ? null : mpv.surfaceView();
        int at = video == null ? 0 : root.indexOfChild(video) + 1;
        root.addView(web, at, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);   // the next song starts by itself, and from the lock screen
        s.setAllowFileAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        // The page is laid out in its own pixels, and Android's font size
        // setting scaled on top of that breaks the layout.
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " BMPlayerAndroid/" + BuildInfo.VERSION_NAME);
        // A computer on USB can look into the page (chrome://inspect) once
        // developer options allow it: how a fault on a phone is found.
        WebView.setWebContentsDebuggingEnabled(true);
        // The page plays the music, so its process must not be the first to
        // go when the app is behind others (Android 8 and later).
        if (Build.VERSION.SDK_INT >= 26) web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        web.setWebViewClient(new Client());
        chrome = new Chrome();
        web.setWebChromeClient(chrome);
        web.addJavascriptInterface(new Bridge(this), "BMAndroid");
        pageReady = false;
        web.loadUrl(ORIGIN + "/index.html");
    }

    private class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return server.handle(request);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (HOST.equals(u.getHost())) return false;
            openExternal(u.toString());                     // anything else opens in the browser
            return true;
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            boolean crashed = Build.VERSION.SDK_INT >= 26 && detail != null && detail.didCrash();
            BMLog.e("the page's process " + (crashed ? "crashed" : "was stopped by Android to free memory") + ": starting it again");
            PlaybackService.stopAll();
            if (mpv != null) mpv.close();                   // its controls went with the page
            if (web == view) {
                root.removeView(view);
                try { view.destroy(); } catch (Throwable ignored) { }
                web = null;
            }
            ui.post(new Runnable() {
                public void run() {
                    if (isFinishing() || web != null) return;
                    try { makeWeb(); } catch (Throwable t) { BMLog.e("could not start the page again: " + t); finish(); }
                }
            });
            return true;
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public boolean onConsoleMessage(ConsoleMessage m) {
            ConsoleMessage.MessageLevel l = m.messageLevel();
            if (l == ConsoleMessage.MessageLevel.ERROR || l == ConsoleMessage.MessageLevel.WARNING) {
                String src = m.sourceId() == null ? "" : m.sourceId().replace(ORIGIN, "");
                BMLog.w("page: " + m.message() + " (" + src + ":" + m.lineNumber() + ")");
            }
            return true;
        }

        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            if (customView != null) { callback.onCustomViewHidden(); return; }
            customView = view;
            customCallback = callback;
            root.addView(view, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
            immersive(true);
        }

        @Override
        public void onHideCustomView() {
            if (customView == null) return;
            root.removeView(customView);
            customView = null;
            if (customCallback != null) customCallback.onCustomViewHidden();
            customCallback = null;
            immersive(false);
        }

        /** A file input in the page: Android's own file picker. */
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            Intent i = new Intent(Intent.ACTION_GET_CONTENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            // Lyrics and subtitle files (.lrc, .srt) have no type Android knows,
            // so a list of extensions asks for any file.
            ArrayList<String> types = new ArrayList<String>();
            boolean byName = false;
            String[] accept = params.getAcceptTypes();
            if (accept != null) for (String a : accept) for (String t : a.split(",")) {
                t = t.trim();
                if (t.contains("/")) types.add(t);
                else if (t.length() > 0) byName = true;
            }
            if (byName || types.isEmpty()) i.setType("*/*");
            else if (types.size() == 1) i.setType(types.get(0));
            else {
                i.setType("*/*");
                i.putExtra(Intent.EXTRA_MIME_TYPES, types.toArray(new String[0]));
            }
            if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            try {
                startActivityForResult(i, REQ_FILE);
            } catch (ActivityNotFoundException e) {
                BMLog.w("no file picker: " + e);
                fileCallback = null;
                callback.onReceiveValue(null);
            }
            return true;
        }

        /** No grey film icon in a video before its first picture. */
        @Override
        public Bitmap getDefaultVideoPoster() {
            return Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
        }

        /**
         * The page asks for the microphone (v3.42.0: the fox listens, after
         * Talk is pressed). Only the app's own page, only the microphone, and
         * only once Android's own permission is given: asked for here the
         * first time. Anything else (the camera) is refused.
         */
        @Override
        public void onPermissionRequest(final PermissionRequest r) {
            ui.post(new Runnable() {
                public void run() {
                    boolean ours = r.getOrigin() != null && HOST.equals(r.getOrigin().getHost());
                    boolean mic = false;
                    for (String res : r.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) mic = true;
                    if (!ours || !mic) { r.deny(); return; }
                    if (checkSelfPermission("android.permission.RECORD_AUDIO") == PackageManager.PERMISSION_GRANTED) {
                        r.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
                        return;
                    }
                    if (pendingMic != null) pendingMic.deny();
                    pendingMic = r;
                    getSharedPreferences("bm", MODE_PRIVATE).edit().putBoolean("asked:android.permission.RECORD_AUDIO", true).apply();
                    requestPermissions(new String[] { "android.permission.RECORD_AUDIO" }, REQ_MIC);
                }
            });
        }

        @Override
        public void onPermissionRequestCanceled(PermissionRequest r) {
            if (pendingMic == r) pendingMic = null;
        }
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        if (request == REQ_FILE) {
            ValueCallback<Uri[]> cb = fileCallback;
            fileCallback = null;
            if (cb == null) return;
            Uri[] picked = null;
            if (result == RESULT_OK && data != null) {
                if (data.getClipData() != null && data.getClipData().getItemCount() > 0) {
                    picked = new Uri[data.getClipData().getItemCount()];
                    for (int k = 0; k < picked.length; k++) picked[k] = data.getClipData().getItemAt(k).getUri();
                } else if (data.getData() != null) picked = new Uri[] { data.getData() };
            }
            cb.onReceiveValue(picked);
            return;
        }
        if (request >= REQ_PICK_VIDEO && request <= REQ_PICK_ANY) {
            if (result == RESULT_OK && data != null && data.getData() != null) {
                Uri u = data.getData();
                String type = null;
                try { type = getContentResolver().getType(u); } catch (Exception ignored) { }
                String name = displayName(u);
                String kind = request == REQ_PICK_VIDEO ? "video" : request == REQ_PICK_AUDIO ? "audio" : request == REQ_PICK_IMAGE ? "image"
                        : request == REQ_PICK_PDF ? "pdf" : kindOf(type, name);
                // Kept by Android for the app (v3.42.0), so Home can open it again after a restart.
                String key = null;
                try {
                    getContentResolver().takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    key = rememberDoc(u, type, name);
                } catch (Exception e) { BMLog.w("could not keep access to the file: " + e.getMessage()); }
                openFile(u, type, kind, "chosen", key);
            }
            return;
        }
        super.onActivityResult(request, result, data);
    }

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
        try { startActivityForResult(i, req); }
        catch (ActivityNotFoundException e) { BMLog.w("no file picker: " + e); }
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
        try {
            if (src.startsWith("/media/image/")) return android.content.ContentUris.withAppendedId(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, Long.parseLong(src.substring(13).split("\\?")[0]));
        } catch (NumberFormatException ignored) { }
        return mpv == null ? null : mpv.uriOf(src);
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
            startActivity(Intent.createChooser(i, "Share"));
        } catch (Exception e) { BMLog.w("share file: " + e); }
    }

    // ── files Android keeps for the app (v3.42.0) ────────────────────
    /** A chosen file remembered under a short key, for Home to open again later. At most 40. */
    String rememberDoc(Uri u, String type, String name) throws Exception {
        String key = shortHash(u.toString());
        android.content.SharedPreferences p = getSharedPreferences("docs", MODE_PRIVATE);
        JSONObject all = new JSONObject(p.getString("all", "{}"));
        JSONObject o = new JSONObject();
        o.put("u", u.toString()); o.put("t", type == null ? "" : type); o.put("n", name == null ? "" : name); o.put("at", System.currentTimeMillis());
        all.remove(key);
        all.put(key, o);
        while (all.length() > 40) {
            String oldest = null; long at = Long.MAX_VALUE;
            for (Iterator<String> it = all.keys(); it.hasNext(); ) { String k = it.next(); long a = all.getJSONObject(k).optLong("at"); if (a < at) { at = a; oldest = k; } }
            if (oldest == null) break;
            try { getContentResolver().releasePersistableUriPermission(Uri.parse(all.getJSONObject(oldest).getString("u")), Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (Exception ignored) { }
            all.remove(oldest);
        }
        p.edit().putString("all", all.toString()).apply();
        return key;
    }

    /** A remembered file's address in the page again (/opened/N), or null when it is gone or no longer allowed. */
    String reopen(String key) {
        try {
            JSONObject o = new JSONObject(getSharedPreferences("docs", MODE_PRIVATE).getString("all", "{}")).optJSONObject(key);
            if (o == null) return null;
            Uri u = Uri.parse(o.getString("u"));
            android.content.res.AssetFileDescriptor f = getContentResolver().openAssetFileDescriptor(u, "r");
            if (f == null) return null;
            f.close();
            String t = o.optString("t", "");
            return "/opened/" + server.register(u, t.length() > 0 ? t : null);
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
        try { type = getContentResolver().getType(u); } catch (Exception ignored) { }
        if (type == null && src.startsWith("/opened/")) {
            try { type = server.type(Integer.parseInt(src.substring(8))); } catch (Exception ignored) { }
        }
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(u, type != null ? type : src.startsWith("/media/audio/") ? "audio/*" : src.startsWith("/media/image/") ? "image/*" : "video/*");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent chooser = Intent.createChooser(i, "Open with");
        chooser.putExtra(Intent.EXTRA_EXCLUDE_COMPONENTS, new ComponentName[] { new ComponentName(this, MainActivity.class) });
        try { startActivity(chooser); }
        catch (Exception e) { BMLog.w("open with: " + e); toastShort("No other app on this phone can open it."); }
    }

    void toastShort(String text) { android.widget.Toast.makeText(this, text, android.widget.Toast.LENGTH_SHORT).show(); }

    /** mpv's picture behind the page (true), or not: the WebView is see-through while it shows. */
    void videoBehind(boolean on) {
        videoBehind = on;
        if (web != null) web.setBackgroundColor(on ? Color.TRANSPARENT : barColor);
    }

    // ── talking to the page ──────────────────────────────────────────
    /** An event for the page: window.BMNative.event(type, data). Safe from any thread. */
    void emit(final String type, final JSONObject data) {
        ui.post(new Runnable() {
            public void run() {
                if (web == null) return;
                String js = "window.BMNative&&BMNative.event(" + JSONObject.quote(type) + "," + (data == null ? "null" : data.toString()) + ")";
                web.evaluateJavascript(js, null);
            }
        });
    }

    /** The page is ready for events: anything held back for it goes now. */
    void pageReady() {
        ui.post(new Runnable() {
            public void run() {
                pageReady = true;
                deliverOpen();
                emitBattery();
            }
        });
    }

    void openExternal(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (Exception e) { BMLog.w("could not open " + url + ": " + e); }
    }

    void share(String text, String subject) {
        try {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_TEXT, text);
            if (subject != null) i.putExtra(Intent.EXTRA_SUBJECT, subject);
            startActivity(Intent.createChooser(i, subject));
        } catch (Exception e) { BMLog.w("share: " + e); }
    }

    // ── a file opened from another app ───────────────────────────────
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent i) {
        if (i == null || !Intent.ACTION_VIEW.equals(i.getAction()) || i.getData() == null || server == null) return;
        Uri u = i.getData();
        String type = i.getType();
        try { if (type == null) type = getContentResolver().getType(u); } catch (Exception ignored) { }
        openFile(u, type, kindOf(type, displayName(u)), "opened from another app", null);
    }

    /** A file for the page to open, from another app or the file picker: an 'open' event. */
    private void openFile(Uri u, String type, String kind, String how, String key) {
        try {
            int n = server.register(u, type);
            JSONObject o = new JSONObject();
            o.put("url", "/opened/" + n);
            o.put("kind", kind);
            o.put("name", displayName(u));
            o.put("mime", type == null ? "" : type);
            if (key != null) o.put("key", key);
            BMLog.i(how + ": " + kind + " " + (type == null ? "" : type));
            pendingOpen = o;
            deliverOpen();
        } catch (Exception e) { BMLog.w("could not open " + u + ": " + e); }
    }

    private void deliverOpen() {
        if (pendingOpen != null && pageReady && web != null) { emit("open", pendingOpen); pendingOpen = null; }
    }

    private String displayName(Uri u) {
        String name = null;
        try {
            Cursor c = getContentResolver().query(u, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null);
            if (c != null) { try { if (c.moveToFirst()) name = c.getString(0); } finally { c.close(); } }
        } catch (Exception ignored) { }
        if (name == null) name = u.getLastPathSegment();
        return name == null ? "" : name;
    }

    // ── permissions ──────────────────────────────────────────────────
    /** What a kind of access needs: Android 13 split reading media in two, before it there was one. */
    static String[] permissionsFor(String kind) {
        if ("notifications".equals(kind)) return Build.VERSION.SDK_INT >= 33 ? new String[] { "android.permission.POST_NOTIFICATIONS" } : new String[0];
        if ("mic".equals(kind)) return new String[] { "android.permission.RECORD_AUDIO" };
        if (Build.VERSION.SDK_INT >= 33) return new String[] { "video".equals(kind) ? "android.permission.READ_MEDIA_VIDEO"
                : "image".equals(kind) ? "android.permission.READ_MEDIA_IMAGES" : "android.permission.READ_MEDIA_AUDIO" };
        return new String[] { "android.permission.READ_EXTERNAL_STORAGE" };
    }

    /** 'granted', 'ask', or 'denied' (refused for good: only the app's settings can change it). */
    String permissionState(String kind) {
        String[] ps = permissionsFor(kind);
        if (ps.length == 0) return "granted";
        String p = ps[0];
        if (checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED) return "granted";
        boolean asked = getSharedPreferences("bm", MODE_PRIVATE).getBoolean("asked:" + p, false);
        return asked && !shouldShowRequestPermissionRationale(p) ? "denied" : "ask";
    }

    void askPermission(String kind) {
        String[] ps = permissionsFor(kind);
        if (ps.length == 0) { permissionResult(); return; }
        getSharedPreferences("bm", MODE_PRIVATE).edit().putBoolean("asked:" + ps[0], true).apply();
        if (checkSelfPermission(ps[0]) == PackageManager.PERMISSION_GRANTED) { permissionResult(); return; }
        requestPermissions(ps, REQ_MEDIA);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code == REQ_MIC && pendingMic != null) {
            PermissionRequest r = pendingMic;
            pendingMic = null;
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) r.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
            else r.deny();
        }
        permissionResult();
    }

    private void permissionResult() {
        try {
            JSONObject o = new JSONObject();
            o.put("audio", permissionState("audio"));
            o.put("video", permissionState("video"));
            o.put("image", permissionState("image"));
            o.put("mic", permissionState("mic"));
            o.put("notifications", permissionState("notifications"));
            BMLog.i("access: music " + o.optString("audio") + ", videos " + o.optString("video") + ", pictures " + o.optString("image") + ", microphone " + o.optString("mic"));
            emit("permission", o);
        } catch (Exception e) { BMLog.w("permission result: " + e); }
    }

    /** The app's page in Android's settings, for access refused for good. */
    void openAppSettings() {
        try { startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); }
        catch (Exception e) { BMLog.w("settings: " + e); }
    }

    // ── the window ───────────────────────────────────────────────────
    void orientation(String mode) {
        int o = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;          // as the phone's auto-rotate says
        if ("landscape".equals(mode)) o = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
        else if ("portrait".equals(mode)) o = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
        else if ("sensor".equals(mode)) o = ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR;
        setRequestedOrientation(o);
    }

    void immersive(boolean on) {
        immersiveOn = on;
        applyBars();
    }

    /** The bars at the top and bottom in the page's colour, with dark or light icons. */
    void bars(String color, boolean light) {
        try {
            barColor = Color.parseColor(color);
            lightBars = light;
            getWindow().setStatusBarColor(barColor);
            getWindow().setNavigationBarColor(barColor);
            root.setBackgroundColor(barColor);
            applyBars();
        } catch (Exception e) { BMLog.w("bars " + color + ": " + e); }
    }

    @SuppressWarnings("deprecation")
    private void applyBars() {
        View d = getWindow().getDecorView();
        int f = 0;
        if (immersiveOn) {
            f = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
        } else if (lightBars) {
            f = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= 26) f |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        d.setSystemUiVisibility(f);
    }

    @Override
    public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus && immersiveOn) applyBars();
    }

    void keepScreenOn(boolean on) {
        if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    /** The screen's brightness for this window, 0 to 1, or below 0 for the phone's own. */
    void brightness(float v) {
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.screenBrightness = v < 0 ? WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE : Math.max(0.01f, Math.min(1f, v));
        getWindow().setAttributes(lp);
    }

    /** The brightness now, 0 to 1: this window's own, or the phone's setting (v3.42.0, the video player's swipe). */
    float screenBrightness() {
        float w = getWindow().getAttributes().screenBrightness;
        if (w >= 0) return w;
        try { return Settings.System.getInt(getContentResolver(), Settings.System.SCREEN_BRIGHTNESS) / 255f; }
        catch (Exception e) { return 0.5f; }
    }

    /** The music volume as { v, max }, in the phone's own steps. */
    String volume() {
        try {
            AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
            JSONObject o = new JSONObject();
            o.put("v", am.getStreamVolume(AudioManager.STREAM_MUSIC));
            o.put("max", am.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    /** Sets it, without Android's own volume panel (the player shows its own). */
    void setVolume(int v) {
        try {
            AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
            am.setStreamVolume(AudioManager.STREAM_MUSIC, Math.max(0, Math.min(am.getStreamMaxVolume(AudioManager.STREAM_MUSIC), v)), 0);
        } catch (Exception e) { BMLog.w("volume: " + e); }   // Do Not Disturb can refuse it
    }

    /** The battery's charge in percent, or -1. */
    int batteryLevel() {
        try {
            Intent b = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (b == null) return -1;
            int l = b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1), sc = b.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
            return l < 0 || sc <= 0 ? -1 : Math.round(l * 100f / sc);
        } catch (Exception e) { return -1; }
    }

    // ── the battery, for the battery saver ───────────────────────────
    boolean onBattery() {
        try {
            Intent b = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            return b == null || b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) == 0;
        } catch (Exception e) { return false; }
    }

    private void listenPower() {
        power = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent i) { emitBattery(); }
        };
        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_POWER_CONNECTED);
        f.addAction(Intent.ACTION_POWER_DISCONNECTED);
        Compat.register(this, power, f);
    }

    private void emitBattery() {
        try { JSONObject o = new JSONObject(); o.put("onBattery", onBattery()); o.put("level", batteryLevel()); emit("battery", o); } catch (Exception ignored) { }
    }

    // ── lifecycle ────────────────────────────────────────────────────
    // The page is not paused when the app goes behind others: the music
    // plays on, and the playback service keeps the app alive while it does.
    @Override
    protected void onStart() { super.onStart(); current = this; lifecycle("foreground"); }

    @Override
    protected void onStop() { super.onStop(); lifecycle("background"); }

    private void lifecycle(String state) {
        if (!pageReady) return;
        try { JSONObject o = new JSONObject(); o.put("state", state); emit("lifecycle", o); } catch (Exception ignored) { }
    }

    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        if (level >= TRIM_MEMORY_RUNNING_LOW) BMLog.w("Android is short of memory (level " + level + ")");
    }

    /** Back: the page closes what is open. With nothing to close the app goes behind the others and the music plays on. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (customView != null) { chrome.onHideCustomView(); return; }
        if (web == null || !pageReady) { moveTaskToBack(true); return; }
        web.evaluateJavascript("window.BMNative?BMNative.back():'background'", new ValueCallback<String>() {
            public void onReceiveValue(String v) {
                if (v == null) v = "";
                if (v.contains("handled")) return;
                if (v.contains("exit")) { PlaybackService.stopAll(); finish(); }
                else moveTaskToBack(true);
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (current == this) current = null;
        if (power != null) { try { unregisterReceiver(power); } catch (Exception ignored) { } power = null; }
        // The music lives in the page: with the page gone it stops, and the service with it.
        PlaybackService.stopAll();
        if (mpv != null) mpv.destroy();
        if (web != null) {
            try { root.removeView(web); web.destroy(); } catch (Exception ignored) { }
            web = null;
        }
        super.onDestroy();
    }

    String webViewVersion() {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                PackageInfo p = WebView.getCurrentWebViewPackage();
                if (p != null) return p.packageName + " " + p.versionName;
            }
        } catch (Throwable ignored) { }
        return "?";
    }
}
