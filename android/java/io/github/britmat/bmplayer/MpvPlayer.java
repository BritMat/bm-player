package io.github.britmat.bmplayer;

import android.content.BroadcastReceiver;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.view.Display;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.widget.FrameLayout;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;

import is.xyz.mpv.MPVLib;

/**
 * Videos played by mpv (v3.41.0), the engine the desktop BM Player uses. The
 * phone's web engine plays only what the phone can decode, and stops on a
 * good share of real films (MKV, 4K H.265, several audio tracks, styled
 * subtitles). mpv, with FFmpeg, plays nearly anything, using the phone's
 * hardware decoder where it can and its own where it cannot.
 *
 * How it fits together: mpv draws into a SurfaceView behind the WebView, and
 * while a video is open the page is see-through, so the video shows under
 * the page's own controls. The page asks for things through Bridge (mpvOpen,
 * mpvCommand, mpvClose), and hears back as 'mpv' events: { e: 'time', t },
 * { e: 'pause', v }, { e: 'loaded', ... }, { e: 'tracks', list }, and
 * { e: 'error', text } when a file will not play.
 *
 * The order of the calls into mpv follows mpv-android's own player
 * (BaseMPVView and MPVView, release 2026-09-17), whose libraries these are:
 * create, the options, init, then the surface as it comes and goes. Every
 * call into mpv is made on the main thread. mpv's own thread reports through
 * MPVLib's listener, and those reports are posted to the main thread too.
 *
 * Should mpv ever bring the app down while starting or opening a file, the
 * next run knows (a note kept until it succeeds): videos then fall back to
 * the web engine, and the log says why.
 */
final class MpvPlayer implements MPVLib.Listener, SurfaceHolder.Callback, AudioManager.OnAudioFocusChangeListener {
    /** mpv-android's release the libraries come from (android/build-apk.mjs pins it). */
    static final String RELEASE = "2026-09-17";

    // mpv's events (mpv_event_id), as the glue passes them on.
    private static final int EV_SHUTDOWN = 1, EV_START_FILE = 6, EV_END_FILE = 7, EV_FILE_LOADED = 8,
            EV_VIDEO_RECONFIG = 17, EV_PLAYBACK_RESTART = 21;
    // mpv's log levels: fatal 10, error 20, warn 30, info 40.
    private static final int LOG_WARN = 30;

    /** What the page may ask of mpv: commands, and the properties they may set. */
    private static final HashSet<String> COMMANDS = new HashSet<String>(Arrays.asList(
            "seek", "set", "cycle", "add", "frame-step", "frame-back-step", "sub-remove", "sub-reload"));
    private static final HashSet<String> PROPS = new HashSet<String>(Arrays.asList(
            "pause", "speed", "sid", "aid", "secondary-sid", "panscan", "sub-delay", "audio-delay", "sub-visibility",
            "sub-scale", "sub-font-size", "sub-border-style", "sub-back-color", "sub-border-size", "sub-shadow-offset",
            "sub-margin-y", "sub-pos", "volume", "mute", "loop-file", "video-rotate", "video-zoom", "hwdec",
            // v3.42.0: the picture's size and place, repeating a part
            "keepaspect", "video-unscaled", "video-aspect-override", "video-pan-x", "video-pan-y", "ab-loop-a", "ab-loop-b"));

    // mpv is one per app. These describe it, whichever window made it, and
    // owner is the window it reports to (a new window takes it over).
    private static boolean created, broken, checked, voOff;
    private static MpvPlayer owner;
    private static String crashedOn, versions;
    // The file in mpv: begun, loaded, and whether its end was asked for.
    private static boolean active, loaded, stopping, paused = true;
    private static int subs;

    private final MainActivity a;
    private final Context app;
    private final SharedPreferences prefs;
    private SurfaceView view;
    private boolean surface, shown;
    private String pending;                 // what to open once the surface is there
    private double pendingStart;
    private boolean pendingPaused;
    private final ArrayDeque<String> errors = new ArrayDeque<String>();
    private int logged;                     // mpv's lines in the app's log for this file
    private volatile long timeAt;
    private volatile boolean timeNow;
    private boolean focus, resumeOnGain, ducked;
    private Object focusReq;                // an AudioFocusRequest (Android 8 and later), kept untyped for Android 7
    private BroadcastReceiver noisy;
    private boolean noisyOn;

    MpvPlayer(MainActivity a) {
        this.a = a;
        app = a.getApplicationContext();
        prefs = app.getSharedPreferences("bm", Context.MODE_PRIVATE);
        lastRun(prefs);
    }

    /** Once a run: did mpv bring the app down last time? */
    private static synchronized void lastRun(SharedPreferences p) {
        if (checked) return;
        checked = true;
        if (p.getBoolean("mpv_starting", false)) {
            BMLog.e("mpv did not start last time: the app closed while it was starting. "
                    + "Videos play with the web engine until mpv is chosen again in Settings.");
            p.edit().putBoolean("mpv_starting", false).putBoolean("mpv_off", true).commit();
        }
        String s = p.getString("mpv_opening", null);
        if (s != null && s.length() > 0) {
            crashedOn = s;
            BMLog.e("the app closed while mpv was opening a video last time (" + s + "): that one plays with the web engine next");
            p.edit().remove("mpv_opening").commit();
        }
    }

    // ── for the page ─────────────────────────────────────────────────
    /** Whether videos can play with mpv, and if not, why: JSON for the page. Any thread. */
    String state() {
        JSONObject o = new JSONObject();
        try {
            String why = null;
            if (broken) why = "mpv could not be started on this phone.";
            else if (MPVLib.loadError() != null) why = "mpv's files could not be loaded (" + MPVLib.loadError() + ").";
            else if (!libsPresent()) why = "mpv is not in this app for this phone's processor (" + Build.SUPPORTED_ABIS[0] + ").";
            o.put("available", why == null);
            if (why != null) o.put("reason", why);
            o.put("off", prefs.getBoolean("mpv_off", false));
            o.put("release", RELEASE);
            if (crashedOn != null) o.put("crashed", crashedOn);
            if (versions != null) o.put("versions", versions);
        } catch (JSONException ignored) { }
        return o.toString();
    }

    /** Chosen in Settings (true), or not: the web engine plays videos instead. */
    void setOn(boolean on) {
        prefs.edit().putBoolean("mpv_off", !on).apply();
    }

    private boolean libsPresent() {
        try {
            String dir = app.getApplicationInfo().nativeLibraryDir;
            return dir != null && new File(dir, "libmpv.so").exists() && new File(dir, "libplayer.so").exists();
        } catch (Exception e) { return false; }
    }

    /**
     * Plays a video: src is the page's own address for it (/media/video/ID,
     * /opened/N), start where to begin, in seconds.
     */
    void open(String src, double start, boolean startPaused) {
        Uri u = uriOf(src);
        String file = u == null ? null : readable(u);
        if (file == null) { error("BM Player could not open that file. It may have been moved, or access to it was taken away."); return; }
        if (!ensure()) {
            Throwable t = MPVLib.loadError();
            send("unavailable", "reason", broken ? "mpv could not be started on this phone." : "mpv's files could not be loaded" + (t == null ? "." : " (" + t + ")."));
            return;
        }
        // Kept until the first picture: if the app goes down before, the next run knows.
        prefs.edit().putString("mpv_opening", src).commit();
        pending = file;
        pendingStart = start;
        pendingPaused = startPaused;
        show(true);
        if (surface) loadPending();
    }

    /** Calls into mpv only from the window it reports to. */
    private boolean mine() { return created && owner == this; }

    /** The video closed: mpv stops, and the page is solid again. */
    void close() {
        pending = null;
        if (mine()) {
            if (active) stopping = true;
            MPVLib.command(new String[] { "stop" });
        }
        prefs.edit().remove("mpv_opening").apply();
        resumeOnGain = false;
        listenNoisy(false);
        focus(false);
        if (shown) show(false);
    }

    /** A command from the page, as mpv's own words: ["seek", "10", "relative"], ["set", "pause", "yes"]. */
    void command(String[] args) {
        if (!mine() || args == null || args.length == 0 || args.length > 8) return;
        for (String s : args) if (s == null) return;               // the glue cannot take a missing word
        if (!COMMANDS.contains(args[0])) { BMLog.w("mpv: the page asked for '" + args[0] + "', which is not allowed"); return; }
        if (("set".equals(args[0]) || "cycle".equals(args[0]) || "add".equals(args[0])) && (args.length < 2 || !PROPS.contains(args[1]))) {
            BMLog.w("mpv: the page asked to change '" + (args.length > 1 ? args[1] : "") + "', which is not allowed");
            return;
        }
        MPVLib.command(args);
    }

    /** Subtitles the page has (a file chosen, or one beside the video): handed to mpv as a file. */
    void addSubtitles(String name, String text) {
        if (!mine() || text == null || text.length() == 0) return;
        String n = name == null ? "" : name;
        String ext = n.lastIndexOf('.') >= 0 ? n.substring(n.lastIndexOf('.') + 1).toLowerCase(Locale.US) : "";
        if (!ext.matches("srt|vtt|ass|ssa|sub|txt")) ext = "srt";
        try {
            File dir = new File(app.getCacheDir(), "subs");
            if (subs == 0) { File[] old = dir.listFiles(); if (old != null) for (File f : old) f.delete(); }
            if (!dir.isDirectory() && !dir.mkdirs()) throw new java.io.IOException("no folder for subtitles");
            File f = new File(dir, "s" + (++subs) + "." + ext);
            FileOutputStream o = new FileOutputStream(f);
            try { o.write(text.getBytes("UTF-8")); } finally { o.close(); }
            MPVLib.command(new String[] { "sub-add", f.getAbsolutePath(), "select", plain(n).length() > 0 ? plain(n) : "Subtitles" });
        } catch (Exception e) { BMLog.w("mpv subtitles: " + e); }
    }

    // ── starting mpv ─────────────────────────────────────────────────
    private boolean ensure() {
        if (created) {
            if (owner != this) { owner = this; MPVLib.setListener(this); }
            return true;
        }
        if (broken) return false;
        if (!MPVLib.load()) { BMLog.e("mpv's libraries could not be loaded: " + MPVLib.loadError()); return false; }
        File conf = new File(app.getFilesDir(), "mpv"), cache = new File(app.getCacheDir(), "mpv");
        conf.mkdirs();
        cache.mkdirs();
        fontsConf(new File(conf, "fonts.conf"));
        long t0 = SystemClock.uptimeMillis();
        prefs.edit().putBoolean("mpv_starting", true).commit();
        owner = this;
        MPVLib.setListener(this);
        try {
            MPVLib.create(app);
        } catch (Throwable t) {
            broken = true;
            BMLog.e("mpv could not be made: " + t);
            prefs.edit().putBoolean("mpv_starting", false).apply();
            return false;
        }
        // mpv exists from here: whatever happens, create() is not called again in this run.
        try {
            // A folder of its own for settings (only fonts.conf, which tells
            // libass where Android keeps its fonts) and one for its caches.
            MPVLib.setOptionString("config", "yes");
            MPVLib.setOptionString("config-dir", conf.getPath());
            MPVLib.setOptionString("gpu-shader-cache-dir", cache.getPath());
            MPVLib.setOptionString("icc-cache-dir", cache.getPath());
            MPVLib.setOptionString("msg-level", "all=warn");
            // mpv-android's choices for a phone.
            MPVLib.setOptionString("profile", "fast");
            MPVLib.setOptionString("vo", "gpu");
            MPVLib.setOptionString("gpu-context", "android");
            MPVLib.setOptionString("opengl-es", "yes");
            MPVLib.setOptionString("hwdec", "mediacodec,mediacodec-copy");
            MPVLib.setOptionString("hwdec-codecs", "h264,hevc,mpeg4,mpeg2video,vp8,vp9,av1");
            MPVLib.setOptionString("ao", "audiotrack,opensles");
            MPVLib.setOptionString("audio-set-media-role", "yes");
            MPVLib.setOptionString("volume-max", "150");                 // the volume swipe's boost (v3.42.0)
            String cacheBytes = String.valueOf((Build.VERSION.SDK_INT >= 27 ? 64 : 32) * 1024 * 1024);
            MPVLib.setOptionString("demuxer-max-bytes", cacheBytes);
            MPVLib.setOptionString("demuxer-max-back-bytes", cacheBytes);
            float hz = refreshRate();
            if (hz > 1) MPVLib.setOptionString("display-fps-override", String.valueOf(hz));
            // BM Player's own: the last picture stays at the end (as a video
            // element does), subtitle files beside the film are found, and
            // subtitles in the phone's language are chosen, unless the film
            // is already in that language.
            MPVLib.setOptionString("keep-open", "yes");
            MPVLib.setOptionString("sub-auto", "fuzzy");
            MPVLib.setOptionString("slang", languages());
            MPVLib.setOptionString("subs-with-matching-audio", "no");
            MPVLib.setOptionString("sub-font", "sans-serif");
            MPVLib.init();
            MPVLib.setOptionString("save-position-on-quit", "no");
            MPVLib.setOptionString("force-window", "no");
            MPVLib.setOptionString("idle", "yes");
            MPVLib.observeProperty("time-pos", MPVLib.FORMAT_DOUBLE);
            MPVLib.observeProperty("duration", MPVLib.FORMAT_DOUBLE);
            MPVLib.observeProperty("pause", MPVLib.FORMAT_FLAG);
            MPVLib.observeProperty("paused-for-cache", MPVLib.FORMAT_FLAG);
            MPVLib.observeProperty("seeking", MPVLib.FORMAT_FLAG);
            MPVLib.observeProperty("eof-reached", MPVLib.FORMAT_FLAG);
            MPVLib.observeProperty("speed", MPVLib.FORMAT_DOUBLE);
            MPVLib.observeProperty("track-list", MPVLib.FORMAT_NONE);
            MPVLib.observeProperty("sid", MPVLib.FORMAT_STRING);
            MPVLib.observeProperty("aid", MPVLib.FORMAT_STRING);
            MPVLib.observeProperty("hwdec-current", MPVLib.FORMAT_STRING);
            created = true;
            versions = MPVLib.getPropertyString("mpv-version") + ", FFmpeg " + MPVLib.getPropertyString("ffmpeg-version");
            BMLog.i("mpv started in " + (SystemClock.uptimeMillis() - t0) + " ms: " + versions + " (mpv-android " + RELEASE + ")");
        } catch (Throwable t) {
            broken = true;
            BMLog.e("mpv could not be started: " + t);
        } finally {
            prefs.edit().putBoolean("mpv_starting", false).apply();
        }
        return created;
    }

    @SuppressWarnings("deprecation")
    private float refreshRate() {
        try {
            Display d = a.getWindowManager().getDefaultDisplay();
            return d.getMode().getRefreshRate();
        } catch (Throwable t) { return 0; }
    }

    /** The phone's language, as subtitle languages are written in films (en,eng). */
    private static String languages() {
        Locale l = Locale.getDefault();
        String two = l.getLanguage();
        // Java's old names for three languages.
        if ("in".equals(two)) two = "id"; else if ("iw".equals(two)) two = "he"; else if ("ji".equals(two)) two = "yi";
        String three = "";
        try { three = l.getISO3Language(); } catch (Exception ignored) { }
        if (two.length() == 0) return "en,eng";
        return three.length() > 0 && !three.equals(two) ? two + "," + three : two;
    }

    /**
     * Where libass finds fonts for subtitles: Android's own. The same as
     * mpv-android writes (Utils.writeFontsConf, MIT licence).
     */
    private void fontsConf(File f) {
        String s = "<fontconfig>\n<dir>/system/fonts/</dir>\n<dir>/product/fonts/</dir>\n"
                + "<cachedir>" + app.getCacheDir().getPath() + "</cachedir>\n"
                + "<alias><family>serif</family><prefer><family>Noto Serif</family></prefer></alias>\n"
                + "<alias><family>sans-serif</family><prefer><family>Roboto</family><family>Noto Sans</family></prefer></alias>\n"
                + "<alias><family>monospace</family><prefer><family>Droid Sans Mono</family></prefer></alias>\n"
                + "</fontconfig>\n";
        try {
            FileOutputStream o = new FileOutputStream(f);
            try { o.write(s.getBytes("UTF-8")); } finally { o.close(); }
        } catch (Exception e) { BMLog.w("mpv fonts.conf: " + e); }
    }

    /** At the window's end. mpv goes too, and a new window makes it again. */
    void destroy() {
        close();
        if (view != null) view.getHolder().removeCallback(this);
        surface = false;
        if (!mine()) return;
        created = false;
        owner = null;
        voOff = false;
        active = loaded = stopping = false;
        MPVLib.setListener(null);
        try { MPVLib.destroy(); } catch (Throwable t) { BMLog.w("mpv destroy: " + t); }
    }

    // ── the picture ──────────────────────────────────────────────────
    private void show(boolean on) {
        shown = on;
        if (view == null) {
            view = new SurfaceView(a);
            view.getHolder().addCallback(this);
            view.setVisibility(View.GONE);
            a.root.addView(view, 0, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        }
        a.videoBehind(on);
        view.setVisibility(on ? View.VISIBLE : View.GONE);
    }

    /** The surface mpv draws on, so the window can keep the page above it. */
    View surfaceView() { return view; }

    @Override
    public void surfaceCreated(SurfaceHolder h) {
        if (!mine()) return;
        MPVLib.attachSurface(h.getSurface());
        // mpv draws into the surface even when there is nothing to show yet (black).
        MPVLib.setOptionString("force-window", "yes");
        surface = true;
        if (voOff) { MPVLib.setPropertyString("vo", "gpu"); voOff = false; }
        if (pending != null) loadPending();
    }

    @Override
    public void surfaceChanged(SurfaceHolder h, int format, int w, int hh) {
        if (!mine() || !surface) return;
        MPVLib.setPropertyString("android-surface-size", w + "x" + hh);
    }

    @Override
    public void surfaceDestroyed(SurfaceHolder h) {
        if (!mine() || !surface) return;
        surface = false;
        MPVLib.setPropertyString("vo", "null");
        voOff = true;
        MPVLib.setPropertyString("force-window", "no");
        MPVLib.detachSurface();
    }

    private void loadPending() {
        String file = pending;
        pending = null;
        if (file == null) return;
        if (active) stopping = true;
        MPVLib.setPropertyBoolean("pause", pendingPaused);
        // pause may not change (and so not be reported): the sound is asked for here too.
        paused = pendingPaused;
        if (!paused) { focus(true); listenNoisy(true); }
        if (pendingStart > 0.5) MPVLib.command(new String[] { "loadfile", file, "replace", "-1", String.format(Locale.US, "start=%.3f", pendingStart) });
        else MPVLib.command(new String[] { "loadfile", file, "replace" });
        BMLog.i("mpv: opening " + (file.startsWith("content://") ? file : "…" + file.substring(Math.max(0, file.lastIndexOf('/')))));
    }

    // ── files ────────────────────────────────────────────────────────
    /** The page's address for a file as Android's (content://), or null. */
    Uri uriOf(String src) {
        if (src == null) return null;
        try {
            if (src.startsWith("/media/video/")) return ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, Long.parseLong(src.substring(13)));
            if (src.startsWith("/media/audio/")) return ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, Long.parseLong(src.substring(13)));
            if (src.startsWith("/opened/")) return a.server.uri(Integer.parseInt(src.substring(8)));
        } catch (NumberFormatException ignored) { }
        return null;
    }

    /**
     * What mpv opens for a file: its real path when the app can read it
     * there (mpv reads that directly, as fast as it gets), else the
     * content:// address, which FFmpeg opens through Android. As
     * mpv-android does (translateContentUri). Null when Android will not
     * give the file at all.
     */
    private String readable(Uri u) {
        ParcelFileDescriptor pfd = null;
        try {
            pfd = app.getContentResolver().openFileDescriptor(u, "r");
            if (pfd == null) return null;
            String path = new File("/proc/self/fd/" + pfd.getFd()).getCanonicalPath();
            // The path goes to mpv in Java's own form of UTF-8, which only
            // matches real UTF-8 for names without emoji and the like.
            if (!path.startsWith("/proc") && plain(path).equals(path)) {
                File f = new File(path);
                if (f.canRead()) {
                    FileInputStream in = new FileInputStream(f);
                    try { in.read(); } finally { in.close(); }
                    return path;
                }
            }
        } catch (FileNotFoundException e) {
            BMLog.w("mpv: " + u + " not found: " + e.getMessage());
            return null;
        } catch (SecurityException e) {
            BMLog.w("mpv: " + u + " not allowed: " + e.getMessage());
            return null;
        } catch (Exception ignored) {
            // No real path: the content:// address does.
        } finally {
            if (pfd != null) { try { pfd.close(); } catch (Exception ignored) { } }
        }
        return u.toString();
    }

    /** Text without characters outside Unicode's first plane (emoji), which JNI would pass on wrongly. */
    private static String plain(String s) {
        StringBuilder b = null;
        for (int i = 0; i < s.length(); i++) {
            if (Character.isSurrogate(s.charAt(i))) {
                if (b == null) b = new StringBuilder(s.substring(0, i));
                continue;
            }
            if (b != null) b.append(s.charAt(i));
        }
        return b == null ? s : b.toString();
    }

    // ── from mpv ─────────────────────────────────────────────────────
    // These three run on mpv's thread: nothing here calls into mpv, and
    // what the page needs is posted to the main thread.
    @Override
    public void property(final String name, final Object value) {
        if ("time-pos".equals(name)) {
            long now = SystemClock.uptimeMillis();
            if (!timeNow && now - timeAt < 250) return;            // four times a second is plenty
            timeNow = false;
            timeAt = now;
        }
        a.ui.post(new Runnable() { public void run() { onProperty(name, value); } });
    }

    @Override
    public void event(final int id) {
        if (id == EV_PLAYBACK_RESTART) timeNow = true;
        a.ui.post(new Runnable() { public void run() { onEvent(id); } });
    }

    @Override
    public void log(String prefix, int level, String text) {
        if (level > LOG_WARN || text == null) return;
        String line = "[" + prefix + "] " + text.trim();
        synchronized (errors) {
            errors.addLast(line);
            while (errors.size() > 6) errors.removeFirst();
            if (logged++ >= 40) return;                            // a broken file can say the same thing a thousand times
        }
        BMLog.w("mpv " + line);
    }

    private void onProperty(String name, Object v) {
        if (!mine()) return;
        if ("time-pos".equals(name)) send("time", "t", v);
        else if ("duration".equals(name)) send("duration", "d", v);
        else if ("pause".equals(name)) {
            paused = Boolean.TRUE.equals(v);
            send("pause", "v", paused);
            if (shown && !paused) { focus(true); listenNoisy(true); }
            else listenNoisy(false);
        }
        else if ("paused-for-cache".equals(name)) send("buffering", "v", Boolean.TRUE.equals(v));
        else if ("seeking".equals(name)) send("seeking", "v", Boolean.TRUE.equals(v));
        else if ("eof-reached".equals(name)) send("eof", "v", Boolean.TRUE.equals(v));
        else if ("speed".equals(name)) send("speed", "v", v);
        else if ("track-list".equals(name) || "sid".equals(name) || "aid".equals(name)) {
            if (active) send("tracks", "list", tracks());
        }
        else if ("hwdec-current".equals(name)) {
            if (v != null && active) BMLog.i("mpv decodes with " + ("no".equals(v) ? "its own decoder (software)" : v + " (the phone's hardware)"));
            send("hwdec", "v", v);
        }
    }

    private void onEvent(int id) {
        if (id == EV_SHUTDOWN) { stopped(); return; }
        if (!mine()) return;
        if (id == EV_START_FILE) {
            active = true;
            loaded = false;
            synchronized (errors) { errors.clear(); logged = 0; }
            send("start", null, null);
        } else if (id == EV_FILE_LOADED) {
            loaded = true;
            loadedInfo();
        } else if (id == EV_PLAYBACK_RESTART) {
            prefs.edit().remove("mpv_opening").apply();            // it shows: no longer a risk
            send("restart", null, null);
        } else if (id == EV_VIDEO_RECONFIG) {
            videoInfo();
        } else if (id == EV_END_FILE) {
            boolean wasLoaded = loaded, asked = stopping;
            active = false;
            loaded = false;
            stopping = false;
            prefs.edit().remove("mpv_opening").apply();
            if (asked) return;                                     // ours: closed, or the next file
            if (!wasLoaded) error("mpv could not open this file.");
            else send("end", "text", lastErrors());
        }
    }

    /** mpv ended by itself, which it should not: it is made again for the next video. */
    private void stopped() {
        if (!mine()) return;
        BMLog.e("mpv stopped by itself: " + lastErrors());
        boolean wasShown = shown;
        created = false;
        owner = null;
        surface = false;
        voOff = false;
        active = loaded = stopping = false;
        MPVLib.setListener(null);
        try { MPVLib.destroy(); } catch (Throwable t) { BMLog.w("mpv destroy: " + t); }
        // The surface goes too: the next mpv attaches to a fresh one when the view shows again.
        if (view != null) view.setVisibility(View.GONE);
        if (wasShown) error("mpv stopped.");
    }

    private void loadedInfo() {
        try {
            JSONObject o = new JSONObject();
            o.put("e", "loaded");
            Double d = MPVLib.getPropertyDouble("duration");
            if (d != null && !d.isNaN() && !d.isInfinite()) o.put("d", d);
            // The size the file gives, as the picture is not decoded yet (video-params come with VIDEO_RECONFIG).
            Integer w = MPVLib.getPropertyInt("current-tracks/video/demux-w"), h = MPVLib.getPropertyInt("current-tracks/video/demux-h"),
                    r = MPVLib.getPropertyInt("current-tracks/video/demux-rotation");
            if (w != null) o.put("w", w);
            if (h != null) o.put("h", h);
            if (r != null) o.put("rotate", r);
            String format = MPVLib.getPropertyString("file-format"), video = MPVLib.getPropertyString("video-format"),
                    audio = MPVLib.getPropertyString("audio-codec-name");
            o.put("format", format);
            o.put("video", video);
            o.put("audio", audio);
            o.put("tracks", tracks());
            a.emit("mpv", o);
            BMLog.i("mpv: playing " + format + ", video " + video + (w != null && h != null ? " " + w + "×" + h : "") + ", audio " + audio);
        } catch (Exception e) { BMLog.w("mpv loaded: " + e); }
    }

    private void videoInfo() {
        try {
            JSONObject o = new JSONObject();
            o.put("e", "video");
            Integer w = MPVLib.getPropertyInt("video-params/dw"), h = MPVLib.getPropertyInt("video-params/dh"),
                    r = MPVLib.getPropertyInt("video-params/rotate");
            if (w == null || h == null) return;
            o.put("w", w);
            o.put("h", h);
            o.put("rotate", r == null ? 0 : r);
            a.emit("mpv", o);
        } catch (Exception e) { BMLog.w("mpv video: " + e); }
    }

    /** The file's tracks (video, audio, subtitles): mpv's track-list, which it gives as JSON. */
    private JSONArray tracks() {
        String s = MPVLib.getPropertyString("track-list");
        if (s != null) { try { return new JSONArray(s); } catch (JSONException ignored) { } }
        JSONArray out = new JSONArray();
        Integer n = MPVLib.getPropertyInt("track-list/count");
        for (int i = 0; n != null && i < n && i < 100; i++) {
            try {
                String p = "track-list/" + i + "/";
                JSONObject t = new JSONObject();
                t.put("id", MPVLib.getPropertyInt(p + "id"));
                t.put("type", MPVLib.getPropertyString(p + "type"));
                t.put("title", MPVLib.getPropertyString(p + "title"));
                t.put("lang", MPVLib.getPropertyString(p + "lang"));
                t.put("codec", MPVLib.getPropertyString(p + "codec"));
                t.put("selected", Boolean.TRUE.equals(MPVLib.getPropertyBoolean(p + "selected")));
                t.put("external", Boolean.TRUE.equals(MPVLib.getPropertyBoolean(p + "external")));
                out.put(t);
            } catch (JSONException ignored) { }
        }
        return out;
    }

    private String lastErrors() {
        StringBuilder b = new StringBuilder();
        synchronized (errors) { for (String l : errors) b.append(b.length() > 0 ? "\n" : "").append(l); }
        return b.toString();
    }

    private void error(String what) {
        BMLog.w("mpv: " + what + (lastErrors().length() > 0 ? " " + lastErrors().replace('\n', ' ') : ""));
        try {
            JSONObject o = new JSONObject();
            o.put("e", "error");
            o.put("text", what);
            o.put("detail", lastErrors());
            a.emit("mpv", o);
        } catch (JSONException ignored) { }
    }

    private void send(String e, String key, Object value) {
        try {
            JSONObject o = new JSONObject();
            o.put("e", e);
            if (key != null) o.put(key, value == null ? JSONObject.NULL : value);
            a.emit("mpv", o);
        } catch (JSONException ignored) { }                        // NaN, which JSON cannot carry
    }

    // ── sound ────────────────────────────────────────────────────────
    // The WebView asks Android for the sound when the page plays music; mpv
    // plays outside it, so this asks for it while a video plays: other apps
    // pause, and a call pauses the video.
    private void focus(boolean want) {
        AudioManager am = (AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
        if (am == null || want == focus) return;
        if (want) {
            int r;
            if (Build.VERSION.SDK_INT >= 26) {
                if (focusReq == null) {
                    focusReq = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                                    .setContentType(AudioAttributes.CONTENT_TYPE_MOVIE).build())
                            .setOnAudioFocusChangeListener(this, a.ui)
                            .build();
                }
                r = am.requestAudioFocus((AudioFocusRequest) focusReq);
            } else {
                r = requestOld(am);
            }
            focus = r == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        } else {
            if (Build.VERSION.SDK_INT >= 26) { if (focusReq != null) am.abandonAudioFocusRequest((AudioFocusRequest) focusReq); }
            else abandonOld(am);
            focus = false;
            if (ducked) duck(false);
        }
    }

    @SuppressWarnings("deprecation")
    private int requestOld(AudioManager am) { return am.requestAudioFocus(this, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN); }

    @SuppressWarnings("deprecation")
    private void abandonOld(AudioManager am) { am.abandonAudioFocus(this); }

    @Override
    public void onAudioFocusChange(int change) {
        if (!mine() || !shown) return;
        if (change == AudioManager.AUDIOFOCUS_LOSS) {
            focus = false;
            resumeOnGain = false;
            MPVLib.setPropertyBoolean("pause", true);
        } else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
            resumeOnGain = !paused;
            MPVLib.setPropertyBoolean("pause", true);
        } else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
            // Android 8 and later lower the sound by themselves.
            if (Build.VERSION.SDK_INT < 26) duck(true);
        } else if (change == AudioManager.AUDIOFOCUS_GAIN) {
            if (ducked) duck(false);
            if (resumeOnGain) { resumeOnGain = false; MPVLib.setPropertyBoolean("pause", false); }
        }
    }

    private void duck(boolean on) {
        ducked = on;
        if (mine()) MPVLib.command(new String[] { "multiply", "volume", on ? "0.5" : "2" });
    }

    /** Headphones pulled out: the video pauses, as the music does. */
    private void listenNoisy(boolean on) {
        if (on == noisyOn) return;
        if (noisy == null) {
            noisy = new BroadcastReceiver() {
                @Override
                public void onReceive(Context c, Intent i) {
                    if (mine() && shown && AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(i.getAction())) {
                        BMLog.i("headphones disconnected: the video pauses");
                        MPVLib.setPropertyBoolean("pause", true);
                    }
                }
            };
        }
        try {
            if (on) Compat.register(app, noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
            else app.unregisterReceiver(noisy);
            noisyOn = on;
        } catch (Exception e) { BMLog.w("mpv headphones receiver: " + e); }
    }
}
