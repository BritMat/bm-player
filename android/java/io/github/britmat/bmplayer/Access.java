package io.github.britmat.bmplayer;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.webkit.PermissionRequest;

import org.json.JSONObject;

/**
 * Permissions (v3.47.0, from MainActivity): reading the phone's music,
 * videos and pictures, notifications, and the microphone the page asks for
 * when the fox listens. The page asks through Bridge, as a.access, and hears
 * back in a 'permission' event. Moved as they were: nothing here changed.
 */
final class Access {
    static final int REQ_MEDIA = 7, REQ_MIC = 21;
    private final MainActivity a;
    private PermissionRequest pendingMic;

    Access(MainActivity a) { this.a = a; }

    /** What a kind of access needs: Android 13 split reading media in two, before it there was one. */
    static String[] permissionsFor(String kind) {
        if ("notifications".equals(kind)) return Build.VERSION.SDK_INT >= 33 ? new String[] { "android.permission.POST_NOTIFICATIONS" } : new String[0];
        if ("mic".equals(kind)) return new String[] { "android.permission.RECORD_AUDIO" };
        if (Build.VERSION.SDK_INT >= 33) return new String[] { "video".equals(kind) ? "android.permission.READ_MEDIA_VIDEO"
                : "image".equals(kind) ? "android.permission.READ_MEDIA_IMAGES" : "android.permission.READ_MEDIA_AUDIO" };
        return new String[] { "android.permission.READ_EXTERNAL_STORAGE" };
    }

    /** 'granted', 'ask', or 'denied' (refused for good: only the app's settings can change it). */
    String permissionState(String kind) {
        String[] ps = permissionsFor(kind);
        if (ps.length == 0) return "granted";
        String p = ps[0];
        if (a.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED) return "granted";
        boolean asked = a.getSharedPreferences("bm", Context.MODE_PRIVATE).getBoolean("asked:" + p, false);
        return asked && !a.shouldShowRequestPermissionRationale(p) ? "denied" : "ask";
    }

    void askPermission(String kind) {
        String[] ps = permissionsFor(kind);
        if (ps.length == 0) { permissionResult(); return; }
        a.getSharedPreferences("bm", Context.MODE_PRIVATE).edit().putBoolean("asked:" + ps[0], true).apply();
        if (a.checkSelfPermission(ps[0]) == PackageManager.PERMISSION_GRANTED) { permissionResult(); return; }
        a.requestPermissions(ps, REQ_MEDIA);
    }

    /** Android's answer to a request (MainActivity.onRequestPermissionsResult), other than deleting's. */
    void onResult(int code, int[] results) {
        if (code == REQ_MIC && pendingMic != null) {
            PermissionRequest r = pendingMic;
            pendingMic = null;
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) r.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
            else r.deny();
        }
        permissionResult();
    }

    /**
     * The page asks for the microphone (v3.42.0: the fox listens, after
     * Talk is pressed). Only the app's own page, only the microphone, and
     * only once Android's own permission is given: asked for here the
     * first time. Anything else (the camera) is refused. On the UI thread.
     */
    void micRequest(PermissionRequest r) {
        boolean ours = r.getOrigin() != null && MainActivity.HOST.equals(r.getOrigin().getHost());
        boolean mic = false;
        for (String res : r.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) mic = true;
        if (!ours || !mic) { r.deny(); return; }
        if (a.checkSelfPermission("android.permission.RECORD_AUDIO") == PackageManager.PERMISSION_GRANTED) {
            r.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
            return;
        }
        if (pendingMic != null) pendingMic.deny();
        pendingMic = r;
        a.getSharedPreferences("bm", Context.MODE_PRIVATE).edit().putBoolean("asked:android.permission.RECORD_AUDIO", true).apply();
        a.requestPermissions(new String[] { "android.permission.RECORD_AUDIO" }, REQ_MIC);
    }

    void micCanceled(PermissionRequest r) {
        if (pendingMic == r) pendingMic = null;
    }

    private void permissionResult() {
        try {
            JSONObject o = new JSONObject();
            o.put("audio", permissionState("audio"));
            o.put("video", permissionState("video"));
            o.put("image", permissionState("image"));
            o.put("mic", permissionState("mic"));
            o.put("notifications", permissionState("notifications"));
            BMLog.i("access: music " + o.optString("audio") + ", videos " + o.optString("video") + ", pictures " + o.optString("image") + ", microphone " + o.optString("mic"));
            a.emit("permission", o);
        } catch (Exception e) { BMLog.w("permission result: " + e); }
    }

    /** The app's page in Android's settings, for access refused for good. */
    void openAppSettings() {
        try { a.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + a.getPackageName()))); }
        catch (Exception e) { BMLog.w("settings: " + e); }
    }
}
