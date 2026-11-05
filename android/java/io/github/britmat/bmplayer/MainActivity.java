package io.github.britmat.bmplayer;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.media.AudioManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
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

import java.util.ArrayList;

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
    MediaDelete deleter;
    // Its parts (v3.47.0): the window, files in and out, and permissions.
    // The page reaches them through Bridge as a.screen, a.files, a.access.
    Screen screen;
    Files files;
    Access access;
    Pip pip;            // v3.48.0: a film in a small window of its own
    private boolean videoBehind;
    private WebChromeClient chrome;
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;
    private ValueCallback<Uri[]> fileCallback;
    private boolean pageReady;
    private JSONObject pendingOpen;
    private BroadcastReceiver power;
    // v3.48.0: the page's process stopped by Android again and again. The
    // phone's log had it started again forty times in a few seconds, with the
    // app out of sight and Android short of memory: each new one was stopped
    // as it began. Now it waits until the app is seen again, waits longer
    // each time it goes on happening, and from the third time in three
    // minutes the page starts lighter (?light=1: the Lite settings for that run).
    private final long[] goneAt = new long[8];
    private int goneN;
    private boolean pageGone, started;

    // The page's file input. Files has 12 to 16 (the picker), Access 7 and 21, MediaDelete its own.
    private static final int REQ_FILE = 11;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        current = this;
        screen = new Screen(this);
        files = new Files(this);
        access = new Access(this);
        pip = new Pip(this);
        BMLog.init(getApplicationContext());
        BMLog.i("start " + BuildInfo.VERSION_NAME + " (" + BuildInfo.VERSION_CODE + ") on Android " + Build.VERSION.RELEASE
                + " (API " + Build.VERSION.SDK_INT + "), " + Build.MANUFACTURER + " " + Build.MODEL + ", WebView " + webViewVersion());
        // The volume keys set the music's volume, even while nothing plays.
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        Window w = getWindow();
        w.setStatusBarColor(screen.barColor);
        w.setNavigationBarColor(screen.barColor);
        root = new FrameLayout(this);
        root.setBackgroundColor(screen.barColor);
        setContentView(root);
        server = new LocalServer(getApplicationContext());
        mpv = new MpvPlayer(this);
        deleter = new MediaDelete(this);
        try {
            makeWeb(false);
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
        pip.listen();
        handleIntent(getIntent());
    }

    private void makeWeb(boolean light) {
        web = new WebView(this);
        web.setBackgroundColor(videoBehind ? Color.TRANSPARENT : screen.barColor);
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
        web.loadUrl(ORIGIN + "/index.html" + (light ? "?light=1" : ""));
    }

    /** How many times the page's process went in the last three minutes, this time included. */
    private int goneLately(long now) {
        int n = 0;
        for (long t : goneAt) if (t > 0 && now - t < 180000) n++;
        return n;
    }

    /** The page again: at once the first time, then after 2, 5 and 15 seconds, lighter from the third time. */
    private void restartPage() {
        final int n = goneLately(SystemClock.elapsedRealtime());
        final boolean light = n >= 3;
        long wait = n <= 1 ? 0 : n == 2 ? 2000 : n == 3 ? 5000 : 15000;
        if (wait > 0) BMLog.w("the page starts again in " + (wait / 1000) + " s" + (light ? ", lighter" : ""));
        ui.postDelayed(new Runnable() {
            public void run() {
                if (isFinishing() || web != null) return;
                if (!started) { pageGone = true; return; }          // gone out of sight meanwhile
                try { makeWeb(light); } catch (Throwable t) { BMLog.e("could not start the page again: " + t); finish(); }
            }
        }, wait);
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
            long now = SystemClock.elapsedRealtime();
            goneAt[goneN++ % goneAt.length] = now;
            int n = goneLately(now);
            BMLog.e("the page's process " + (crashed ? "crashed" : "was stopped by Android to free memory")
                    + (n > 1 ? " (" + n + " times in three minutes)" : "")
                    + (started ? ": starting it again" : ", out of sight: it starts again when BM Player is opened"));
            PlaybackService.stopAll();
            if (mpv != null) mpv.close();                   // its controls went with the page
            if (web == view) {
                root.removeView(view);
                try { view.destroy(); } catch (Throwable ignored) { }
                web = null;
            }
            // Out of sight, a new page would only be stopped again: it waits to be seen.
            if (!started) pageGone = true;
            else restartPage();
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
            screen.immersive(true);
        }

        @Override
        public void onHideCustomView() {
            if (customView == null) return;
            root.removeView(customView);
            customView = null;
            if (customCallback != null) customCallback.onCustomViewHidden();
            customCallback = null;
            screen.immersive(false);
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

        /** The page asks for the microphone (the fox listens): Access decides. */
        @Override
        public void onPermissionRequest(final PermissionRequest r) {
            ui.post(new Runnable() { public void run() { access.micRequest(r); } });
        }

        @Override
        public void onPermissionRequestCanceled(PermissionRequest r) { access.micCanceled(r); }
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        // Android's answer about deleting (v3.45.0).
        if (request == MediaDelete.REQ_ALL || request == MediaDelete.REQ_ONE) { deleter.onResult(request, result); return; }
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
        if (files.onResult(request, result, data)) return;   // the file picker (Files.pickMedia)
        super.onActivityResult(request, result, data);
    }

    void toastShort(String text) { android.widget.Toast.makeText(this, text, android.widget.Toast.LENGTH_SHORT).show(); }

    /** mpv's picture behind the page (true), or not: the WebView is see-through while it shows. */
    void videoBehind(boolean on) {
        videoBehind = on;
        if (web != null) web.setBackgroundColor(on ? Color.TRANSPARENT : screen.barColor);
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
        openFile(u, type, Files.kindOf(type, files.displayName(u)), "opened from another app", null);
    }

    /** A file for the page to open, from another app or the file picker (Files): an 'open' event. */
    void openFile(Uri u, String type, String kind, String how, String key) {
        try {
            int n = server.register(u, type);
            JSONObject o = new JSONObject();
            o.put("url", "/opened/" + n);
            o.put("kind", kind);
            o.put("name", files.displayName(u));
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

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code == MediaDelete.REQ_WRITE) { deleter.onPermission(results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED); return; }
        access.onResult(code, results);
    }

    // ── the window (Screen) ──────────────────────────────────────────
    @Override
    public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        screen.focused(focus);
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

    // ── updates (v3.44.0, Updater) ───────────────────────────────────
    /** Android's page where BM Player may be allowed to install apps (its updates). */
    void allowInstalls() {
        Updater.get(this).waitForPermission();
        try {
            Intent i = Build.VERSION.SDK_INT >= 26
                    ? new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()))
                    : new Intent(Settings.ACTION_SECURITY_SETTINGS);
            startActivity(i);
        } catch (Exception e) {
            BMLog.w("install permission settings: " + e);
            access.openAppSettings();
        }
    }

    // ── lifecycle ────────────────────────────────────────────────────
    // The page is not paused when the app goes behind others: the music
    // plays on, and the playback service keeps the app alive while it does.
    @Override
    protected void onStart() {
        super.onStart();
        current = this;
        started = true;
        if (pageGone && web == null) { pageGone = false; restartPage(); }
        lifecycle("foreground");
    }

    /** Back from Android's settings, maybe with BM Player allowed to install its update. */
    @Override
    protected void onResume() {
        super.onResume();
        if (pip != null) pip.back();
        if (pageReady) Updater.get(this).resumed();
    }

    @Override
    protected void onStop() { super.onStop(); started = false; if (pip != null) pip.stopped(); lifecycle("background"); }

    /**
     * Every screen of another app the page opens (a share, Open with, a
     * picker, settings) comes through here: the film is not to go into its
     * small window for those (Pip.away).
     */
    @Override
    public void startActivityForResult(Intent intent, int requestCode, Bundle options) {
        if (pip != null) pip.away();
        super.startActivityForResult(intent, requestCode, options);
    }

    @Override
    public void startIntentSenderForResult(android.content.IntentSender intent, int requestCode, Intent fillInIntent, int flagsMask, int flagsValues, int extraFlags, Bundle options)
            throws android.content.IntentSender.SendIntentException {
        if (pip != null) pip.away();
        super.startIntentSenderForResult(intent, requestCode, fillInIntent, flagsMask, flagsValues, extraFlags, options);
    }

    /** Home pressed with a film playing: into its small window (v3.48.0, Pip). */
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (pip != null) pip.leaving();
    }

    @Override
    public void onPictureInPictureModeChanged(boolean on, android.content.res.Configuration c) {
        super.onPictureInPictureModeChanged(on, c);
        if (pip != null) pip.changed(on);
    }

    private void lifecycle(String state) {
        if (!pageReady) return;
        try { JSONObject o = new JSONObject(); o.put("state", state); emit("lifecycle", o); } catch (Exception ignored) { }
    }

    /**
     * Android is short of memory, or the app went out of sight (v3.44.0): the
     * page gives back what it is not showing (its effects' graphics memory) at
     * once. A smaller app is the last Android closes, and the music plays in it.
     */
    @Override
    @SuppressWarnings("deprecation")
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        // 20 is only "out of sight", not short of memory.
        if (level == TRIM_MEMORY_RUNNING_LOW || level == TRIM_MEMORY_RUNNING_CRITICAL || level >= TRIM_MEMORY_MODERATE)
            BMLog.w("Android is short of memory (level " + level + ")");
        Art.trim(level);
        if (level >= TRIM_MEMORY_RUNNING_LOW && pageReady) {
            try { JSONObject o = new JSONObject(); o.put("level", level); emit("memory", o); } catch (Exception ignored) { }
        }
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
        if (pip != null) pip.release();
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
