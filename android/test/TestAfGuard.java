package io.github.britmat.bmplayer;

import java.io.BufferedReader;
import java.io.InputStreamReader;

/**
 * AfGuard (v3.49.0): every af sound-chain.js makes is let through, read one
 * to a line from standard input (scripts/stream-check.mjs writes them), and
 * filters that could open files or addresses, or options with paths or
 * quotes in them, are not.
 */
public class TestAfGuard {
    static int fails = 0;
    static void check(boolean want, String af) {
        boolean got = AfGuard.ok(af);
        System.out.println((got == want ? "  ok   " : "  FAIL ") + (want ? "lets through " : "refuses ") + (af.length() > 90 ? af.substring(0, 90) + "..." : af));
        if (got != want) fails++;
    }
    public static void main(String[] a) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, "UTF-8"));
        int n = 0;
        for (String line; (line = in.readLine()) != null; ) { if (line.isEmpty()) continue; check(true, line); n++; }
        if (n < 10) { System.out.println("  FAIL only " + n + " filters from sound-chain.js to check"); fails++; }
        check(true, "");
        check(false, "lavfi=[amovie=/sdcard/a.mp3]");
        check(false, "lavfi=[amovie=a.mp3[x];[x]amix]");
        check(false, "lavfi=[volume=2,movie=http\\://x]");
        check(false, "lavfi=[aecho=1:1:10:0.5,afir]");
        check(false, "lavfi=[volume=1'2]");
        check(false, "lavfi=[volume=1 2]");
        check(false, "lavfi=[volume=1/2]");
        check(false, "lavfi=[[a]volume[b]x]");
        check(false, "lavfi=[volume=[evil]]");
        check(false, "lavfi=[]");
        check(false, "volume=2");
        check(false, "lavfi=[volume=2];lavfi=[amovie=x]");
        check(false, "lavfi=[sine=f=440,amix]");
        check(false, "lavfi=[Volume=2]");
        if (fails > 0) { System.out.println("AfGuard: " + fails + " wrong"); System.exit(1); }
        System.out.println("AfGuard: all right");
    }
}
