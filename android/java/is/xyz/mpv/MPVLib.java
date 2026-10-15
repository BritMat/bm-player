package is.xyz.mpv;

import android.content.Context;
import android.graphics.Bitmap;
import android.view.Surface;

/**
 * mpv, the engine the desktop BM Player plays with, on Android (v3.41.0).
 *
 * The native libraries (libmpv, FFmpeg, and libplayer, the glue between them
 * and Java) are mpv-android's own release builds, copied into the APK
 * unchanged by android/build-apk.mjs. That glue looks for this class by its
 * name, is.xyz.mpv.MPVLib, so the name and every method below must stay
 * exactly as they are: the natives are its 17 functions, and the static
 * methods after them are what its event thread calls back. Their names and
 * signatures were checked against libplayer.so's own table and mpv-android's
 * source (app/src/main/jni, release 2026-09-17).
 *
 * The glue ends the process on misuse (calling anything before create(), or
 * create() twice), so only MpvPlayer calls these, and it keeps to that order.
 */
public final class MPVLib {
    private MPVLib() { }

    /** What the event thread reports, handed on by MpvPlayer. */
    public interface Listener {
        void property(String name, Object value);
        void event(int id);
        void log(String prefix, int level, String text);
    }

    private static volatile Listener listener;
    private static boolean loaded;
    private static Throwable loadError;

    public static void setListener(Listener l) { listener = l; }

    /**
     * Loads the libraries, once. False on a phone they were not built for (an
     * x86 one) or when they are missing; loadError() then says why.
     */
    public static synchronized boolean load() {
        if (loaded) return true;
        if (loadError != null) return false;
        try {
            System.loadLibrary("mpv");
            System.loadLibrary("player");
            loaded = true;
        } catch (Throwable t) {
            loadError = t;
        }
        return loaded;
    }

    public static synchronized Throwable loadError() { return loadError; }

    // The glue's functions (Java_is_xyz_mpv_MPVLib_*).
    public static native void create(Context appctx);
    public static native void init();
    public static native void destroy();
    public static native void attachSurface(Surface surface);
    public static native void detachSurface();
    public static native void command(String[] cmd);
    public static native int setOptionString(String name, String value);
    public static native Bitmap grabThumbnail(int dimension);
    public static native Integer getPropertyInt(String property);
    public static native void setPropertyInt(String property, int value);
    public static native Double getPropertyDouble(String property);
    public static native void setPropertyDouble(String property, double value);
    public static native Boolean getPropertyBoolean(String property);
    public static native void setPropertyBoolean(String property, boolean value);
    public static native String getPropertyString(String property);
    public static native void setPropertyString(String property, String value);
    public static native void observeProperty(String property, int format);

    // mpv_format, for observeProperty.
    public static final int FORMAT_NONE = 0, FORMAT_STRING = 1, FORMAT_FLAG = 3, FORMAT_INT64 = 4, FORMAT_DOUBLE = 5;

    // Called by the glue's event thread. A Java exception left pending there
    // would end the app, so nothing here may throw.
    public static void eventProperty(String property) { fire(property, null); }
    public static void eventProperty(String property, boolean value) { fire(property, value); }
    public static void eventProperty(String property, long value) { fire(property, value); }
    public static void eventProperty(String property, double value) { fire(property, value); }
    public static void eventProperty(String property, String value) { fire(property, value); }

    public static void event(int eventId) {
        try { Listener l = listener; if (l != null) l.event(eventId); } catch (Throwable ignored) { }
    }

    public static void logMessage(String prefix, int level, String text) {
        try { Listener l = listener; if (l != null) l.log(prefix, level, text); } catch (Throwable ignored) { }
    }

    private static void fire(String property, Object value) {
        try { Listener l = listener; if (l != null) l.property(property, value); } catch (Throwable ignored) { }
    }
}
