'use strict';
/** A message to the page, when there is one to take it. */
const S = require('./state');
module.exports = (ch, ...d) => { try { if (S.win && !S.win.isDestroyed()) S.win.webContents.send(ch, ...d); } catch (_) {} };
