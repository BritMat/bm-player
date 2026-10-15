package io.github.britmat.bmplayer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.Icon;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;

import org.json.JSONObject;

/**
 * Keeps the music going while BM Player is behind other apps or the screen
 * is off, and gives it Android's media controls: the notification, the lock
 * screen, headphone and Bluetooth buttons (a MediaSession).
 *
 * The music itself plays in the page (an audio element, so the visualiser
 * can hear it). The page says what is playing (Bridge.playback, update()),
 * and a press on a control is sent back to it as a 'remote' event. While
 * something plays this is a foreground service, which is what lets Android
 * keep the app running, and it holds a partial wake lock so the next song
 * can start with the screen off. Paused, it stays for ten minutes and then
 * takes its notification away.
 *
 * It does not ask for audio focus: the WebView does that itself when the
 * page plays, and pauses the page when another app takes the sound (a
 * call). Asking here as well would make the WebView lose it at once.
 * Headphones being pulled out is handled here (the WebView does not).
 */
public class PlaybackService extends Service {
    private static final String CHANNEL = "playback";
    private static final int NOTE = 7;
    private static final String FG = "fg";
    private static final long IDLE_STOP = 10 * 60 * 1000L;
    static volatile PlaybackService instance;

    // What the page said last. Only touched on the main thread.
    private static boolean has, playing;
    private static String title = "", artist = "", album = "";
    private static long duration, position, at;
    private static float speed = 1f;
    private static long artId = -1, albumId = -1;

    private MediaSession session;
    private PowerManager.WakeLock wake;
    private BroadcastReceiver noisy;
    private boolean noisyOn, foreground;
    private Bitmap art;
    private String artFor = "";
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable idle = new Runnable() {
        public void run() {
            if (!playing) { BMLog.i("paused for ten minutes: the playback notification goes"); finish(); }
        }
    };

    /** On the main thread, with what the page says is playing (JSON). */
    static void update(Context c, String json) {
        try {
            JSONObject o = new JSONObject(json);
            has = o.optBoolean("has", false);
            playing = has && o.optBoolean("playing", false);
            title = o.optString("title", "");
            artist = o.optString("artist", "");
            album = o.optString("album", "");
            duration = Math.max(0, Math.round(o.optDouble("duration", 0) * 1000));
            position = Math.max(0, Math.round(o.optDouble("position", 0) * 1000));
            speed = (float) o.optDouble("speed", 1);
            artId = o.optLong("artId", -1);
            albumId = o.optLong("albumId", -1);
            at = SystemClock.elapsedRealtime();
        } catch (Exception e) {
            BMLog.w("playback: " + e);
            return;
        }
        PlaybackService s = instance;
        if (!has) { if (s != null) s.finish(); return; }
        if (s != null) { s.apply(false); return; }
        if (!playing) return;                               // nothing to show until something plays
        Intent i = new Intent(c, PlaybackService.class).putExtra(FG, true);
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
            else c.startService(i);
        } catch (Exception e) {
            BMLog.w("the playback service could not start: " + e);
        }
    }

    /** The music has stopped for good (the page is gone or closed). */
    static void stopAll() {
        has = false;
        playing = false;
        PlaybackService s = instance;
        if (s != null) s.finish();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onCreate() {
        super.onCreate();
        instance = this;
        channel();
        session = new MediaSession(this, "BM Player");
        session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { remote("play", null); }
            @Override public void onPause() { remote("pause", null); }
            @Override public void onStop() { remote("pause", null); }
            @Override public void onSkipToNext() { remote("next", null); }
            @Override public void onSkipToPrevious() { remote("prev", null); }
            @Override public void onSeekTo(long ms) { remote("seek", ms / 1000.0); }
            @Override public void onFastForward() { remote("seekBy", 10); }
            @Override public void onRewind() { remote("seekBy", -10); }
        });
        session.setSessionActivity(openApp());
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "bmplayer:playback");
        wake.setReferenceCounted(false);
        noisy = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent i) {
                if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(i.getAction())) {
                    BMLog.i("headphones disconnected: pause");
                    remote("pause", null);
                }
            }
        };
    }

    @Override
    public int onStartCommand(Intent i, int flags, int startId) {
        instance = this;                                    // a stop that had begun is called off
        String act = i == null ? null : i.getAction();
        boolean fg = i != null && i.getBooleanExtra(FG, false);
        if ("close".equals(act)) {
            // v3.43.0: the page puts the music away too (the bar in the app
            // went on showing a song closed here). Only paused before.
            remote("close", null);
            if (fg) goForeground(note());
            finish();
            return START_NOT_STICKY;
        }
        if (act != null) remote(act, null);                 // a button in the notification
        if (!has) {
            // Started that way, Android wants a notification first, even when there is nothing left to show.
            if (fg) goForeground(note());
            finish();
            return START_NOT_STICKY;
        }
        apply(fg);
        return START_NOT_STICKY;
    }

    private void apply(boolean mustForeground) {
        if (!has) { finish(); return; }
        loadArt();
        session.setMetadata(meta());
        session.setPlaybackState(state());
        if (!session.isActive()) session.setActive(true);
        Notification n = note();
        if (foreground) show(n);
        else if (playing || mustForeground) goForeground(n);
        else show(n);
        h.removeCallbacks(idle);
        if (playing) {
            wake.acquire(4 * 3600 * 1000L);
            listenNoisy(true);
        } else {
            if (wake.isHeld()) wake.release();
            listenNoisy(false);
            h.postDelayed(idle, IDLE_STOP);
        }
    }

    private void goForeground(Notification n) {
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTE, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            else startForeground(NOTE, n);
            foreground = true;
        } catch (Exception e) {
            BMLog.w("the playback notification could not be put in front: " + e);
            show(n);
        }
    }

    private void show(Notification n) {
        try { ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(NOTE, n); }
        catch (Exception e) { BMLog.w("notification: " + e); }
    }

    private MediaMetadata meta() {
        MediaMetadata.Builder m = new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
                .putString(MediaMetadata.METADATA_KEY_ALBUM, album)
                .putLong(MediaMetadata.METADATA_KEY_DURATION, duration);
        if (art != null) m.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, art);
        return m.build();
    }

    private PlaybackState state() {
        long actions = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_STOP
                | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SEEK_TO
                | PlaybackState.ACTION_FAST_FORWARD | PlaybackState.ACTION_REWIND;
        return new PlaybackState.Builder()
                .setActions(actions)
                .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, position, playing ? speed : 0f, at)
                .build();
    }

    @SuppressWarnings("deprecation")
    private Notification note() {
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        b.setSmallIcon(R.drawable.ic_stat_bm)
                .setContentTitle(title.length() == 0 ? "BM Player" : title)
                .setContentText(artist.length() == 0 ? album : artist)
                .setContentIntent(openApp())
                .setDeleteIntent(action("close", 4))
                .setShowWhen(false)
                .setOnlyAlertOnce(true)
                .setOngoing(playing)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setCategory(Notification.CATEGORY_TRANSPORT);
        if (art != null) b.setLargeIcon(art);
        b.addAction(button(R.drawable.ic_n_prev, "Previous", "prev", 1));
        b.addAction(playing ? button(R.drawable.ic_n_pause, "Pause", "pause", 2) : button(R.drawable.ic_n_play, "Play", "play", 2));
        b.addAction(button(R.drawable.ic_n_next, "Next", "next", 3));
        b.addAction(button(R.drawable.ic_n_close, "Close", "close", 4));
        b.setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0, 1, 2));
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_LOW);
        if (Build.VERSION.SDK_INT >= 31) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        return b.build();
    }

    private Notification.Action button(int icon, String label, String act, int code) {
        return new Notification.Action.Builder(Icon.createWithResource(this, icon), label, action(act, code)).build();
    }

    private PendingIntent action(String act, int code) {
        Intent i = new Intent(this, PlaybackService.class).setAction(act);
        return PendingIntent.getService(this, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private PendingIntent openApp() {
        Intent i = new Intent(this, MainActivity.class).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        return PendingIntent.getActivity(this, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** The song's picture for the notification and the lock screen, read away from the main thread. */
    private void loadArt() {
        final String key = artId + "/" + albumId;
        if (key.equals(artFor)) return;
        artFor = key;
        art = null;
        final long tid = artId, aid = albumId;
        final Context c = getApplicationContext();
        new Thread(new Runnable() {
            public void run() {
                Bitmap bm = null;
                try {
                    byte[] b = tid >= 0 ? Art.track(c, tid, 512) : aid >= 0 ? Art.album(c, aid, 512) : null;
                    if (b != null) bm = BitmapFactory.decodeByteArray(b, 0, b.length);
                } catch (Throwable ignored) { }
                final Bitmap got = bm;
                h.post(new Runnable() {
                    public void run() {
                        if (instance != PlaybackService.this || !key.equals(artFor) || got == null) return;
                        art = got;
                        if (has) apply(false);
                    }
                });
            }
        }, "bm-art").start();
    }

    private void remote(String action, Object value) {
        MainActivity a = MainActivity.current;
        if (a == null) { BMLog.w("'" + action + "' pressed with no page to tell"); return; }
        try {
            JSONObject o = new JSONObject();
            o.put("action", action);
            if (value != null) o.put("value", value);
            a.emit("remote", o);
        } catch (Exception ignored) { }
    }

    private void listenNoisy(boolean on) {
        if (on == noisyOn) return;
        try {
            if (on) Compat.register(this, noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
            else unregisterReceiver(noisy);
            noisyOn = on;
        } catch (Exception e) { BMLog.w("headphones receiver: " + e); }
    }

    private void channel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Playback", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("What is playing, with its controls");
        ch.setShowBadge(false);
        ch.setSound(null, null);
        ch.enableVibration(false);
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(ch);
    }

    void finish() {
        // From now on a song starting makes a new service rather than reusing this one, which is going.
        if (instance == this) instance = null;
        h.removeCallbacks(idle);
        if (wake != null && wake.isHeld()) wake.release();
        listenNoisy(false);
        try { stopForeground(Service.STOP_FOREGROUND_REMOVE); } catch (Exception ignored) { }
        foreground = false;
        try { ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).cancel(NOTE); } catch (Exception ignored) { }
        if (session != null) session.setActive(false);
        stopSelf();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Swiped away from the recent apps: the page goes with the app's window, so the music stops.
        BMLog.i("the app was swiped away: the music stops");
        finish();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        if (instance == this) instance = null;
        h.removeCallbacksAndMessages(null);
        if (wake != null && wake.isHeld()) wake.release();
        listenNoisy(false);
        if (session != null) { session.release(); session = null; }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
