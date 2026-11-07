package android.content;

/** Only what LyricsStore.java asks of Android's Context, for its check on a computer (scripts/stream-check.mjs). */
public abstract class Context {
    public abstract java.io.File getFilesDir();
}
