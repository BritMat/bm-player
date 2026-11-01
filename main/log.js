'use strict';
const { app } = require('electron');
const path = require('path'), fs = require('fs');

// Main-process failures had nowhere to go in a packaged build: no terminal,
// and DevTools only shows the renderer. Append them to a file the user can
// actually be asked for.
function logFatal(kind, e) {
  const line = `[${new Date().toISOString()}] ${kind}: ${e && (e.stack || e.message) || e}\n`;
  try {
    const f = path.join(app.getPath('userData'), 'main-errors.log');
    // Keep it from growing without bound across a long-lived install.
    try { if (fs.statSync(f).size > 512 * 1024) fs.renameSync(f, f + '.1'); } catch (_) {}
    fs.appendFileSync(f, line);
  } catch (_) {}
  console.error(line.trim());
}

module.exports = { logFatal };
