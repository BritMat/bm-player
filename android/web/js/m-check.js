/*
 * m-check: runs first, as a plain script, before the app's modules.
 *
 * The theme is put on the page before anything is drawn, so a light theme
 * does not flash dark first. Then the phone's web engine (Android System
 * WebView, which is Chrome) is checked: the app needs version 90 or newer.
 * Android 7 phones that never had it updated are older than that, and the
 * modules would simply not start, leaving a blank screen. This says why,
 * and how to fix it.
 *
 * Errors before the app has started are shown on the screen too, and go to
 * the app's log (Settings, About, The app's log).
 */
(function () {
  'use strict';
  var root = document.documentElement;
  try { root.setAttribute('data-theme', localStorage.getItem('bm_m_theme') || 'dark'); } catch (e) { /* storage off */ }

  function log (s) { try { if (window.BMAndroid) window.BMAndroid.log(String(s)); } catch (e) { /* no bridge */ } }
  function show (html) {
    var go = function () {
      var b = document.getElementById('m-old');
      if (!b) return;
      b.innerHTML = html;
      b.hidden = false;
      var a = b.querySelector('[data-store]');
      if (a) a.addEventListener('click', function () { try { window.BMAndroid.openUrl('market://details?id=com.google.android.webview'); } catch (e) { location.href = 'https://play.google.com/store/apps/details?id=com.google.android.webview'; } });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }

  var m = /Chrome\/(\d+)/.exec(navigator.userAgent || '');
  var v = m ? +m[1] : 0;
  if (v && v < 90) {
    window.__bmTooOld = true;
    log('WebView ' + v + ' is too old');
    show('<h1>Update Android System WebView</h1><p>BM Player draws its screens with the phone\'s web engine, Android System WebView. This phone has version ' + v +
      ', and BM Player needs version 90 or newer.</p><p>Update <b>Android System WebView</b> (or <b>Google Chrome</b>) in the Play Store, then open BM Player again.</p><p><button type="button" data-store>Open the Play Store</button></p>');
    return;
  }

  window.__bmErrors = [];
  window.addEventListener('error', function (e) {
    var s = (e && e.message ? e.message : 'error') + (e && e.filename ? ' (' + String(e.filename).replace(location.origin, '') + ':' + e.lineno + ')' : '');
    window.__bmErrors.push(s);
    log('error: ' + s);
    if (!window.__bmStarted) show('<h1>BM Player did not start</h1><p>Something went wrong while it was starting:</p><pre>' + s.replace(/[<&]/g, function (c) { return c === '<' ? '&lt;' : '&amp;'; }) + '</pre><p>Close BM Player and open it again. If this keeps happening, please report it with these words.</p>');
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    log('unhandled: ' + (r && (r.stack || r.message) || r));
  });
  // A module that could not be loaded at all raises no error on the page.
  setTimeout(function () {
    if (window.__bmStarted || window.__bmErrors.length) return;
    log('the app had not started after 10 seconds');
    show('<h1>BM Player did not start</h1><p>Its screens did not load. Close BM Player and open it again. If this keeps happening, please report it, with this phone\'s Android version.</p>');
  }, 10000);
})();
