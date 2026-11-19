package io.github.britmat.bmplayer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioAttributes;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;

import org.json.JSONObject;

import java.util.List;

/**
 * Where the sound goes (v3.55.1), told to the app's log and to the page.
 *
 * A Bluetooth headset takes sound two ways. Its music channel (A2DP) is
 * stereo at full quality. Its call channel (HFP, which Android calls SCO)
 * carries one voice, mono at 8 or 16 kHz, and music through it sounds
 * muffled, like a phone call. Songs sounded like that on a neckband, and an
 * earlier log had the web engine's sound at 8000 Hz.
 *
 * Each change of the way out (a headset on or off, its call channel opened
 * or closed, a call starting or ending) is written to the log with what
 * Android says about it, and the page is told with a 'route' event once it
 * has settled, so the song engine makes its sound again for the new way out
 * (audio-engine.js renew()). The web engine keeps the stream it opened for
 * the old one otherwise.
 */
final class AudioRoute {
    /** A headset coming on brings several changes within a second: one report for them all. */
    private static final long SETTLE_MS = 800;

    private final MainActivity a;
    private final AudioManager am;
    private AudioDeviceCallback devices;
    private BroadcastReceiver sco;
    private Object modes;               // AudioManager.OnModeChangedListener, Android 12 and later (Modes)
    private String why = "";
    private String last = null;         // what the page was last told, to tell it only of changes

    private final Runnable settled = new Runnable() { public void run() { report(); } };

    AudioRoute(MainActivity a) {
        this.a = a;
        this.am = (AudioManager) a.getSystemService(Context.AUDIO_SERVICE);
    }

    void listen() {
        if (am == null) return;
        try {
            devices = new AudioDeviceCallback() {
                @Override public void onAudioDevicesAdded(AudioDeviceInfo[] added) { changed(last == null ? "start" : "on: " + names(added)); }
                @Override public void onAudioDevicesRemoved(AudioDeviceInfo[] removed) { changed("off: " + names(removed)); }
            };
            // Android calls back at once with the devices there are: the first report.
            am.registerAudioDeviceCallback(devices, a.ui);
        } catch (Exception e) { BMLog.w("sound devices: " + e); devices = null; }
        try {
            sco = new BroadcastReceiver() {
                @Override public void onReceive(Context c, Intent i) {
                    int s = i.getIntExtra(AudioManager.EXTRA_SCO_AUDIO_STATE, -9);
                    if (s == AudioManager.SCO_AUDIO_STATE_CONNECTED) changed("the headset's call channel opened");
                    else if (s == AudioManager.SCO_AUDIO_STATE_DISCONNECTED && last != null) changed("the headset's call channel closed");
                }
            };
            Compat.register(a, sco, new IntentFilter(AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED));
        } catch (Exception e) { BMLog.w("call channel: " + e); sco = null; }
        if (Build.VERSION.SDK_INT >= 31) {
            try { modes = Modes.listen(a, am, new Runnable() { public void run() { changed("the phone's sound mode is now " + modeName(am.getMode())); } }); }
            catch (Throwable t) { BMLog.w("sound mode: " + t); modes = null; }
        }
    }

    void release() {
        a.ui.removeCallbacks(settled);
        if (am == null) return;
        if (devices != null) { try { am.unregisterAudioDeviceCallback(devices); } catch (Exception ignored) { } devices = null; }
        if (sco != null) { try { a.unregisterReceiver(sco); } catch (Exception ignored) { } sco = null; }
        if (modes != null && Build.VERSION.SDK_INT >= 31) { try { Modes.stop(am, modes); } catch (Throwable ignored) { } modes = null; }
    }

    private void changed(String what) {
        why = why.isEmpty() ? what : why + ", " + what;
        a.ui.removeCallbacks(settled);
        a.ui.postDelayed(settled, SETTLE_MS);
    }

    // Written to the log each time. The page is told when where the music goes,
    // the call channel or the rates changed (not the first time: the page asks).
    private void report() {
        JSONObject o = state();
        String key = o.optString("out") + "|" + o.optBoolean("callChannel") + "|" + o.optString("mode") + "|" + o.optInt("rate")
                + "|" + o.optInt("musicRate") + "|" + o.optString("talk") + "|" + o.optString("music");
        BMLog.i("sound: " + why + ". " + summary(o));
        try { o.put("why", why); } catch (Exception ignored) { }
        why = "";
        boolean first = last == null;
        if (key.equals(last)) return;
        last = key;
        if (!first) a.emit("route", o);
    }

    /** What Android says now: for the log, the page (Bridge.audioRoute) and the 'route' event. */
    JSONObject state() {
        JSONObject o = new JSONObject();
        if (am == null) return o;
        try {
            boolean a2dp = false, scoDevice = false, ble = false, wired = false, usb = false;
            StringBuilder list = new StringBuilder();
            for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
                int t = d.getType();
                if (t == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP) a2dp = true;
                else if (t == AudioDeviceInfo.TYPE_BLUETOOTH_SCO) scoDevice = true;
                else if (t == AudioDeviceInfo.TYPE_WIRED_HEADPHONES || t == AudioDeviceInfo.TYPE_WIRED_HEADSET) wired = true;
                else if (t == AudioDeviceInfo.TYPE_USB_HEADSET || t == AudioDeviceInfo.TYPE_USB_DEVICE) usb = true;
                else if (t == 26 || t == 27) ble = true;            // TYPE_BLE_HEADSET, TYPE_BLE_SPEAKER (Android 12)
                if (t == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE || t == AudioDeviceInfo.TYPE_TELEPHONY) continue;
                if (list.length() > 0) list.append(", ");
                list.append(describe(d));
            }
            int mode = am.getMode();
            boolean scoOn = am.isBluetoothScoOn();
            String talk = "";
            if (Build.VERSION.SDK_INT >= 31) talk = Modes.talkDevice(am);
            // Where Android sends music, and a call's sound, now (Android 13 and later)
            String music = Build.VERSION.SDK_INT >= 33 ? Modes.routeOf(am, AudioAttributes.USAGE_MEDIA) : "";
            boolean callChannel = scoOn || mode == AudioManager.MODE_IN_CALL || mode == AudioManager.MODE_IN_COMMUNICATION || music.startsWith("call channel");
            String out = !music.isEmpty() ? music : a2dp || ble ? "bluetooth" : wired ? "wired" : usb ? "usb" : "speaker";
            o.put("out", out);
            o.put("bluetooth", a2dp || scoDevice || ble);
            o.put("a2dp", a2dp);
            o.put("callChannel", callChannel);
            o.put("scoOn", scoOn);
            o.put("mode", modeName(mode));
            o.put("talk", talk);
            o.put("music", music);
            o.put("rate", number(am.getProperty(AudioManager.PROPERTY_OUTPUT_SAMPLE_RATE)));
            o.put("musicRate", AudioTrack.getNativeOutputSampleRate(AudioManager.STREAM_MUSIC));
            o.put("devices", list.toString());
        } catch (Exception e) {
            try { o.put("error", String.valueOf(e)); } catch (Exception ignored) { }
        }
        return o;
    }

    private static String summary(JSONObject o) {
        if (o.has("error")) return "could not be read: " + o.optString("error");
        String music = o.optString("music");
        return "Music goes to " + (music.isEmpty() ? o.optString("out") : music)
                + ". Mode: " + o.optString("mode")
                + (o.optBoolean("scoOn") ? ". The headset's call channel is open" : "")
                + (o.optString("talk").isEmpty() ? "" : ". Calls go to " + o.optString("talk"))
                + ". Rate " + o.optInt("rate") + " Hz (music " + o.optInt("musicRate") + " Hz)"
                + ". Outputs: " + o.optString("devices");
    }

    private static int number(String s) {
        try { return s == null ? 0 : Integer.parseInt(s.trim()); } catch (Exception e) { return 0; }
    }

    static String modeName(int m) {
        switch (m) {
            case AudioManager.MODE_NORMAL: return "normal";
            case AudioManager.MODE_RINGTONE: return "ringing";
            case AudioManager.MODE_IN_CALL: return "in a call";
            case AudioManager.MODE_IN_COMMUNICATION: return "in a call (an app's)";
            case 4: return "call screening";                     // MODE_CALL_SCREENING (Android 11)
            default: return "mode " + m;
        }
    }

    static String typeName(int t) {
        switch (t) {
            case AudioDeviceInfo.TYPE_BUILTIN_SPEAKER: return "the speaker";
            case AudioDeviceInfo.TYPE_BUILTIN_EARPIECE: return "the earpiece";
            case AudioDeviceInfo.TYPE_WIRED_HEADPHONES: return "wired headphones";
            case AudioDeviceInfo.TYPE_WIRED_HEADSET: return "a wired headset";
            case AudioDeviceInfo.TYPE_BLUETOOTH_A2DP: return "Bluetooth (music channel)";
            case AudioDeviceInfo.TYPE_BLUETOOTH_SCO: return "Bluetooth (call channel)";
            case AudioDeviceInfo.TYPE_USB_HEADSET: return "a USB headset";
            case AudioDeviceInfo.TYPE_USB_DEVICE: return "a USB device";
            case AudioDeviceInfo.TYPE_HDMI: return "HDMI";
            case AudioDeviceInfo.TYPE_TELEPHONY: return "the phone line";
            case 26: return "Bluetooth LE headset";
            case 27: return "Bluetooth LE speaker";
            case 30: return "Bluetooth LE broadcast";
            default: return "device type " + t;
        }
    }

    private static String describe(AudioDeviceInfo d) {
        StringBuilder b = new StringBuilder(typeName(d.getType()));
        CharSequence name = d.getProductName();
        if (name != null && name.length() > 0 && d.getType() != AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) b.append(" \"").append(name).append('"');
        int[] rates = d.getSampleRates();
        if (rates != null && rates.length > 0) {
            b.append(" [");
            for (int i = 0; i < rates.length; i++) { if (i > 0) b.append(' '); b.append(rates[i]); }
            b.append(" Hz]");
        }
        return b.toString();
    }

    private static String names(AudioDeviceInfo[] ds) {
        StringBuilder b = new StringBuilder();
        if (ds != null) for (AudioDeviceInfo d : ds) {
            if (d.getType() == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE || d.getType() == AudioDeviceInfo.TYPE_TELEPHONY) continue;
            if (b.length() > 0) b.append(", ");
            b.append(typeName(d.getType()));
        }
        return b.length() == 0 ? "a device" : b.toString();
    }

    /**
     * What only Android 12 and 13 have, kept in a class of its own: it is
     * loaded only on them, so older phones never meet what they lack.
     */
    static final class Modes {
        private Modes() { }

        static Object listen(Context c, AudioManager am, final Runnable onChange) {
            AudioManager.OnModeChangedListener l = new AudioManager.OnModeChangedListener() {
                @Override public void onModeChanged(int mode) { onChange.run(); }
            };
            am.addOnModeChangedListener(c.getMainExecutor(), l);
            return l;
        }

        static void stop(AudioManager am, Object l) {
            am.removeOnModeChangedListener((AudioManager.OnModeChangedListener) l);
        }

        /** Where a call's sound goes (the "communication device"), or "". */
        static String talkDevice(AudioManager am) {
            try { AudioDeviceInfo d = am.getCommunicationDevice(); return d == null ? "" : typeName(d.getType()); }
            catch (Throwable t) { return ""; }
        }

        /** Where Android sends sound of this use now, or "" if it does not say. */
        static String routeOf(AudioManager am, int usage) {
            try {
                AudioAttributes at = new AudioAttributes.Builder().setUsage(usage).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();
                List<AudioDeviceInfo> ds = am.getAudioDevicesForAttributes(at);
                if (ds == null || ds.isEmpty()) return "";
                StringBuilder b = new StringBuilder();
                for (AudioDeviceInfo d : ds) {
                    if (b.length() > 0) b.append(" and ");
                    int t = d.getType();
                    b.append(t == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ? "call channel (Bluetooth)" : typeName(t));
                }
                return b.toString();
            } catch (Throwable t) { return ""; }
        }
    }
}
