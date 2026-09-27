BM Player plugins
=================

Put each plugin in its own folder here. Folders whose names start with an
underscore (like the two samples) are ignored, so to start your own:

  1. copy _sample-theme (or _sample-script)
  2. rename the copy without the underscore, for example "my-theme"
  3. edit plugin.json and the CSS or JavaScript
  4. restart BM Player, and turn it on in the Plugins panel if needed

Two kinds of plugin
-------------------
Theme plugins are a CSS file. They set the colour tokens every part of the
player uses, and appear as a new pill in the theme picker. They are on as
soon as you add them.

Script plugins are JavaScript that runs inside the player, with the same
access as BM Player itself: files, playback, everything. So they start
switched OFF. Turning one on shows a Windows confirmation first. Only turn
on script plugins you wrote yourself or trust completely.

Safety rules the player enforces
--------------------------------
- Every file a plugin.json names must be inside that plugin's own folder.
- A script plugin's files are fingerprinted when you turn it on. If any file
  changes later, the plugin is switched off until you approve it again.
- Theme CSS cannot load anything: @import and url() (other than data: URLs)
  are removed, so a theme can never contact the internet.
- Limits: 60 plugins, 16 KB plugin.json, 512 KB theme CSS, 1 MB script entry,
  60 files and 4 MB per plugin folder. Anything bigger is skipped.
- Names are shortened to 60 characters, descriptions to 240. A theme key may
  only use lowercase letters, digits and hyphens.

The two samples here are copies. Deleting or changing them does no harm;
the player puts missing ones back when you open this folder.
