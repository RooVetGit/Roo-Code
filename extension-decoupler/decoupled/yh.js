
var Xr = class extends Jo {
		constructor(r, n, i, s, o = !0, a = !1) {
			super(i, s, o)
			this._extension = r
			this._configListener = n
			this._isFileRequired = a
		}
		type = "debug"
		static _generateHref(r, n, ...i) {
			return `command:${r}?${encodeURIComponent(JSON.stringify([n, ...i]))}`
		}
		canRun() {
			return (
				super.canRun() &&
				this._extension.ready &&
				Rl(
					this._configListener.config,
					this._extension.featureFlagManager.currentFlags.vscodeNextEditMinVersion,
				) &&
				(this._isFileRequired ? ki.window.activeTextEditor !== void 0 : !0)
			)
		}
		_getEventSource(r) {
			if (r.length === 0) return "command"
			for (let n in ws) {
				if (!isNaN(Number(n))) continue
				let i = ws[n]
				if (r[0] === i) return i
			}
			return r.length === 2 && r[0] instanceof ki.Uri && "groupId" in r[1]
				? "editor-action-click"
				: r.length === 1 && r[0] instanceof ki.Uri
					? "right-click"
					: r.length === 1 && r[0] === void 0
						? "next-edit-panel-item-click"
						: "command"
		}
	},
	AF = class extends Xr {
		type = "public"
		static commandID = "vscode-augment.next-edit.force"
		constructor(t, r, n) {
			super(t, r, n, void 0, void 0, !0)
		}
		canRun() {
			return super.canRun()
		}
		run(...t) {
			this._extension.forceNextEditSuggestion(this._getEventSource(t))
		}
	},
	mF = class extends Xr {
		type = "public"
		static commandID = "vscode-augment.next-edit.update"
		constructor(t, r, n) {
			super(t, r, n, void 0, !0, !1)
		}
		run(...t) {
			this._extension.nextEditUpdate(this._getEventSource(t))
		}
	},
	yF = class extends Xr {
		type = "private"
		static commandID = "_vscode-augment.next-edit.update.loading"
		constructor(t, r, n) {
			super(t, r, n, void 0, !1)
		}
		run() {
			this._extension.noopClicked()
		}
	},
	CF = class extends Xr {
		type = "private"
		static commandID = "_vscode-augment.next-edit.update.disabled-no-changes"
		constructor(t, r, n) {
			super(t, r, n, void 0, !1)
		}
		run() {
			this._extension.noopClicked()
		}
	},
	vF = class extends Xr {
		type = "private"
		static commandID = "_vscode-augment.next-edit.update.disabled-cached"
		constructor(t, r, n) {
			super(t, r, n, void 0, !1)
		}
		run() {
			this._extension.noopClicked()
		}
	},
	Dc = class extends Xr {
		type = "public"
		static commandID = "vscode-augment.next-edit.background.accept"
		constructor(t, r, n) {
			super(t, r, n, void 0)
		}
		static generateHref(t, r) {
			return super._generateHref(this.commandID, t, r)
		}
		run(...t) {
			this._extension.editorNextEdit?.accept(
				this._getEventSource(t),
				void 0,
				typeof t[1] == "string" ? t[1] : void 0,
			)
		}
	},
	uA = class extends Xr {
		type = "public"
		static commandID = "vscode-augment.next-edit.background.accept-all"
		constructor(t, r, n) {
			super(t, r, n, void 0, !0)
		}
		run(...t) {
			this._extension.editorNextEdit?.acceptAllSuggestions(this._getEventSource(t))
		}
	},
	sf = class extends Xr {
		type = "private"
		static commandID = "_vscode-augment.next-edit.background.accept-code-action"
		constructor(t, r, n) {
			super(t, r, n, void 0, !1)
		}
		run(t) {
			this._extension.editorNextEdit?.acceptSuggestion(t, "code-action")
		}
	},
	Tc = class extends Xr {
		type = "public"
		static commandID = "vscode-augment.next-edit.background.reject"
		constructor(t, r, n) {
			super(t, r, n, void 0)
		}
		static generateHref(t = "hover-click", r) {
			return super._generateHref(this.commandID, t, r)
		}
		run(...t) {
			this._extension.editorNextEdit?.reject(this._getEventSource(t), typeof t[1] == "string" ? t[1] : void 0)
		}
	},
	dA = class extends Xr {
		type = "public"
		static commandID = "vscode-augment.next-edit.background.reject-all"
		constructor(t, r, n) {
			super(t, r, n, void 0, !0)
		}
		run(...t) {
			this._extension.editorNextEdit?.rejectAllSuggestions(this._getEventSource(t))
		}
	},
	Uu = class extends Xr {
		type = "public"
		static commandID = "vscode-augment.next-edit.background.dismiss"
		constructor(t, r, n) {
			super(t, r, n, void 0)
		}
		run(...t) {
			this._extension.editorNextEdit?.dismissOrReject(this._getEventSource(t))
		}
	},
	Fa = class extends Xr {
		type = "public"
		static commandID = "vscode-augment.next-edit.background.goto-hinting"
		constructor(t, r, n) {
			super(t, r, n, void 0)
		}
		run(...t) {
			this._extension.editorNextEdit?.gotoHinting(this._getEventSource(t))
		}
	},
	Xo = class extends Xr {
		type = "public"
		static commandID = "vscode-augment.next-edit.background.next"
		constructor(t, r, n) {
			super(t, r, n, void 0)
		}
		run(...t) {
			this._extension.editorNextEdit?.next(this._getEventSource(t))
		}
	},
	Ou = class extends Xr {
		type = "public"
		static commandID = "vscode-augment.next-edit.background.previous"
		constructor(t, r, n) {
			super(t, r, n, void 0)
		}
		run(...t) {
			this._extension.editorNextEdit?.previous(this._getEventSource(t))
		}
	},
	EF = class extends Xr {
		type = "private"
		static commandID = "_vscode-augment.next-edit.background.open"
		constructor(t, r, n) {
			super(t, r, n, void 0, !1)
		}
		run(...t) {
			let r = t[0]
			this._extension.editorNextEdit?.openSuggestionAt(r.uri, r.lineNumber - 1)
		}
	},
	bF = class extends Xr {
		type = "public"
		static commandID = "vscode-augment.next-edit.toggle-panel-horizontal-split"
		constructor(t, r, n) {
			super(t, r, n, void 0, !1)
		}
		run(...t) {
			this._extension.nextEditTogglePanelHorizontalSplit(this._getEventSource(t))
		}
	},
	Yh = class extends Xr {
		type = "public"
		static commandID = "vscode-augment.next-edit.learn-more"
		constructor(t, r, n) {
			super(t, r, n, void 0, !0)
		}
		static generateHref(t = "hover-click", r) {
			return super._generateHref(this.commandID, t, r)
		}
		run(...t) {
			this._extension.nextEditLearnMore(this._getEventSource(t))
		}
	},
	xF = class extends Xr {
		type = "private"
		static commandID = "_vscode-augment.next-edit.background.next.disabled"
		constructor(t, r, n) {
			super(t, r, n, void 0, !1)
		}
		run() {
			this._extension.noopClicked()
		}
	},
	_F = class extends Xr {
		type = "private"
		static commandID = "_vscode-augment.next-edit.background.previous.disabled"
		constructor(t, r, n) {
			super(t, r, n, void 0, !1)
		}
		run() {
			this._extension.noopClicked()
		}
	},
	qu = class extends Xr {
		constructor(r, n, i) {
			super(r, n, i, void 0, r.nextEditConfigManager.config.enablePanel)
			this.extension = r
		}
		type = "public"
		static commandID = "vscode-augment.next-edit.open-panel"
		get showInActionPanel() {
			return this.extension.nextEditConfigManager.config.enablePanel
		}
		static generateHref(r = "hover-click", n) {
			return "command:augment-next-edit.focus"
		}
		run(...r) {
			this._extension.openNextEditPanel(this._getEventSource(r))
		}
	},
	Co = class extends Xr {
		type = "private"
		static commandID = "_vscode-augment.next-edit.undo-accept-suggestion"
		constructor(t, r, n) {
			super(t, r, n, void 0, !1)
		}
		static generateHref(t = "hover-click", r) {
			return super._generateHref(this.commandID, t, r)
		}
		run(...t) {
			this._extension.editorNextEdit?.undoAcceptSuggestion(void 0, this._getEventSource(t))
		}
	},
	cC = class extends Xr {
		type = "private"
		static commandID = "_vscode-augment.next-edit.toggle-hover-diff"
		constructor(t, r, n) {
			super(t, r, n, void 0, !1)
		}
		static generateHref(t = "hover-click", r) {
			return super._generateHref(this.commandID, t, r)
		}
		run(...t) {
			this._extension.editorNextEdit?.toggleHoverDiff(
				this._getEventSource(t),
				typeof t[1] == "string" ? t[1] : void 0,
			)
		}
	},
	wF = class e extends Xr {
		type = "public"
		static commandID = "vscode-augment.next-edit.toggle-bg"
		static backgroundSuggestionsConfigKey = "nextEdit.enableBackgroundSuggestions"
		defaultParams = { promptFirst: !1, newValue: void 0 }
		constructor(t, r, n) {
			super(
				t,
				r,
				n,
				() =>
					r.config.nextEdit.enableBackgroundSuggestions
						? "Turn Background Suggestions Off"
						: "Turn Background Suggestions On",
				!0,
			)
		}
		async run(t) {
			let r = { ...this.defaultParams, ...t },
				n = ki.workspace.getConfiguration("augment"),
				i = n.inspect(e.backgroundSuggestionsConfigKey),
				s = ki.ConfigurationTarget.Global
			i?.workspaceValue !== void 0 && (s = ki.ConfigurationTarget.Workspace)
			let o = r.newValue ?? !this._configListener.config.nextEdit.enableBackgroundSuggestions
			if (r.promptFirst && o === !1) {
				let a = await ki.window.showErrorMessage(
					"Are you sure you want to disable Next Edit Suggestions?",
					{
						modal: !0,
						detail: "You can re-enable them in Settings > Augment > Enable Background Suggestions.",
					},
					"Disable",
					"Go to Settings",
				)
				if (
					(a === "Go to Settings" &&
						ki.commands.executeCommand(
							"workbench.action.openSettings",
							"@ext:augment.vscode-augment nextEdit.enableBackgroundSuggestions",
						),
					a !== "Disable")
				)
					return
			}
			await n.update(e.backgroundSuggestionsConfigKey, o, s)
		}
	},
	IF = class extends Xr {
		type = "public"
		static commandID = "vscode-augment.next-edit.toggle-all-highlights"
		constructor(t, r, n) {
			super(t, r, n, () =>
				this._configListener.config.nextEdit.highlightSuggestionsInTheEditor
					? "Turn Off All Line Highlights"
					: "Turn On All Line Highlights",
			)
		}
		canRun() {
			return super.canRun()
		}
		run() {
			this._extension.nextEditConfigManager.toggleSetting("highlightSuggestionsInTheEditor")
		}
	},
	h_ = class e extends Xr {
		type = "public"
		static commandID = "vscode-augment.next-edit.enable-bg"
		static backgroundSuggestionsConfigKey = "nextEdit.enableBackgroundSuggestions"
		constructor(t, r, n) {
			super(t, r, n, () => "Enable Background Suggestions", !0)
		}
		canRun() {
			return (
				super.canRun() &&
				this._extension.ready &&
				!this._configListener.config.nextEdit.enableBackgroundSuggestions
			)
		}
		async run() {
			let t = ki.workspace.getConfiguration("augment")
			if (t.get(e.backgroundSuggestionsConfigKey)) return
			let r = t.inspect(e.backgroundSuggestionsConfigKey),
				n = ki.ConfigurationTarget.Global
			r?.workspaceValue !== void 0 && (n = ki.ConfigurationTarget.Workspace),
				await t.update(e.backgroundSuggestionsConfigKey, !0, n)
		}
	},
	SF = class e extends Xr {
		type = "public"
		static commandID = "vscode-augment.next-edit.disable-bg"
		static backgroundSuggestionsConfigKey = "nextEdit.enableBackgroundSuggestions"
		constructor(t, r, n) {
			super(t, r, n, () => "Disable Background Suggestions", !0)
		}
		canRun() {
			return (
				super.canRun() &&
				this._extension.ready &&
				this._configListener.config.nextEdit.enableBackgroundSuggestions
			)
		}
		async run() {
			let t = ki.workspace.getConfiguration("augment")
			if (!t.get(h_.backgroundSuggestionsConfigKey)) return
			let r = t.inspect(e.backgroundSuggestionsConfigKey),
				n = ki.ConfigurationTarget.Global
			r?.workspaceValue !== void 0 && (n = ki.ConfigurationTarget.Workspace),
				await t.update(e.backgroundSuggestionsConfigKey, !1, n)
		}
	},
	BF = class e extends Xr {
		constructor(r, n, i, s) {
			super(r, n, i, e.title)
			this._globalState = s
		}
		static title = "Reset Next Edit Onboarding"
		static commandID = "_vscode-augment.next-edit.reset-onboarding"
		type = "debug"
		canRun() {
			return this._configListener.config.enableDebugFeatures && super.canRun()
		}
		async run() {
			await this._globalState.update("nextEditSuggestionSeen", void 0),
				await this._globalState.update("nextEditSuggestionAccepted", void 0),
				await this._globalState.update("nextEditKeybindingUsageCount", void 0),
				await this._globalState.update("nextEditUxMigrationStatus", void 0)
		}
	},
	DF = class extends Xr {
		static commandID = "vscode-augment.next-edit.settings"
		type = "public"
		constructor(t, r, n) {
			super(t, r, n, () => "Enable Background Suggestions", !1)
		}
		run() {
			ki.commands.executeCommand("workbench.action.openSettings", "@ext:augment.vscode-augment augment.nextEdit")
		}
	}