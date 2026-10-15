package io.github.britmat.bmplayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.IntentFilter;
import android.os.Build;

/** What changed between Android versions, in one place. */
final class Compat {
    private Compat() { }

    /**
     * A receiver for Android's own broadcasts (power, headphones). Android 13
     * and later want to be told whether other apps may send to it as well;
     * these come from the system, which is always allowed.
     */
    static void register(Context c, BroadcastReceiver r, IntentFilter f) {
        if (Build.VERSION.SDK_INT >= 33) c.registerReceiver(r, f, 0x2 /* Context.RECEIVER_EXPORTED */);
        else c.registerReceiver(r, f);
    }
}
