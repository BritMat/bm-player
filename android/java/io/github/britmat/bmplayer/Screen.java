package io.github.britmat.bmplayer;

import android.content.Context;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.media.AudioManager;
import android.os.Build;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;

import org.json.JSONObject;

/**
 * The window (v3.47.0, from MainActivity): which way up it turns, the bars at
 * the top and bottom and full screen, the screen kept on, its brightness, and
 * the music volume the video player's swipe sets. The page asks for these
 * through Bridge, as a.screen. Moved as they were: nothing here changed.
 */
final class Screen {
    private final MainActivity a;
    /** The bars' colour: the page's own, so the app looks one piece. The WebView and the window behind it have it too. */
    int barColor = 0xFF080B14;
    private boolean lightBars, immersiveOn;

    Screen(MainActivity a) { this.a = a; }

    void orientation(String mode) {
        int o = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;          // as the phone's auto-rotate says
        if ("landscape".equals(mode)) o = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
        else if ("portrait".equals(mode)) o = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
        else if ("sensor".equals(mode)) o = ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR;
        a.setRequestedOrientation(o);
    }

    void immersive(boolean on) {
        immersiveOn = on;
        applyBars();
    }

    /** The bars at the top and bottom in the page's colour, with dark or light icons. */
    void bars(String color, boolean light) {
        try {
            barColor = Color.parseColor(color);
            lightBars = light;
            a.getWindow().setStatusBarColor(barColor);
            a.getWindow().setNavigationBarColor(barColor);
            a.root.setBackgroundColor(barColor);
            applyBars();
        } catch (Exception e) { BMLog.w("bars " + color + ": " + e); }
    }

    @SuppressWarnings("deprecation")
    private void applyBars() {
        View d = a.getWindow().getDecorView();
        int f = 0;
        if (immersiveOn) {
            f = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
        } else if (lightBars) {
            f = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= 26) f |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        d.setSystemUiVisibility(f);
    }

    /** The window has the focus again (MainActivity.onWindowFocusChanged): full screen is put back. */
    void focused(boolean focus) {
        if (focus && immersiveOn) applyBars();
    }

    void keepScreenOn(boolean on) {
        if (on) a.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else a.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    /** The screen's brightness for this window, 0 to 1, or below 0 for the phone's own. */
    void brightness(float v) {
        WindowManager.LayoutParams lp = a.getWindow().getAttributes();
        lp.screenBrightness = v < 0 ? WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE : Math.max(0.01f, Math.min(1f, v));
        a.getWindow().setAttributes(lp);
    }

    /**
     * The brightness now, 0 to 1: this window's own, or the phone's setting
     * (v3.42.0, the video player's swipe). The setting counts to 255 on most
     * phones, but further on some (Xiaomi's to 2047, 4095 or more), which
     * read as several times full: a swipe down then did nothing for a long
     * way (v3.43.2). Android's own top is asked for, and past it the next
     * such top above the value is taken.
     */
    float screenBrightness() {
        float w = a.getWindow().getAttributes().screenBrightness;
        if (w >= 0) return Math.min(1f, w);
        try {
            int v = Settings.System.getInt(a.getContentResolver(), Settings.System.SCREEN_BRIGHTNESS);
            int max = 255;
            try {
                int id = android.content.res.Resources.getSystem().getIdentifier("config_screenBrightnessSettingMaximum", "integer", "android");
                if (id != 0) max = Math.max(max, android.content.res.Resources.getSystem().getInteger(id));
            } catch (Exception ignored) { }
            while (v > max && max < (1 << 16)) max = max * 2 + 1;   // 255, 511, 1023, 2047, 4095...
            return Math.max(0.01f, Math.min(1f, v / (float) max));
        } catch (Exception e) { return 0.5f; }
    }

    /** The music volume as { v, max }, in the phone's own steps. */
    String volume() {
        try {
            AudioManager am = (AudioManager) a.getSystemService(Context.AUDIO_SERVICE);
            JSONObject o = new JSONObject();
            o.put("v", am.getStreamVolume(AudioManager.STREAM_MUSIC));
            o.put("max", am.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    /** Sets it, without Android's own volume panel (the player shows its own). */
    void setVolume(int v) {
        try {
            AudioManager am = (AudioManager) a.getSystemService(Context.AUDIO_SERVICE);
            am.setStreamVolume(AudioManager.STREAM_MUSIC, Math.max(0, Math.min(am.getStreamMaxVolume(AudioManager.STREAM_MUSIC), v)), 0);
        } catch (Exception e) { BMLog.w("volume: " + e); }   // Do Not Disturb can refuse it
    }
}
