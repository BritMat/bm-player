package io.github.britmat.bmplayer;

import android.content.Context;

import java.io.File;
import java.io.FileOutputStream;
import java.io.RandomAccessFile;
import java.text.SimpleDateFormat;
import java.util.ArrayDeque;
import java.util.Date;
import java.util.Locale;

/**
 * The app's own log: the last few hundred lines in memory, and a file
 * (log.txt in the app's own folder) that outlives a crash. The About page in
 * Settings shows it and can share it, which is how a fault on a phone gets
 * reported: there is no computer attached to read Android's own log.
 */
final class BMLog {
    private static final int KEEP = 600;
    private static final long FILE_MAX = 256 * 1024;
    private static final ArrayDeque<String> lines = new ArrayDeque<String>();
    private static final SimpleDateFormat time = new SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.US);
    private static File file;
    private static boolean started;

    private BMLog() { }

    static synchronized void init(Context c) {
        if (started) return;
        started = true;
        file = new File(c.getFilesDir(), "log.txt");
        // The last run's end first, so a crash can be read after it.
        try {
            if (file.exists()) {
                String old = tail(file, 48 * 1024);
                for (String l : old.split("\n")) if (l.length() > 0) keep(l);
                if (file.length() > FILE_MAX) {
                    FileOutputStream o = new FileOutputStream(file, false);
                    try { o.write(old.getBytes("UTF-8")); } finally { o.close(); }
                }
            }
        } catch (Exception ignored) { }
        final Thread.UncaughtExceptionHandler before = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            public void uncaughtException(Thread t, Throwable e) {
                try { e("crash in " + t.getName() + ": " + android.util.Log.getStackTraceString(e)); } catch (Throwable ignored) { }
                if (before != null) before.uncaughtException(t, e);
            }
        });
    }

    static void i(String s) { put('I', s); }
    static void w(String s) { put('W', s); }
    static void e(String s) { put('E', s); }

    private static synchronized void put(char level, String s) {
        int prio = level == 'E' ? android.util.Log.ERROR : level == 'W' ? android.util.Log.WARN : android.util.Log.INFO;
        android.util.Log.println(prio, "BMPlayer", s);
        String line = time.format(new Date()) + " " + level + " " + s;
        keep(line);
        if (file == null) return;
        try {
            FileOutputStream o = new FileOutputStream(file, true);
            try { o.write((line + "\n").getBytes("UTF-8")); } finally { o.close(); }
        } catch (Exception ignored) { }
    }

    private static void keep(String line) {
        lines.addLast(line);
        while (lines.size() > KEEP) lines.removeFirst();
    }

    /** Everything kept, oldest first. */
    static synchronized String text() {
        StringBuilder b = new StringBuilder(lines.size() * 80);
        for (String l : lines) b.append(l).append('\n');
        return b.toString();
    }

    private static String tail(File f, int max) throws Exception {
        RandomAccessFile r = new RandomAccessFile(f, "r");
        try {
            long len = r.length(), from = Math.max(0, len - max);
            byte[] b = new byte[(int) (len - from)];
            r.seek(from);
            r.readFully(b);
            String s = new String(b, "UTF-8");
            // Started in the middle of a line: that part line is dropped.
            if (from > 0) { int nl = s.indexOf('\n'); if (nl >= 0) s = s.substring(nl + 1); }
            return s;
        } finally { r.close(); }
    }
}
