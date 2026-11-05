package io.github.britmat.bmplayer;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Random;

/**
 * RangeStream (v3.48.0), the stream LocalServer answers a song's range with,
 * read as WebView reads it: Chromium's InputStreamReader and
 * net::HttpByteRange (components/embedder_support/android/util/
 * input_stream_reader.cc), which take the stream's available() as its size,
 * work out the range from it, skip to its start and read to the stream's end.
 * Read too as a WebView that took the 206 as it is would read it, and next
 * to the way before 3.48.0, which LocalServer skipped first and WebView then
 * skipped again (scripts/stream-check.mjs).
 */
public class TestRangeStream {
    static int fails = 0;
    static void ok(boolean c, String what) { System.out.println((c ? "  ok   " : "  FAIL ") + what); if (!c) fails++; }

    /** A Range header as net::HttpUtil::ParseRangeHeader reads it: { first, last, suffix }, -1 where not given. */
    static long[] header(String h) {
        if (h == null) return new long[] { -1, -1, -1 };
        String s = h.substring(6);
        int d = s.indexOf('-');
        String a = s.substring(0, d), b = s.substring(d + 1);
        if (a.isEmpty()) return new long[] { -1, -1, Long.parseLong(b) };
        return new long[] { Long.parseLong(a), b.isEmpty() ? -1 : Long.parseLong(b), -1 };
    }

    /** What WebView delivers to the page from an app's stream, for that Range. Throws where WebView fails the request. */
    static byte[] webview(InputStream st, String rangeHeader) throws IOException {
        long[] r = header(rangeHeader);
        long first = r[0], last = r[1], suffix = r[2];
        boolean valid = suffix > 0 || (first >= 0 && (last == -1 || last >= first));
        if (rangeHeader != null && !valid) throw new IOException("not satisfiable (the range)");
        int size = st.available();                                          // VerifyRequestedRange
        if (size > 0) {                                                     // ComputeBounds(size)
            if (first < 0 && last < 0 && suffix < 0) { first = 0; last = size - 1; }
            else if (suffix > 0) { first = size - Math.min(size, suffix); last = size - 1; }
            else if (first < size) last = last >= 0 ? Math.min(size - 1, last) : size - 1;
            else throw new IOException("not satisfiable (" + first + " is past the " + size + " the stream said it had)");
        }
        if (valid && first > 0) {                                           // SkipToRequestedRange
            long left = first;
            do {
                long k = st.skip(left);
                if (k <= 0) throw new IOException("not satisfiable (could not skip)");
                left -= k;
            } while (left > 0);
        }
        return readAll(st);
    }

    /** A WebView that took the 206 as it is: read from where the stream is. */
    static byte[] asIs(InputStream st) throws IOException { return readAll(st); }

    static byte[] readAll(InputStream st) throws IOException {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        byte[] buf = new byte[7919];
        int n;
        while ((n = st.read(buf, 0, buf.length)) > 0) o.write(buf, 0, n);
        return o.toByteArray();
    }

    /** The way before 3.48.0: skipped to the range's start by LocalServer, then at most its length. */
    static InputStream before(byte[] file, long from, long to) throws IOException {
        InputStream in = new ByteArrayInputStream(file);
        long n = from;
        while (n > 0) { long k = in.skip(n); if (k <= 0) break; n -= k; }
        final long[] left = { to - from + 1 };
        return new FilterInputStream(in) {
            @Override public int read(byte[] b, int off, int len) throws IOException {
                if (left[0] <= 0) return -1;
                int r = super.read(b, off, (int) Math.min(len, left[0]));
                if (r > 0) left[0] -= r;
                return r;
            }
            @Override public long skip(long k) throws IOException { long s = super.skip(Math.min(k, left[0])); if (s > 0) left[0] -= s; return s; }
            @Override public int available() throws IOException { return (int) Math.min(super.available(), left[0]); }
        };
    }

    /** A file that, like a pipe, skips nothing: RangeStream reads its way forward instead. */
    static InputStream noSkip(byte[] file) {
        return new FilterInputStream(new ByteArrayInputStream(file)) {
            @Override public long skip(long n) { return 0; }
        };
    }

    public static void main(String[] a) throws Exception {
        final StringBuilder said = new StringBuilder();
        RangeStream.log = new RangeStream.Log() { public void w(String s) { said.append(s).append('\n'); } };
        byte[] file = new byte[1000003];
        new Random(7).nextBytes(file);
        int total = file.length;
        String[] ranges = { null, "bytes=0-", "bytes=0-65535", "bytes=1000-", "bytes=499999-", "bytes=500002-", "bytes=740000-",
                "bytes=1000002-", "bytes=400000-400999", "bytes=900000-2000000", "bytes=-128", "bytes=-2000000" };
        int wrongBefore = 0;
        for (String h : ranges) {
            long[] r = h == null ? new long[] { 0, total - 1 } : RangeStream.parse(h, total);
            byte[] want = Arrays.copyOfRange(file, (int) r[0], (int) r[1] + 1);
            String name = h == null ? "no range (the whole file)" : h;
            byte[] got = webview(new RangeStream(new ByteArrayInputStream(file), r[0], r[1], total, "test"), h);
            ok(Arrays.equals(got, want), name + ": WebView gets bytes " + r[0] + " to " + r[1] + (Arrays.equals(got, want) ? "" : " (got " + got.length + " bytes)"));
            byte[] got2 = asIs(new RangeStream(new ByteArrayInputStream(file), r[0], r[1], total, "test"));
            ok(Arrays.equals(got2, want), name + ": and a WebView that does not skip, the same");
            byte[] got3 = webview(new RangeStream(noSkip(file), r[0], r[1], total, "test"), h);
            ok(Arrays.equals(got3, want), name + ": and from a file that cannot skip, the same");
            byte[] old;
            try { old = webview(before(file, r[0], r[1]), h); } catch (IOException e) { old = null; }
            if (old == null || !Arrays.equals(old, want)) wrongBefore++;
        }
        ok(wrongBefore >= 6, "the way before 3.48.0 gave the wrong bytes, or none, for " + wrongBefore + " of " + ranges.length
                + " (everything asked from partway in: from twice as far, or refused past the middle)");
        ok(RangeStream.parse("bytes=1000003-", total) == null && RangeStream.parse("bytes=2000000-", total) == null, "a range past the end is refused (416)");
        ok(Arrays.equals(RangeStream.parse("bytes=5-1", total), null) && RangeStream.parse("bytes=-0", total) == null, "and an empty one");
        long[] odd = RangeStream.parse("items=0-5", total);
        ok(odd[0] == 0 && odd[1] == total - 1, "one that cannot be read is the whole file");
        // A file shorter than said (the phone's count of it out of date): told once, with where.
        byte[] shorter = Arrays.copyOf(file, 600000);
        said.setLength(0);
        byte[] got = webview(new RangeStream(new ByteArrayInputStream(shorter), 500000, total - 1, total, "/media/audio/7"), "bytes=500000-");
        ok(got.length == 100000 && said.toString().contains("/media/audio/7: the file ended at byte 600000"), "a file that ends early is told in the log, with where (" + said.toString().trim() + ")");
        // A read that fails partway: told, and passed on to WebView (the page then picks the song up again).
        said.setLength(0);
        InputStream failing = new FilterInputStream(new ByteArrayInputStream(file)) {
            long at = 0;
            @Override public int read(byte[] b, int off, int len) throws IOException {
                if (at >= 300000) throw new IOException("I/O error");
                int r = super.read(b, off, (int) Math.min(len, 300000 - at)); if (r > 0) at += r; return r;
            }
            @Override public long skip(long n) throws IOException { long k = super.skip(n); at += k; return k; }
        };
        boolean threw = false;
        try { webview(new RangeStream(failing, 100000, total - 1, total, "/media/audio/8"), "bytes=100000-"); } catch (IOException e) { threw = true; }
        ok(threw && said.toString().contains("/media/audio/8: reading failed at byte 300000 of 1000003: I/O error"), "a read that fails partway is told, with where, and passed on (" + said.toString().trim() + ")");
        System.out.println(fails == 0 ? "\nRangeStream: all passed" : "\nRangeStream: " + fails + " failed");
        System.exit(fails == 0 ? 0 : 1);
    }
}
