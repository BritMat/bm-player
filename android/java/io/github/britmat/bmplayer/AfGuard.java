package io.github.britmat.bmplayer;

import java.util.Arrays;
import java.util.HashSet;

/**
 * The sound modes for films (v3.49.0): the page hands mpv an audio filter
 * (its af), made by sound-chain.js, the same one the desktop gives mpv. An
 * af can name any of FFmpeg's filters, and some of those open files or
 * addresses of their own (amovie, for one), so the page's is taken only when
 * it is made of the filters sound-chain.js uses, with plain numbers and
 * words for their options: no paths, no quotes, nothing in brackets but the
 * short names that join the filter graph's parts.
 *
 *   lavfi=[filter=options,filter;[a]filter[b];...]   or   '' (none)
 */
final class AfGuard {
    private AfGuard() { }

    /** What sound-chain.js uses, and nothing else. */
    static final HashSet<String> FILTERS = new HashSet<String>(Arrays.asList(
            "volume", "equalizer", "dialoguenhance", "pan", "aformat", "acompressor", "alimiter", "asplit", "amix",
            "highpass", "lowpass", "lowshelf", "aecho", "apulsator", "vibrato"));

    private static final String LABELS = "(\\[[a-z0-9]{1,12}\\])+";
    private static final String FILTER = "[a-z]{2,20}(=[A-Za-z0-9_.:|+*=\\-]{1,400})?";

    static boolean ok(String af) {
        if (af == null) return false;
        if (af.isEmpty()) return true;
        if (af.length() > 4000 || !af.startsWith("lavfi=[") || !af.endsWith("]")) return false;
        String graph = af.substring("lavfi=[".length(), af.length() - 1);
        if (graph.isEmpty()) return false;
        for (String chain : graph.split(";", -1)) {
            String[] parts = chain.split(",", -1);
            for (int i = 0; i < parts.length; i++) {
                String f = parts[i];
                // the names that join the graph: before a chain's first filter, after its last
                if (i == 0) f = f.replaceFirst("^" + LABELS, "");
                if (i == parts.length - 1) f = f.replaceFirst(LABELS + "$", "");
                if (!f.matches(FILTER)) return false;
                int eq = f.indexOf('=');
                if (!FILTERS.contains(eq < 0 ? f : f.substring(0, eq))) return false;
            }
        }
        return true;
    }
}
