// ==UserScript==
// @name            Hide One Tab
// @author          Lummox JR
// @include         main
// @startup         UC.hideOneTab.exec(win);
// @shutdown        UC.hideOneTab.destroy();
// @onlyonce
// ==/UserScript==

/*
	Hides the tab bar when only a single tab is active, like the good old
	days. When only one tab is present, the new tab button, throbber, and
	media playing / mute indicators all move up to the menu bar.

	Last tested with Firefox 111

	This file is released into the public domain.
 */

UC.hideOneTab = {
	PREF_ENABLED: 'userChromeJS.hideOneTab',
	PREF_TABSINTITLEBAR: 'browser.tabs.drawInTitlebar', // incompatible with this script

	DISPLAY_ID: 'hiddentabs',
	THROBBER_ID: 'hiddentabs-throbber',
	NEWTAB_ID: 'hiddentabs-newtab-button',
	MEDIA_ID: 'hiddentabs-media',

	THROBBER_SVG: `<path fill="context-fill" fill-opacity="context-fill-opacity" d="M8,1C4.146,1 1,4.146 1,8c0,3.854 3.146,7 7,7A1,1 0 1 0 8,13C5.227,13 3,10.773 3,8 3,5.227 5.227,3 8,3c2.773,0 5,2.227 5,5a1,1 0 1 0 2,0C15,4.146 11.854,1 8,1Z"/>`,
	NEWTAB_SVG: `<path fill="context-fill" fill-opacity="context-fill-opacity" d="M 5.5,3.5C4.086,3.5 2.782,4.273 2.104,5.515L0.062,9.259A0.5,0.5 0 0 0 .261,9.938 .5,.5 0 0 0 .94,9.739L2.981,5.996C3.484,5.073 4.45,4.5 5.5,4.5h5c1.051,0 2.016,0.573 2.519,1.496l2.041,3.743a0.5,0.5 0 0 0 .68,0.199 .5,0.5 0 0 0 .199,-.68L13.896,5.515C13.218,4.273 11.914,3.5 10.5,3.5ZM8 6A1 1 0 0 0 7 7L7 10L4 10A1 1 0 0 0 3 11A1 1 0 0 0 4 12L7 12L7 15A1 1 0 0 0 8 16A1 1 0 0 0 9 15L9 12L12 12A1 1 0 0 0 13 11A1 1 0 0 0 12 10L9 10L9 7A1 1 0 0 0 8 6z"/>`,

	get enabled() {
		return xPref.get(this.PREF_ENABLED) && !xPref.get(this.PREF_TABSINTITLEBAR);
	},

	// true if the doc has only one tab and this is enabled
	onlytab: function(doc) {return !!doc.querySelector('#tabbrowser-tabs[hideonetab] tab:first-of-type:last-of-type');},

	encodeSVG: function(svg,color,opacity) {
		if(color) svg = svg.replace('context-fill',color);
		if(opacity) svg = svg.replace('context-fill-opacity',opacity);
		svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">${svg}</svg>`;
		svg = svg.replace(/'/g,`"`).replace(/>\s+</g,'><').replace(/[\r\n%#()<>?[\\\]^`{|}]/g,encodeURIComponent);
		return `url('data:image/svg+xml,${svg}')`;
	},

	init: function() {
		xPref.set(this.PREF_ENABLED, true, true);
		// we used to init this.observer here, but Firefox 110 onward doesn't let us

		var onEnabled = this.onEnabled.bind(this);
		this.enabledListener = xPref.addListener(this.PREF_ENABLED, onEnabled);
		this.titlebarListener = xPref.addListener(this.PREF_TABSINTITLEBAR, onEnabled);

		/*
			Some built-in BS prevents SVGs from using context-fill and
			context-fill-opacity, so we have to resort to this hacky crap to
			rebuild the SVGs when the theme styling changes.
		 */
		this.themeObserver = new (function ThemeObserver(ext) {
			var obs = Services.obs;
			var registered = false;
			this.observe = function(subject,topic,data) {
				if(topic == 'lightweight-theme-styling-update') ext.themeChanged();
			};
			this.handleEvent = function(evt) {};
			this.register = function() {if(!registered) {obs.addObserver(this, 'lightweight-theme-styling-update', false); registered = true;}};
			this.unregister = function() {if(registered) {obs.removeObserver(this, 'lightweight-theme-styling-update'); registered = false;}};
		})(this);

		this.setStyle();
		_uc.sss.loadAndRegisterSheet(this.STYLE.url, this.STYLE.type);
		this.themeObserver.register();
	},

	exec: function(win) {
		if(!this.observer) {
			try {this.observer = new MutationObserver(this.observerCallback.bind(this));}
			catch(_) {console.log(_);}
		}

		let doc = win.document;
		let toolbar = doc.querySelector('#TabsToolbar');
		let tablist = doc.querySelector('#tabbrowser-tabs');
		let hiddenmenu = doc.querySelector('#toolbar-menubar[autohide="true"]');
		let isEnabled = this.enabled && !hiddenmenu;
		toolbar.toggleAttribute("hideonetab",isEnabled);
		tablist.toggleAttribute("hideonetab",isEnabled);
		if(isEnabled) this.observeMutations(doc,win);

		let isPrivate = win.PrivateBrowsingUtils.isWindowPrivate(win);

		let display = doc.getElementById(this.DISPLAY_ID);
		if(!display) {
			display = _uc.createElement(doc, 'toolbaritem', {id: this.DISPLAY_ID, removable: false});
			let menubar = doc.getElementById('toolbar-menubar');
			let spacer = menubar.querySelector('spacer:last-of-type');
			display.style.setProperty('-moz-box-ordinal-group', win.getComputedStyle(spacer).getPropertyValue('-moz-box-ordinal-group'));
			menubar.insertBefore(display, spacer.nextSibling);

			let throbber, newtab;
			display.appendChild(throbber = _uc.createElement(doc, 'toolbarbutton', {
				id: this.THROBBER_ID,
				class: "toolbarbutton-1 chromeclass-toolbar-additional",
				label: "Tab loading",
				tooltiptext: "Tab loading"
			}));
			let color = win.getComputedStyle(throbber).fill;
			let opacity = win.getComputedStyle(throbber).fillOpacity;
			throbber.style.listStyleImage=this.encodeSVG(this.THROBBER_SVG,color,opacity);
			display.appendChild(_uc.createElement(doc, 'toolbaritem', {
				id: this.MEDIA_ID
			}));
			display.appendChild(newtab = _uc.createElement(doc, 'toolbarbutton', {
				id: this.NEWTAB_ID,
				class: "toolbarbutton-1 chromeclass-toolbar-additional",
				oncommand: "BrowserOpenTab(event);",
				onclick: "checkForMiddleClick(this, event);",
				command: "cmd_newNavigatorTab",
				label: "Open a new tab (Ctrl+T)",
				tooltiptext: "Open a new tab (Ctrl+T)"
			}));
			newtab.style.listStyleImage=this.encodeSVG(this.NEWTAB_SVG,color,opacity);

			if(isPrivate) {
				let pb = _uc.createElement(doc, 'hbox', {
					id: "private-browsing-indicator-with-label"
				});
				pb.appendChild(_uc.createElement(doc, 'image', {
					class: "private-browsing-indicator-icon"
				}));
				let pbl = _uc.createElement(doc, 'label', {
					"data-l10n-id": "private-browsing-indicator-label"
				});
				pbl.textContent = "Private browsing";
				pb.appendChild(pbl);
				display.appendChild(pb);
			}
		}
		let isonly = isEnabled && this.onlytab(doc);
		display.toggleAttribute('hidden', !isonly);
		toolbar.toggleAttribute('onetab', isonly);
		if(isonly) this.fillMedia(doc);
	},

	onEnabled: function() {
		var hiddenmenu;
		_uc.windows((doc, win) => {
			let toolbar = doc.querySelector('#TabsToolbar');
			let tablist = doc.querySelector('#tabbrowser-tabs');
			if(hiddenmenu===undefined) hiddenmenu = !!doc.querySelector('#toolbar-menubar[autohide="true"]');
			let isEnabled = this.enabled && !hiddenmenu;
			toolbar.toggleAttribute("hideonetab",isEnabled);
			tablist.toggleAttribute("hideonetab",isEnabled);
			this.observeMutations(doc,win);
			let isonly = isEnabled && this.onlytab(doc);
			doc.getElementById(this.DISPLAY_ID).toggleAttribute('hidden', !isonly);
			toolbar.toggleAttribute('onetab', isonly);
			if(isonly) this.fillMedia(doc);
		});
		if((!this.enabled || hiddenmenu) && this.observer) {
			this.observer.disconnect();
		}
	},

	fillMedia: function(doc) {
		let media = doc.getElementById(this.MEDIA_ID);
		let overlay = doc.querySelector('tab .tab-icon-overlay');
		media.innerHTML = '';
		if(overlay) {
			let clone = overlay.cloneNode(true);
			media.appendChild(clone);
			clone.addEventListener('click', overlay.click.bind(overlay));
		}
	},

	observeMutations: function(doc,win) {
		let {observer} = this;
		if(!observer) {
			try {this.observer = new win.MutationObserver(this.observerCallback.bind(this));}
			catch(_) {console.log(_);}
			observer = this.observer;
			if(!observer) return;
		}
		let tablist = doc.querySelector('#tabbrowser-tabs');
		observer.observe(doc.documentElement, {attributes: true, attributeFilter: ['style']});
		observer.observe(tablist, {subtree: true, childList:true, attributes: true, attributeFilter: ['busy','soundplaying','muted','soundplaying-scheduledremoval','activemedia-blocked','crashed','pictureinpicture','showtooltip']});
	},

	observerCallback: function(mList) {
		if(!this.enabled) return;
		for(const mutation of mList) {
			let trg = mutation.target, doc = trg.ownerDocument;
			if(trg.matches('tab')) {
				if(mutation.attributeName == 'busy') {
					let busy = !!doc.querySelector('#tabbrowser-tabs [busy]');
					doc.getElementById(this.THROBBER_ID).toggleAttribute('busy',busy);
				}
			}
			else if(trg.matches('.tab-icon-overlay') || trg.matches('label')) {
				this.fillMedia(doc);
			}
			else if(mutation.attributeName == 'style') {
				let throbber = doc.getElementById(this.THROBBER_ID);
				let newtab = doc.getElementById(this.NEWTAB_ID);
				let color = win.getComputedStyle(throbber).fill;
				let opacity = win.getComputedStyle(throbber).fillOpacity;
				throbber.style.listStyleImage=this.encodeSVG(this.THROBBER_SVG,color,opacity);
				newtab.style.listStyleImage=this.encodeSVG(this.NEWTAB_SVG,color,opacity);
			}
			else if(trg.id === 'tabbrowser-arrowscrollbox') {
				let isonly = this.onlytab(doc);
				doc.getElementById(this.DISPLAY_ID).toggleAttribute('hidden',!isonly);
				doc.querySelector('#TabsToolbar').toggleAttribute('onetab', isonly);
				if(isonly) this.fillMedia(doc);
			}
		}
	},

	themeChanged: function() {
		_uc.windows((doc, win) => {
			let throbber = doc.getElementById(this.THROBBER_ID);
			let newtab = doc.getElementById(this.NEWTAB_ID);
			let color = win.getComputedStyle(throbber).fill;
			let opacity = win.getComputedStyle(throbber).fillOpacity;
			throbber.style.listStyleImage=this.encodeSVG(this.THROBBER_SVG,color,opacity);
			newtab.style.listStyleImage=this.encodeSVG(this.NEWTAB_SVG,color,opacity);
		});
	},

	setStyle: function() {
		this.STYLE = {
			url: Services.io.newURI('data:text/css;charset=UTF-8,' + encodeURIComponent(`
@-moz-document url('${_uc.BROWSERCHROME}') {

#tabbrowser-tabs[hideonetab], #tabbrowser-tabs[hideonetab] > #tabbrowser-arrowscrollbox {
	min-height: 0 !important;
}

#tabbrowser-tabs[hideonetab] tab:first-of-type:last-of-type
{
	visibility: collapse;
}

#tabbrowser-tabs[hideonetab] .tabbrowser-tab:first-of-type:last-of-type ~ *,
#TabsToolbar[hideonetab][onetab] #tabbrowser-tabs ~ #new-tab-button,
#TabsToolbar[hideonetab][onetab] #tabbrowser-tabs ~ #alltabs-button,
#TabsToolbar[hideonetab][onetab] .private-browsing-indicator,
#TabsToolbar[hideonetab][onetab] #private-browsing-indicator-with-label {
	visibility: collapse !important;
}

#tabbrowser-tabs[hideonetab] tab {
	min-height: var(--tab-min-height)
}

#tabbrowser-tabs[hideonetab][onetab] ~ #new-tab-button,
#tabbrowser-tabs[hideonetab][onetab] ~ #alltabs-button {
	display: none;
}

#${this.DISPLAY_ID} {
	--toolbarbutton-inner-padding: 0;
}

*:root:not([customizing="true"]) #${this.DISPLAY_ID}[hidden] {visibility: collapse;}

#${this.THROBBER_ID} image {
	transition-duration: 0.1s;
}
*:root:not([customizing="true"]) #${this.THROBBER_ID} image {
	opacity: 0;
}
#${this.THROBBER_ID}[busy] image {
	opacity: 1;
	animation: hideonetab-spin 0.5s linear infinite;
}


@keyframes hideonetab-spin {
	0% { transform: rotate(0deg); }
	100% { transform: rotate(360deg); }
}

}
			`)),
			type: _uc.sss.USER_SHEET
		}
	},
	
	destroy: function() {
		xPref.removeListener(this.enabledListener);
		xPref.removeListener(this.titlebarListener);
		_uc.sss.unregisterSheet(this.STYLE.url, this.STYLE.type);
		_uc.windows((doc, win) => {
			let toolbar = doc.querySelector('#TabsToolbar');
			let tablist = doc.querySelector('#tabbrowser-tabs');
			toolbar.removeAttribute("hideonetab");
			tablist.removeAttribute("hideonetab");
		});
		if(this.themeObserver) this.themeObserver.unregister();
		if(this.observer) this.observer.disconnect();
		delete UC.hideOneTab;
	}
}

UC.hideOneTab.init();
