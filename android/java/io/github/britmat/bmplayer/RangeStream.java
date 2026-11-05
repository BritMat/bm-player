package io.github.britmat.bmplayer;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

/**
 * A song, video or file, or a part of it, as LocalServer gives it to WebView
 * (v3.48.0).
 *
 * WebView answers a request's Range itself, from whatever stream
 * shouldInterceptRequest returns: it asks the stream how much it holds
 * (available()), skips to the range's start, and reads on to the stream's
 * end (Chromium's InputStreamReader). Before 3.48.0 LocalServer had skipped
 * there already, so WebView went as far again. Anything asked for from
 * partway into a file (a song picked up again after a pause or a break in
 * its stream, a seek past what had been read, the end of an M4A for its
 * lyrics, a PDF read in parts) came from twice as far in, or was refused
 * once that was past the file's end. A long song then stopped partway and
 * the next one began: the phone's log said "code 2", a lost stream.
 *
 * So this stream is the file from its first byte up to the range's last, as
 * WebView expects, and WebView's own skip brings it to the range's start. A
 * WebView that did not skip (taking the 206 and its Content-Range as they
 * are) is met too: reading before any skip starts at the range's start.
 *
 * Pure Java, so it is tried on a computer (android/test/TestRangeStream.java,
 * scripts/stream-check.mjs) against WebView's way of reading, as it is.
 */
final class RangeStream extends InputStream {
    /** Where a read that failed is told (BMLog on the phone, the console in the check). */
    interface Log { void w(String s); }
    static Log log = new Log() { public void w(String s) { } };

    private final InputStream in;
    private final long from, end, total;
    private final String what;
    private long pos;
    private boolean moved, told;

    /**
     * in: the file from its first byte. from and to: the range, both
     * counted in, as parse gives them. total: the file's size, for the log.
     */
    RangeStream(InputStream in, long from, long to, long total, String what) {
        this.in = in;
        this.from = from;
        this.end = to + 1;
        this.total = total;
        this.what = what;
    }

    /**
     * What is left from here to the range's end. WebView takes this as the
     * stream's size and works out the range from it, so it counts from the
     * file's first byte until WebView skips. An int: past 2 GB it says 2 GB.
     */
    @Override public int available() {
        long n = end - pos;
        return n <= 0 ? 0 : (int) Math.min(Integer.MAX_VALUE, n);
    }

    @Override public long skip(long n) throws IOException {
        moved = true;
        long k = Math.min(n, end - pos);
        if (k <= 0) return 0;
        go(pos + k);
        return k;
    }

    @Override public int read() throws IOException {
        byte[] b = new byte[1];
        int r = read(b, 0, 1);
        return r <= 0 ? -1 : b[0] & 0xff;
    }

    @Override public int read(byte[] b, int off, int len) throws IOException {
        if (!moved) {
            moved = true;
            if (from > pos) go(from);           // not skipped by WebView: the range's start all the same
        }
        if (len <= 0) return 0;
        long left = end - pos;
        if (left <= 0) return -1;
        int r;
        try { r = in.read(b, off, (int) Math.min(len, left)); }
        catch (IOException e) { tell("reading failed at byte " + pos + " of " + total + ": " + e.getMessage()); throw e; }
        if (r > 0) pos += r;
        else if (r < 0) tell("the file ended at byte " + pos + ", before the " + end + " it was said to have");
        return r;
    }

    /** Forward to byte `to` of the file: skipped where the file can, read through where it cannot. */
    private void go(long to) throws IOException {
        byte[] buf = null;
        try {
            while (pos < to) {
                long k = in.skip(to - pos);
                if (k > 0) { pos += k; continue; }
                if (buf == null) buf = new byte[16384];
                int r = in.read(buf, 0, (int) Math.min(buf.length, to - pos));
                if (r < 0) throw new IOException("the file ended at byte " + pos);
                pos += r;
            }
        } catch (IOException e) { tell("could not go to byte " + to + " of " + total + ": " + e.getMessage()); throw e; }
    }

    private void tell(String s) {
        if (told) return;
        told = true;
        try { log.w(what + ": " + s); } catch (Throwable ignored) { }
    }

    @Override public void close() throws IOException { in.close(); }

    /**
     * "bytes=START-END", "bytes=START-" or "bytes=-LAST" as { from, to },
     * both counted in, or null when it starts past the file's end. Anything
     * else that cannot be read is taken as the whole file.
     */
    static long[] parse(String v, long total) {
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
}
