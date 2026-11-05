package io.github.britmat.bmplayer;

import android.app.PendingIntent;
import android.app.PictureInPictureParams;
import android.app.RemoteAction;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.SystemClock;
import android.util.Rational;

import org.json.JSONObject;

import java.util.ArrayList;

/**
 * Picture-in-picture (v3.48.0, Android 8.0 and later): with a film playing,
 * Home (or the gesture for it) leaves it playing in a small window of its
 * own over other apps, with play and pause and a skip each way. The page
 * says when a film is open and playing, its size, and whether there are more
 * films around it (Bridge.pip); in the small window its controls hide, and
 * the window's buttons come to it as 'remote' events, as the notification's
 * do. Closing the small window pauses the film. mpv keeps drawing into its
 * surface, which only gets smaller.
 */
final class Pip {
    static final String ACTION = "io.github.britmat.bmplayer.PIP";
    private final MainActivity a;
    private boolean film, playing, list, on;
    private int w = 16, h = 9;
    private long endedAt, awayUntil;
    private BroadcastReceiver rx;

    Pip(MainActivity a) { this.a = a; }

    static boolean supported(Context c) {
        try { return Build.VERSION.SDK_INT >= 26 && c.getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE); }
        catch (Exception e) { return false; }
    }

    boolean on() { return on; }

    /** The page, while a film is open: { film, playing, w, h, list }. */
    void state(String json) {
        try {
            JSONObject o = new JSONObject(json);
            film = o.optBoolean("film");
            playing = o.optBoolean("playing");
            list = o.optBoolean("list");
            int nw = o.optInt("w"), nh = o.optInt("h");
            if (nw > 0 && nh > 0) { w = nw; h = nh; }
        } catch (Exception e) { BMLog.w("pip state: " + e); return; }
        if (!supported(a) || SystemClock.elapsedRealtime() < awayUntil) return;
        // Android 12 goes into the small window by itself on Home, smoothly: it is told while a film plays.
        try { if (Build.VERSION.SDK_INT >= 26 && (on || Build.VERSION.SDK_INT >= 31)) a.setPictureInPictureParams(params()); }
        catch (Exception e) { BMLog.w("pip params: " + e); }
    }

    /**
     * The app opens another app's screen itself (a share, Open with, a file
     * picker, Android's settings): Android takes that as leaving too, and the
     * film is not to shrink into a window for it. A few seconds, or until the
     * app is back (MainActivity.startActivityForResult, onResume).
     */
    void away() {
        awayUntil = SystemClock.elapsedRealtime() + 3000;
        if (Build.VERSION.SDK_INT >= 31 && supported(a)) {
            try { a.setPictureInPictureParams(new PictureInPictureParams.Builder().setAutoEnterEnabled(false).build()); } catch (Exception ignored) { }
        }
    }

    /** Back in front: as it was before away(). */
    void back() {
        if (awayUntil == 0) return;
        awayUntil = 0;
        if (Build.VERSION.SDK_INT >= 31 && supported(a)) {
            try { a.setPictureInPictureParams(params()); } catch (Exception ignored) { }
        }
    }

    /** Home pressed (MainActivity.onUserLeaveHint): into the small window, with a film playing. Before Android 12. */
    void leaving() {
        if (SystemClock.elapsedRealtime() < awayUntil) return;
        if (!film || !playing || !supported(a) || Build.VERSION.SDK_INT >= 31) return;
        try { a.enterPictureInPictureMode(params()); }
        catch (Exception e) { BMLog.w("pip: " + e); }
    }

    /** The small window opened or closed (MainActivity.onPictureInPictureModeChanged). */
    void changed(boolean now) {
        on = now;
        if (!now) endedAt = SystemClock.elapsedRealtime();
        BMLog.i(now ? "the film goes on in a small window" : "the small window closes");
        try { JSONObject o = new JSONObject(); o.put("on", now); a.emit("pip", o); } catch (Exception ignored) { }
    }

    /**
     * The app went out of sight (MainActivity.onStop). Just after the small
     * window closed, that was its close button or a swipe, not Expand: the
     * film pauses, as Android's own players do.
     */
    void stopped() {
        if (on || endedAt == 0 || SystemClock.elapsedRealtime() - endedAt > 1500) return;
        endedAt = 0;
        try { JSONObject o = new JSONObject(); o.put("on", false); o.put("closed", true); a.emit("pip", o); } catch (Exception ignored) { }
    }

    private PictureInPictureParams params() {
        PictureInPictureParams.Builder b = new PictureInPictureParams.Builder();
        // Android allows between 1:2.39 and 2.39:1
        float r = Math.max(1 / 2.39f, Math.min(2.39f, w / (float) Math.max(1, h)));
        b.setAspectRatio(r >= 1 ? new Rational(Math.round(r * 1000), 1000) : new Rational(1000, Math.round(1000 / r)));
        ArrayList<RemoteAction> acts = new ArrayList<RemoteAction>();
        if (list) acts.add(action("prev", android.R.drawable.ic_media_previous, "Previous video", 1));
        else acts.add(action("back10", android.R.drawable.ic_media_rew, "Back ten seconds", 1));
        acts.add(playing ? action("toggle", android.R.drawable.ic_media_pause, "Pause", 2) : action("toggle", android.R.drawable.ic_media_play, "Play", 2));
        if (list) acts.add(action("next", android.R.drawable.ic_media_next, "Next video", 3));
        else acts.add(action("fwd10", android.R.drawable.ic_media_ff, "Ten seconds on", 3));
        b.setActions(acts);
        if (Build.VERSION.SDK_INT >= 31) { b.setAutoEnterEnabled(film && playing); b.setSeamlessResizeEnabled(true); }
        return b.build();
    }

    private RemoteAction action(String what, int icon, String label, int code) {
        Intent i = new Intent(ACTION).setPackage(a.getPackageName()).putExtra("a", what);
        PendingIntent p = PendingIntent.getBroadcast(a, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new RemoteAction(Icon.createWithResource(a, icon), label, label, p);
    }

    /** The small window's buttons, to the page as the notification's are. */
    void listen() {
        if (rx != null || !supported(a)) return;
        rx = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent i) {
                String what = i.getStringExtra("a");
                if (what == null) return;
                try {
                    JSONObject o = new JSONObject();
                    if ("back10".equals(what) || "fwd10".equals(what)) { o.put("action", "seekBy"); o.put("value", "back10".equals(what) ? -10 : 10); }
                    else o.put("action", what);
                    a.emit("remote", o);
                } catch (Exception ignored) { }
            }
        };
        // Only from the app itself: the window's buttons are its own PendingIntents.
        if (Build.VERSION.SDK_INT >= 33) a.registerReceiver(rx, new IntentFilter(ACTION), 0x4 /* Context.RECEIVER_NOT_EXPORTED */);
        else a.registerReceiver(rx, new IntentFilter(ACTION));
    }

    void release() {
        if (rx == null) return;
        try { a.unregisterReceiver(rx); } catch (Exception ignored) { }
        rx = null;
    }
}
