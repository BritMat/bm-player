package io.github.britmat.bmplayer;

import android.os.Build;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;

/**
 * What the page can ask of Android: window.BMAndroid. These run on a thread
 * of the WebView's own, so anything that touches the window is handed to the
 * main thread. Data (the library, pictures, the songs themselves) does not
 * come this way but from LocalServer, as ordinary web requests.
 */
final class Bridge {
    private final MainActivity a;

    Bridge(MainActivity a) { this.a = a; }

    private void onUi(Runnable r) { a.ui.post(r); }

    @JavascriptInterface
    public String info() {
        try {
            JSONObject o = new JSONObject();
            o.put("version", BuildInfo.VERSION_NAME);
            o.put("versionCode", BuildInfo.VERSION_CODE);
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("release", Build.VERSION.RELEASE);
            o.put("device", Build.MANUFACTURER + " " + Build.MODEL);
            JSONArray abis = new JSONArray();
            for (String s : Build.SUPPORTED_ABIS) abis.put(s);
            o.put("abis", abis);
            o.put("webview", a.webViewVersion());
            o.put("locale", Locale.getDefault().toString());
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    /** The page has started and listens for events (window.BMNative). */
    @JavascriptInterface
    public void ready() { a.pageReady(); }

    /** 'granted', 'ask' or 'denied' (refused for good: only the app's settings can change it). */
    @JavascriptInterface
    public String permission(String kind) { return a.permissionState(kind); }

    @JavascriptInterface
    public void requestPermission(final String kind) {
        onUi(new Runnable() { public void run() { a.askPermission(kind); } });
    }

    @JavascriptInterface
    public void openAppSettings() {
        onUi(new Runnable() { public void run() { a.openAppSettings(); } });
    }

    /** What is playing, for the notification, the lock screen and headphone buttons: JSON. */
    @JavascriptInterface
    public void playback(final String json) {
        onUi(new Runnable() { public void run() { PlaybackService.update(a, json); } });
    }

    @JavascriptInterface
    public void orientation(final String mode) {
        onUi(new Runnable() { public void run() { a.orientation(mode); } });
    }

    @JavascriptInterface
    public void immersive(final boolean on) {
        onUi(new Runnable() { public void run() { a.immersive(on); } });
    }

    @JavascriptInterface
    public void keepScreenOn(final boolean on) {
        onUi(new Runnable() { public void run() { a.keepScreenOn(on); } });
    }

    @JavascriptInterface
    public void bars(final String color, final boolean light) {
        onUi(new Runnable() { public void run() { a.bars(color, light); } });
    }

    @JavascriptInterface
    public void brightness(final float v) {
        onUi(new Runnable() { public void run() { a.brightness(v); } });
    }

    /** On battery (true) or charging, for the battery saver. Changes come as 'battery' events. */
    @JavascriptInterface
    public boolean onBattery() { return a.onBattery(); }

    @JavascriptInterface
    public void openUrl(final String url) {
        if (url == null || !(url.startsWith("https://") || url.startsWith("mailto:") || url.startsWith("market://"))) return;
        onUi(new Runnable() { public void run() { a.openExternal(url); } });
    }

    @JavascriptInterface
    public void toast(final String text) {
        onUi(new Runnable() { public void run() { Toast.makeText(a, text, Toast.LENGTH_SHORT).show(); } });
    }

    @JavascriptInterface
    public void share(final String text, final String subject) {
        onUi(new Runnable() { public void run() { a.share(text, subject); } });
    }

    @JavascriptInterface
    public void log(String text) { BMLog.i("page: " + text); }

    /** The app's own log, for the About page: what went wrong, to report. */
    @JavascriptInterface
    public String logText() { return BMLog.text(); }

    /** Behind the other apps, the music playing on. */
    @JavascriptInterface
    public void background() {
        onUi(new Runnable() { public void run() { a.moveTaskToBack(true); } });
    }

    /** Closed from the page: the music stops with it. */
    @JavascriptInterface
    public void exit() {
        onUi(new Runnable() { public void run() { PlaybackService.stopAll(); a.finish(); } });
    }

    // ── videos with mpv (MpvPlayer) ──────────────────────────────────
    /** Whether mpv can play videos here, and if not, why: JSON { available, reason, off, crashed }. */
    @JavascriptInterface
    public String mpvState() { return a.mpv.state(); }

    /** mpv chosen in Settings (true), or the web engine (false). */
    @JavascriptInterface
    public void mpvEnable(boolean on) { a.mpv.setOn(on); }

    /** Plays src (/media/video/ID or /opened/N) from start seconds. Its progress comes as 'mpv' events. */
    @JavascriptInterface
    public void mpvOpen(final String src, final double start, final boolean paused) {
        onUi(new Runnable() { public void run() { a.mpv.open(src, start, paused); } });
    }

    /** A command in mpv's own words, as a JSON list of strings: ["seek","10","relative"]. */
    @JavascriptInterface
    public void mpvCommand(String json) {
        final String[] args;
        try {
            JSONArray j = new JSONArray(json);
            args = new String[j.length()];
            for (int k = 0; k < args.length; k++) args[k] = j.isNull(k) ? null : String.valueOf(j.get(k));
        } catch (Exception e) { BMLog.w("mpv command " + json + ": " + e); return; }
        onUi(new Runnable() { public void run() { a.mpv.command(args); } });
    }

    @JavascriptInterface
    public void mpvClose() {
        onUi(new Runnable() { public void run() { a.mpv.close(); } });
    }

    /** Subtitles the page has as text (a chosen file, or one beside the video). */
    @JavascriptInterface
    public void mpvSubAdd(final String name, final String text) {
        if (text == null || text.length() > 8 * 1024 * 1024) return;
        onUi(new Runnable() { public void run() { a.mpv.addSubtitles(name, text); } });
    }

    /** Android's file picker: 'video', 'audio', 'image', 'pdf' or 'any'. The file comes back as an 'open' event. */
    @JavascriptInterface
    public void pickMedia(final String kind) {
        onUi(new Runnable() { public void run() { a.pickMedia(kind); } });
    }

    /** The video (or song) at src in another app, which Android asks the user to pick. */
    @JavascriptInterface
    public void openWith(final String src) {
        onUi(new Runnable() { public void run() { a.openWith(src); } });
    }

    // ── v3.42.0 ──────────────────────────────────────────────────────
    /** The file at src (a picture, a PDF, a video) sent to another app. */
    @JavascriptInterface
    public void shareFile(final String src, final String type) {
        onUi(new Runnable() { public void run() { a.shareFile(src, type); } });
    }

    /** A file chosen earlier, by the key its 'open' event carried: its address now (/opened/N), or null. */
    @JavascriptInterface
    public String reopen(String key) { return key == null ? null : a.reopen(key); }

    /** The brightness now, 0 to 1, for the video player's swipe. */
    @JavascriptInterface
    public float screenBrightness() { return a.screenBrightness(); }

    /** The music volume, JSON { v, max }. */
    @JavascriptInterface
    public String volume() { return a.volume(); }

    @JavascriptInterface
    public void setVolume(final int v) {
        onUi(new Runnable() { public void run() { a.setVolume(v); } });
    }

    /** The battery's charge in percent, or -1. */
    @JavascriptInterface
    public int batteryLevel() { return a.batteryLevel(); }
}
