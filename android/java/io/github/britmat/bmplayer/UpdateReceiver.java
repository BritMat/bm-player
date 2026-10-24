package io.github.britmat.bmplayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

/**
 * Android's answers about an update (v3.44.0, Updater):
 *
 *   UPDATE_STATUS          the package installer's answer to the update
 *                          handed to it. When Android wants the person to
 *                          agree, it sends the question as an Intent, started
 *                          here. Only Android sends this: the PendingIntent
 *                          the app gave it names this receiver, which no
 *                          other app can reach (exported="false").
 *   MY_PACKAGE_REPLACED    the new version is in place (Updater.replaced).
 */
public final class UpdateReceiver extends BroadcastReceiver {
    static final String STATUS = "io.github.britmat.bmplayer.UPDATE_STATUS";

    @Override
    @SuppressWarnings("deprecation")
    public void onReceive(Context c, Intent i) {
        BMLog.init(c.getApplicationContext());
        String action = i == null ? null : i.getAction();
        if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) { Updater.replaced(c); return; }
        if (!STATUS.equals(action)) return;
        int status = i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        String message = i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent ask = i.getParcelableExtra(Intent.EXTRA_INTENT);
            if (ask != null) {
                MainActivity m = MainActivity.current;
                try {
                    if (m != null && !m.isFinishing()) m.startActivity(ask);
                    else { ask.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); c.startActivity(ask); }
                } catch (Exception e) {
                    BMLog.w("update: Android's question could not be shown: " + e);
                    status = PackageInstaller.STATUS_FAILURE;
                    message = "Android's question could not be shown";
                }
            }
        }
        Updater.get(c).installResult(status, message);
    }
}
