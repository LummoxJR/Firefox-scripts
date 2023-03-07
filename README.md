## Lummox JR's Firefox fixes

This repository contains styles and scripts meant to enhance Firefox. It's intended to be used with a boot loader, such as [xiaoxiaoflood's loader](https://github.com/xiaoxiaoflood/firefox-scripts/).

Any of these files should be usable individually.

### CSS files

To use these custom CSS files, follow these steps:

1. Go to `about:config` and enable `toolkit.legacyUserProfileCustomizations.stylesheets` to enable userChrome styling.
2. Copy any of these CSS files that you want into the `chrome` directory under your Firefox profile.
3. Edit the `userChrome.css` file in that directory using any editor you like, and add an `@import` line for the CSS you'll be using.

For example, Pretty Tabs can be enabled by adding this line to the `userChrome.css` file:

`@import url('prettyTabs.css') screen;`

#### Pretty Tabs

Restores the nice S-curve tabs seen in Firefox versions of the past, instead of the boxy tabs Firefox now uses by default.

#### Rounded URL bar and Search Bar

I hate the blocky look of the URL bar and search bar. This changes them, and also makes the search bar stay a nice size.

#### Separate Reload and Stop Buttons

Separates the reload button and the stop button into two different buttons, like they're supposed to be.

### Userscripts

These scripts require a boot loader like the one listed above, not just the enabling of userChrome.css. The loader should recognize these files and load them as long as they're included in the `chrome` directory under your profile.

#### Tabs on Bottom

Moves the tab bar to just above the browser area *where it belongs*, instead of right beneath the titlebar (i.e. the stupid way). This is not compatible with the setting that puts tabs directly in the titlebar.

#### Hide One Tab

Hides the tab bar when only one tab is open. The new tab button, throbber, media playing, and mute indicators are all moved up to the menu bar instead in this case.

#### Remove Urlbar Search One-Offs

Gets rid of the annoying search one-offs at the bottom of the URL bar, restoring a preference we used to have that the UX team nuked because *reasons*.

