package io.github.britmat.bmplayer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.ConnectivityManager;
import android.os.Build;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Updates from GitHub (v3.44.0). The page asks (Bridge: updateCheck,
 * updateDownload, updateInstall) and hears back as 'update' events, one
 * object with the state in it (state()).
 *
 *   check     GitHub's list of releases (Releases picks the newest APK).
 *             Asked with the answer's ETag, so a check that finds nothing new
 *             costs GitHub's limit nothing.
 *   download  The APK into the app's own cache, carrying on from where a
 *             stopped download ended. Then checked: its size and SHA-256 as
 *             GitHub states them, and that it is BM Player, newer than this
 *             one, signed with the same key. Anything else is thrown away.
 *   install   Handed to Android's package installer. Android asks the person
 *             (UpdateReceiver starts its question) and replaces the app. Once
 *             BM Player installed itself, Android 12 and later may update it
 *             without asking again.
 *
 * Nothing is downloaded unless the person chooses to. The state outlives the
 * page (it is kept here, not in the page), so a page that started again sees
 * a download carrying on.
 */
final class Updater {
    static final String API = "https://api.github.com/repos/BritMat/bm-player/releases?per_page=10";
    private static final String UA = "BM Player " + BuildInfo.VERSION_NAME + " for Android (https://github.com/BritMat/bm-player)";
    private static final String CHANNEL = "updates";
    private static Updater one;

    static synchronized Updater get(Context c) {
        if (one == null) one = new Updater(c.getApplicationContext());
        return one;
    }

    private final Context app;
    private final SharedPreferences prefs;
    private final ExecutorService work = Executors.newSingleThreadExecutor();

    // idle, checking, none, available, downloading, ready, installing, error
    private String state = "idle";
    private Releases.Apk apk;          // a newer version on GitHub, or null
    private String latest;             // the newest version GitHub has, newer or not
    private long checked, got, total, lastEmit;
    private String error, errorKind;
    private volatile boolean cancel;
    private boolean waitingForPermission;

    private Updater(Context c) {
        app = c;
        prefs = c.getSharedPreferences("update", Context.MODE_PRIVATE);
        try { apk = Releases.Apk.from(new JSONObject(prefs.getString("apk", "{}"))); } catch (Exception ignored) { }
        latest = prefs.getString("latest", null);
        checked = prefs.getLong("checked", 0);
        if (apk != null && Releases.compare(apk.version, BuildInfo.VERSION_NAME) <= 0) apk = null;   // installed since
        if (apk != null) state = file(apk).exists() ? "ready" : "available";
        else if (checked > 0) state = "none";
        cleanup();
    }

    // ── what the page sees ───────────────────────────────────────────
    synchronized String state() { return json().toString(); }

    private synchronized JSONObject json() {
        JSONObject o = new JSONObject();
        try {
            o.put("state", state);
            o.put("current", BuildInfo.VERSION_NAME);
            if (latest != null) o.put("latest", latest);
            o.put("checked", checked);
            if (apk != null) {
                o.put("version", apk.version);
                o.put("size", apk.size);
                o.put("page", apk.page);
                o.put("prerelease", apk.prerelease);
                o.put("published", apk.published == null ? "" : apk.published);
                o.put("sha256", apk.sha256 != null);
            }
            if ("downloading".equals(state)) { o.put("got", got); o.put("total", total); }
            if (error != null) { o.put("error", error); o.put("errorKind", errorKind == null ? "" : errorKind); }
            o.put("canInstall", canInstall());
            o.put("metered", metered());
        } catch (Exception ignored) { }
        return o;
    }

    private void emit() {
        MainActivity a = MainActivity.current;
        if (a != null) a.emit("update", json());
    }

    private synchronized void fail(String kind, String text) {
        errorKind = kind;
        error = text;
        // A newer version found before stays offered: only the step failed.
        if (apk != null) state = file(apk).exists() ? "ready" : "available";
        else state = "error";
        BMLog.w("update: " + text);
    }

    // ── checking ─────────────────────────────────────────────────────
    void check(final boolean manual) {
        synchronized (this) {
            if ("checking".equals(state) || "downloading".equals(state) || "installing".equals(state)) { emitSoon(); return; }
            state = "checking";
            error = null; errorKind = null;
        }
        emit();
        work.execute(new Runnable() { public void run() { doCheck(manual); } });
    }

    private void emitSoon() {
        MainActivity a = MainActivity.current;
        if (a != null) a.ui.post(new Runnable() { public void run() { emit(); } });
    }

    private void doCheck(boolean manual) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(API).openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(20000);
            c.setRequestProperty("Accept", "application/vnd.github+json");
            c.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
            c.setRequestProperty("User-Agent", UA);
            String etag = prefs.getString("etag", null);
            if (etag != null && prefs.contains("newest")) c.setRequestProperty("If-None-Match", etag);
            int code = c.getResponseCode();
            Releases.Apk newest;
            if (code == 304) {
                newest = Releases.Apk.from(new JSONObject(prefs.getString("newest", "{}")));
            } else if (code == 200) {
                String body = new String(LocalServer.readAll(c.getInputStream(), 4 * 1024 * 1024), "UTF-8");
                newest = Releases.newest(body);
                SharedPreferences.Editor e = prefs.edit();
                String et = c.getHeaderField("ETag");
                if (et != null) e.putString("etag", et); else e.remove("etag");
                e.putString("newest", newest == null ? "{}" : newest.json().toString());
                e.apply();
            } else if (code == 403 || code == 429) {
                fail("busy", "GitHub asks to wait: too many checks from this network. Try again in an hour.");
                emit();
                return;
            } else {
                fail("network", "GitHub answered " + code + ". Try again later.");
                emit();
                return;
            }
            synchronized (this) {
                checked = System.currentTimeMillis();
                latest = newest == null ? null : newest.version;
                if (newest != null && Releases.compare(newest.version, BuildInfo.VERSION_NAME) > 0) {
                    apk = newest;
                    state = file(apk).exists() ? "ready" : "available";
                } else {
                    apk = null;
                    state = "none";
                }
                save();
            }
            BMLog.i("update check" + (manual ? " (asked for)" : "") + ": " + (code == 304 ? "nothing new on GitHub, " : "")
                    + (apk != null ? apk.version + " is out, " + apk.size + " bytes" : "this is the newest (" + (latest == null ? "no APK on GitHub" : latest) + ")"));
            cleanup();
        } catch (IOException e) {
            fail("network", "GitHub could not be reached. Is the phone online?");
            BMLog.w("update check: " + e);
        } catch (Exception e) {
            fail("network", "GitHub's answer could not be read (" + e.getMessage() + ").");
        } finally {
            if (c != null) c.disconnect();
        }
        emit();
    }

    private void save() {
        SharedPreferences.Editor e = prefs.edit();
        try { e.putString("apk", apk == null ? "{}" : apk.json().toString()); } catch (Exception ignored) { }
        if (latest != null) e.putString("latest", latest); else e.remove("latest");
        e.putLong("checked", checked);
        e.apply();
    }

    // ── downloading ──────────────────────────────────────────────────
    private File dir() { return new File(app.getCacheDir(), "update"); }

    private File file(Releases.Apk a) { return new File(dir(), a.name); }

    /** Downloads of versions this one already is, or newer than anything offered, go. */
    private synchronized void cleanup() {
        File[] fs = dir().listFiles();
        if (fs == null) return;
        for (File f : fs) {
            boolean keep = apk != null && (f.getName().equals(apk.name) || f.getName().equals(apk.name + ".part"));
            if (!keep && !f.delete()) BMLog.w("update: could not remove " + f.getName());
        }
    }

    void download() {
        final Releases.Apk a;
        synchronized (this) {
            if (apk == null || "downloading".equals(state) || "installing".equals(state) || "checking".equals(state)) { emitSoon(); return; }
            a = apk;
            if (file(a).exists()) { state = "ready"; emitSoon(); return; }
            state = "downloading";
            got = 0; total = a.size;
            error = null; errorKind = null;
            cancel = false;
        }
        emit();
        work.execute(new Runnable() { public void run() { doDownload(a); } });
    }

    void cancel() { cancel = true; }

    private static boolean trusted(String host) {
        if (host == null) return false;
        host = host.toLowerCase(Locale.US);
        return host.equals("github.com") || host.endsWith(".github.com") || host.endsWith(".githubusercontent.com");
    }

    private HttpURLConnection open(String url, long from) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setRequestProperty("User-Agent", UA);
        c.setRequestProperty("Accept", "application/octet-stream");
        if (from > 0) c.setRequestProperty("Range", "bytes=" + from + "-");
        return c;
    }

    private void doDownload(Releases.Apk a) {
        File d = dir();
        if (!d.isDirectory() && !d.mkdirs()) { fail("space", "The app's folder for the download could not be made."); emit(); return; }
        cleanup();
        File part = new File(d, a.name + ".part"), done = file(a);
        long need = (a.size > 0 ? a.size : 40L * 1024 * 1024) * 2 + 16L * 1024 * 1024;   // the download, and Android's copy while it installs
        if (d.getUsableSpace() < need) {
            fail("space", "Not enough free space: the update needs about " + (need / (1024 * 1024)) + " MB free.");
            emit();
            return;
        }
        HttpURLConnection c = null;
        InputStream in = null;
        OutputStream out = null;
        try {
            long have = part.exists() ? part.length() : 0;
            if (a.size > 0 && have > a.size) { if (!part.delete()) BMLog.w("update: could not remove a bad part"); have = 0; }
            if (a.size <= 0 || have < a.size) {
                c = open(a.url, have);
                int code = c.getResponseCode();
                if (code == 416) {                               // the part is not a beginning of this file
                    c.disconnect();
                    if (!part.delete()) BMLog.w("update: could not remove a bad part");
                    have = 0;
                    c = open(a.url, 0);
                    code = c.getResponseCode();
                }
                if (!trusted(c.getURL().getHost())) throw new IOException("it came from " + c.getURL().getHost());
                if (code == 200) have = 0;
                else if (code != 206) throw new IOException("GitHub answered " + code);
                long len = c.getContentLengthLong();
                synchronized (this) { total = a.size > 0 ? a.size : (len > 0 ? have + len : 0); got = have; }
                if (have > 0) BMLog.i("update: carrying on from " + have + " bytes");
                in = c.getInputStream();
                out = new FileOutputStream(part, have > 0);
                byte[] buf = new byte[64 * 1024];
                int r;
                while ((r = in.read(buf)) > 0) {
                    if (cancel) {
                        synchronized (this) { state = "available"; error = null; errorKind = null; }
                        BMLog.i("update: download stopped by the person at " + got + " bytes");
                        return;                                  // the part stays, to carry on from
                    }
                    out.write(buf, 0, r);
                    synchronized (this) { got += r; }
                    if (total > 0 && got > total) throw new IOException("it is longer than GitHub said");
                    progress();
                }
                out.close();
                out = null;
            }
            // Checked under its own name: Android reads an APK by what it is,
            // but some versions look at the name. An install checks it again.
            if (!part.renameTo(done)) throw new IOException("the download could not be kept");
            String why = verify(done, a);
            if (why != null) {
                if (!done.delete()) BMLog.w("update: could not remove a refused download");
                fail("verify", why);
                return;
            }
            synchronized (this) { state = "ready"; error = null; errorKind = null; }
            BMLog.i("update " + a.version + ": downloaded and checked" + (a.sha256 != null ? " (SHA-256 as GitHub states it)" : ""));
        } catch (IOException e) {
            fail("network", "The download stopped (" + e.getMessage() + "). It carries on from there next time.");
        } finally {
            if (out != null) { try { out.close(); } catch (IOException ignored) { } }
            if (in != null) { try { in.close(); } catch (IOException ignored) { } }
            if (c != null) c.disconnect();
            emit();
        }
    }

    private void progress() {
        long now = System.currentTimeMillis();
        if (now - lastEmit < 250) return;
        lastEmit = now;
        emit();
    }

    // ── checking the APK ─────────────────────────────────────────────
    /** Why the file must not be installed, or null when it is BM Player, newer, and signed with our key. */
    String verify(File f, Releases.Apk a) {
        if (a.size > 0 && f.length() != a.size) return "The download is " + f.length() + " bytes, GitHub said " + a.size + ". It was thrown away.";
        if (a.sha256 != null) {
            String h = sha256(f);
            if (!a.sha256.equals(h)) return "The download does not match GitHub's checksum. It was thrown away.";
        }
        PackageManager pm = app.getPackageManager();
        PackageInfo p = archiveInfo(pm, f);
        if (p == null) return "Android could not read the downloaded app. It was thrown away.";
        if (!app.getPackageName().equals(p.packageName)) return "The download is another app (" + p.packageName + "). It was thrown away.";
        long code = versionCode(p);
        if (code <= BuildInfo.VERSION_CODE) return "The download is not newer than this version. It was thrown away.";
        String theirs = signer(p), mine = null;
        try { mine = signer(installedInfo(pm)); } catch (Exception ignored) { }
        if (theirs == null || mine == null) {
            // Android checks the key itself when it installs, and refuses another.
            BMLog.w("update: the key could not be compared here (" + (theirs == null ? "download" : "this app") + "), Android checks it");
        } else if (!theirs.equals(mine)) {
            return "The download is not signed with BM Player's key, so Android would refuse it. It was thrown away.";
        }
        return null;
    }

    @SuppressWarnings("deprecation")
    private static PackageInfo archiveInfo(PackageManager pm, File f) {
        try { return pm.getPackageArchiveInfo(f.getPath(), PackageManager.GET_SIGNATURES); } catch (Exception e) { return null; }
    }

    @SuppressWarnings("deprecation")
    private PackageInfo installedInfo(PackageManager pm) throws PackageManager.NameNotFoundException {
        return pm.getPackageInfo(app.getPackageName(), PackageManager.GET_SIGNATURES);
    }

    @SuppressWarnings("deprecation")
    private static long versionCode(PackageInfo p) {
        return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
    }

    /** The signing certificates' SHA-256, sorted and joined, or null. */
    @SuppressWarnings("deprecation")
    static String signer(PackageInfo p) {
        if (p == null || p.signatures == null || p.signatures.length == 0) return null;
        try {
            ArrayList<String> all = new ArrayList<String>();
            for (Signature s : p.signatures) all.add(hex(MessageDigest.getInstance("SHA-256").digest(s.toByteArray())));
            Collections.sort(all);
            StringBuilder b = new StringBuilder();
            for (String s : all) { if (b.length() > 0) b.append(','); b.append(s); }
            return b.toString();
        } catch (Exception e) { return null; }
    }

    static String sha256(File f) {
        InputStream in = null;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            in = new FileInputStream(f);
            byte[] buf = new byte[64 * 1024];
            int r;
            while ((r = in.read(buf)) > 0) md.update(buf, 0, r);
            return hex(md.digest());
        } catch (Exception e) {
            return "";
        } finally {
            if (in != null) { try { in.close(); } catch (IOException ignored) { } }
        }
    }

    static String hex(byte[] d) {
        StringBuilder b = new StringBuilder(d.length * 2);
        for (byte x : d) b.append(String.format(Locale.US, "%02x", x & 0xff));
        return b.toString();
    }

    // ── installing ───────────────────────────────────────────────────
    /** Whether Android lets BM Player install apps (Android 8 and later ask once, in its settings). */
    boolean canInstall() {
        if (Build.VERSION.SDK_INT < 26) return true;
        try { return app.getPackageManager().canRequestPackageInstalls(); } catch (Exception e) { return false; }
    }

    /** On mobile data (or another network that counts), for the page to say so before 30 MB go. */
    private boolean metered() {
        try {
            ConnectivityManager cm = (ConnectivityManager) app.getSystemService(Context.CONNECTIVITY_SERVICE);
            return cm != null && cm.isActiveNetworkMetered();
        } catch (Exception e) { return false; }
    }

    /** Android's settings were opened for the permission: install as soon as it is given (resumed()). */
    synchronized void waitForPermission() { waitingForPermission = true; }

    /** The app is in front again, maybe from Android's settings. */
    void resumed() {
        boolean go;
        synchronized (this) {
            go = waitingForPermission && "ready".equals(state) && canInstall();
            if (go || canInstall()) waitingForPermission = false;
        }
        if (go) install();
        else emitSoon();
    }

    void install() {
        final Releases.Apk a;
        final File f;
        synchronized (this) {
            // "installing" too: Android's question may have been put away unanswered.
            if (apk == null || !("ready".equals(state) || "installing".equals(state))) { emitSoon(); return; }
            a = apk;
            f = file(a);
            if (!f.exists()) { state = "available"; emitSoon(); return; }
            if (!canInstall()) { error = "Android needs your OK first: allow BM Player to install apps, then come back."; errorKind = "permission"; emitSoon(); return; }
            state = "installing";
            error = null; errorKind = null;
        }
        emit();
        work.execute(new Runnable() { public void run() { doInstall(a, f); } });
    }

    private void doInstall(Releases.Apk a, File f) {
        PackageInstaller.Session s = null;
        try {
            String why = verify(f, a);                           // once more: the file is the one that was checked
            if (why != null) {
                if (!f.delete()) BMLog.w("update: could not remove a refused download");
                synchronized (this) { state = "available"; }
                fail("verify", why);
                emit();
                return;
            }
            PackageInstaller pi = app.getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams p = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            p.setAppPackageName(app.getPackageName());
            p.setSize(f.length());
            if (Build.VERSION.SDK_INT >= 26) p.setInstallReason(PackageManager.INSTALL_REASON_USER);
            if (Build.VERSION.SDK_INT >= 31) p.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
            int id = pi.createSession(p);
            s = pi.openSession(id);
            OutputStream out = s.openWrite("base.apk", 0, f.length());
            InputStream in = new FileInputStream(f);
            try {
                byte[] buf = new byte[64 * 1024];
                int r;
                while ((r = in.read(buf)) > 0) out.write(buf, 0, r);
                s.fsync(out);
            } finally {
                in.close();
                out.close();
            }
            prefs.edit().putString("installing", a.version).apply();
            Intent i = new Intent(app, UpdateReceiver.class).setAction(UpdateReceiver.STATUS);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            PendingIntent done = PendingIntent.getBroadcast(app, id, i, flags);
            s.commit(done.getIntentSender());
            s.close();
            s = null;
            BMLog.i("update " + a.version + ": handed to Android to install");
        } catch (Exception e) {
            if (s != null) { try { s.abandon(); } catch (Exception ignored) { } }
            synchronized (this) { state = "ready"; }
            fail("install", "Android could not start the install (" + e.getMessage() + ").");
            emit();
        }
    }

    /** Android's answer, from UpdateReceiver. */
    void installResult(int status, String message) {
        synchronized (this) {
            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                state = "installing";                            // Android is asking the person
            } else if (status == PackageInstaller.STATUS_SUCCESS) {
                state = "installing";                            // the app is about to be replaced
            } else {
                prefs.edit().remove("installing").apply();
                state = apk != null && file(apk).exists() ? "ready" : "available";
                if (status == PackageInstaller.STATUS_FAILURE_ABORTED) { error = "The install was cancelled. Install, when you are ready."; errorKind = "cancelled"; }
                else { error = installError(status, message); errorKind = "install"; }
            }
        }
        BMLog.i("update: Android says " + status + (message == null ? "" : " (" + message + ")"));
        emit();
    }

    static String installError(int status, String message) {
        String why;
        switch (status) {
            case PackageInstaller.STATUS_FAILURE_BLOCKED: why = "Android blocked the install."; break;
            case PackageInstaller.STATUS_FAILURE_CONFLICT: why = "Android refused it: the installed app is in the way (signed with another key?)."; break;
            case PackageInstaller.STATUS_FAILURE_INCOMPATIBLE: why = "Android says the update does not suit this phone."; break;
            case PackageInstaller.STATUS_FAILURE_INVALID: why = "Android says the downloaded app is damaged."; break;
            case PackageInstaller.STATUS_FAILURE_STORAGE: why = "Not enough storage to install it."; break;
            default: why = "Android could not install it."; break;
        }
        return why + (message != null && message.length() > 0 && message.length() < 200 ? " (" + message + ")" : "");
    }

    /**
     * The app was just replaced (ACTION_MY_PACKAGE_REPLACED, in the new
     * version). When this updater started it, a notification says so and
     * opens the app: Android closed it to replace it.
     */
    static void replaced(Context c) {
        SharedPreferences p = c.getSharedPreferences("update", Context.MODE_PRIVATE);
        String v = p.getString("installing", null);
        p.edit().remove("installing").apply();
        get(c).cleanup();
        if (v == null) return;
        BMLog.i("updated to " + BuildInfo.VERSION_NAME + " by the app's own updater");
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "Updates", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("When BM Player has updated itself");
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
            Intent open = new Intent(c, MainActivity.class).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            PendingIntent tap = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
            b.setSmallIcon(R.drawable.ic_stat_bm)
                    .setContentTitle("BM Player " + BuildInfo.VERSION_NAME + " is installed")
                    .setContentText("Tap to open it.")
                    .setContentIntent(tap)
                    .setAutoCancel(true);
            nm.notify(7, b.build());
        } catch (Exception e) { BMLog.w("updated notification: " + e); }
    }
}
