package io.github.britmat.bmplayer;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Context;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.LruCache;
import android.util.Size;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.Semaphore;

/**
 * Album art, a song's own picture and pictures from videos, as JPEG bytes at
 * a given size. Android 10 and later make them (ContentResolver
 * loadThumbnail); before that the album art file, the picture inside the
 * song, and the video thumbnail Android keeps. Kept in memory and on disk
 * (the app's cache, which Android may empty), and a song with no picture is
 * remembered as such, so a long list scrolls without asking again.
 */
final class Art {
    private Art() { }

    private interface Maker { Bitmap make(Context c) throws Exception; }

    private static final LruCache<String, byte[]> mem = new LruCache<String, byte[]>(16 * 1024 * 1024) {
        @Override protected int sizeOf(String k, byte[] v) { return v.length; }
    };
    /**
     * Out of sight or short of memory (v3.44.0, MainActivity.onTrimMemory):
     * the pictures kept in memory go down to a few, or all go when Android is
     * short. They are on disk still, and the page keeps its own.
     */
    static void trim(int level) {
        if (level >= 60) mem.evictAll();
        else if (level >= 20) mem.trimToSize(4 * 1024 * 1024);
    }

    private static final Set<String> none = Collections.synchronizedSet(new HashSet<String>());
    private static final Semaphore busy = new Semaphore(3);           // a few at once, not one per row on screen
    private static volatile boolean trimmed;

    static byte[] album(Context c, final long albumId, final int size) {
        return get(c, "al" + albumId + "_" + size, new Maker() {
            public Bitmap make(Context c) throws Exception {
                ContentResolver cr = c.getContentResolver();
                if (Build.VERSION.SDK_INT >= 29)
                    return cr.loadThumbnail(ContentUris.withAppendedId(MediaStore.Audio.Albums.EXTERNAL_CONTENT_URI, albumId), new Size(size, size), null);
                InputStream in = cr.openInputStream(ContentUris.withAppendedId(Uri.parse("content://media/external/audio/albumart"), albumId));
                if (in == null) return null;
                return decode(LocalServer.readAll(in, 16 * 1024 * 1024), size);
            }
        });
    }

    /** A song's own picture, else its album's. */
    static byte[] track(Context c, final long id, final int size) {
        byte[] own = get(c, "tr" + id + "_" + size, new Maker() {
            public Bitmap make(Context c) throws Exception {
                Uri u = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
                if (Build.VERSION.SDK_INT >= 29) return c.getContentResolver().loadThumbnail(u, new Size(size, size), null);
                MediaMetadataRetriever r = new MediaMetadataRetriever();
                try {
                    r.setDataSource(c, u);
                    byte[] pic = r.getEmbeddedPicture();
                    return pic == null ? null : decode(pic, size);
                } finally { r.release(); }
            }
        });
        if (own != null) return own;
        long albumId = albumOf(c, id);
        return albumId < 0 ? null : album(c, albumId, size);
    }

    static byte[] video(Context c, final long id, final int size) {
        return get(c, "vi" + id + "_" + size, new Maker() {
            @SuppressWarnings("deprecation")
            public Bitmap make(Context c) throws Exception {
                if (Build.VERSION.SDK_INT >= 29)
                    return c.getContentResolver().loadThumbnail(ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id), new Size(size, size), null);
                return MediaStore.Video.Thumbnails.getThumbnail(c.getContentResolver(), id, MediaStore.Video.Thumbnails.MINI_KIND, null);
            }
        });
    }

    /** A small copy of a picture (v3.42.0, the Photos tab), turned the way it was taken. */
    static byte[] image(Context c, final long id, final int size) {
        return get(c, "im" + id + "_" + size, new Maker() {
            @SuppressWarnings("deprecation")
            public Bitmap make(Context c) throws Exception {
                Uri u = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                if (Build.VERSION.SDK_INT >= 29) return c.getContentResolver().loadThumbnail(u, new Size(size, size), null);
                Bitmap bm = MediaStore.Images.Thumbnails.getThumbnail(c.getContentResolver(), id, MediaStore.Images.Thumbnails.MINI_KIND, null);
                return turned(bm, orientationOf(c, u));
            }
        });
    }

    /**
     * A picture scaled to fit max pixels on its longer side, turned the way it
     * was taken, as JPEG; null when it is already that small (it is then sent
     * as it is). Only as much of it is decoded as that needs (inSampleSize).
     */
    static byte[] fitted(Context c, Uri u, int max) {
        busy.acquireUninterruptibly();
        try {
            ContentResolver cr = c.getContentResolver();
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            InputStream in = cr.openInputStream(u);
            if (in == null) return null;
            try { BitmapFactory.decodeStream(in, null, o); } finally { in.close(); }
            int w = o.outWidth, h = o.outHeight;
            if (w <= 0 || h <= 0 || Math.max(w, h) <= max) return null;
            int sample = 1;
            while (Math.max(w, h) / (sample * 2) >= max) sample *= 2;
            BitmapFactory.Options d = new BitmapFactory.Options();
            d.inSampleSize = sample;
            in = cr.openInputStream(u);
            if (in == null) return null;
            Bitmap bm;
            try { bm = BitmapFactory.decodeStream(in, null, d); } finally { in.close(); }
            if (bm == null) return null;
            bm = turned(fit(bm, max), orientationOf(c, u));
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bm.compress(Bitmap.CompressFormat.JPEG, 90, out);
            bm.recycle();
            return out.toByteArray();
        } catch (Throwable t) {
            BMLog.w("picture " + u + ": " + t);
            return null;
        } finally { busy.release(); }
    }

    private static int orientationOf(Context c, Uri u) {
        Cursor cur = null;
        try {
            cur = c.getContentResolver().query(u, new String[] { "orientation" }, null, null, null);
            if (cur != null && cur.moveToFirst() && !cur.isNull(0)) return cur.getInt(0);
        } catch (Exception ignored) {
        } finally { if (cur != null) cur.close(); }
        return 0;
    }

    private static Bitmap turned(Bitmap bm, int degrees) {
        if (bm == null || degrees % 360 == 0) return bm;
        android.graphics.Matrix m = new android.graphics.Matrix();
        m.postRotate(degrees);
        Bitmap r = Bitmap.createBitmap(bm, 0, 0, bm.getWidth(), bm.getHeight(), m, true);
        if (r != bm) bm.recycle();
        return r;
    }

    private static long albumOf(Context c, long id) {
        Cursor cur = null;
        try {
            cur = c.getContentResolver().query(ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id), new String[] { "album_id" }, null, null, null);
            if (cur != null && cur.moveToFirst() && !cur.isNull(0)) return cur.getLong(0);
        } catch (Exception ignored) {
        } finally { if (cur != null) cur.close(); }
        return -1;
    }

    private static byte[] get(Context c, String key, Maker m) {
        byte[] b = mem.get(key);
        if (b != null) return b;
        if (none.contains(key)) return null;
        File dir = new File(c.getCacheDir(), "art");
        File f = new File(dir, key + ".jpg");
        if (f.isFile()) {
            try { b = LocalServer.readAll(new FileInputStream(f), 4 * 1024 * 1024); } catch (Exception e) { b = null; }
            if (b != null && b.length > 0) { mem.put(key, b); return b; }
        }
        busy.acquireUninterruptibly();
        try {
            b = mem.get(key);                                  // made by another thread meanwhile
            if (b != null) return b;
            Bitmap bm = null;
            try { bm = m.make(c); } catch (Throwable t) { bm = null; }
            if (bm == null) {
                if (none.size() > 20000) none.clear();
                none.add(key);
                return null;
            }
            bm = fit(bm, Integer.parseInt(key.substring(key.lastIndexOf('_') + 1)));
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            bm.compress(Bitmap.CompressFormat.JPEG, 86, o);
            bm.recycle();
            b = o.toByteArray();
            mem.put(key, b);
            try {
                if (!dir.isDirectory()) dir.mkdirs();
                FileOutputStream out = new FileOutputStream(f);
                try { out.write(b); } finally { out.close(); }
                if (!trimmed) { trimmed = true; trim(dir); }
            } catch (Exception ignored) { }
            return b;
        } finally { busy.release(); }
    }

    /** At most size pixels on the longer side. */
    private static Bitmap fit(Bitmap bm, int size) {
        int w = bm.getWidth(), h = bm.getHeight(), m = Math.max(w, h);
        if (m <= size) return bm;
        float k = size / (float) m;
        Bitmap s = Bitmap.createScaledBitmap(bm, Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)), true);
        if (s != bm) bm.recycle();
        return s;
    }

    private static Bitmap decode(byte[] data, int size) {
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(data, 0, data.length, o);
        int sample = 1;
        while (Math.max(o.outWidth, o.outHeight) / (sample * 2) >= size) sample *= 2;
        o = new BitmapFactory.Options();
        o.inSampleSize = sample;
        return BitmapFactory.decodeByteArray(data, 0, data.length, o);
    }

    /** The disk cache kept under about 60 MB: the oldest pictures go first. */
    private static void trim(final File dir) {
        new Thread(new Runnable() {
            public void run() {
                try {
                    File[] fs = dir.listFiles();
                    if (fs == null) return;
                    long total = 0;
                    for (File f : fs) total += f.length();
                    if (total < 60L * 1024 * 1024) return;
                    Arrays.sort(fs, new Comparator<File>() {
                        public int compare(File a, File b) { return Long.compare(a.lastModified(), b.lastModified()); }
                    });
                    for (File f : fs) {
                        if (total < 40L * 1024 * 1024) break;
                        total -= f.length();
                        f.delete();
                    }
                } catch (Exception ignored) { }
            }
        }, "bm-art-trim").start();
    }
}
