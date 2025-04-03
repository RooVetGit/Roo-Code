
var OF = class {
		constructor(t, r) {
			this.platform = t
			this.keybindings = r
		}
	},
	kc = class e extends z {
		constructor(r) {
			super()
			this._globalState = r
			if (((this.defaultKeybindings = this.getDefaultKeybindings()), !this.isRemote && !this.isWeb)) {
				this.platform = axe.default.platform()
				let n = eCe()
				if (n) {
					let i = lxe.default.join(n, e.keybindingFileName)
					;(this.userKeybindings = this.getUserKeybindings(i)),
						(this.watcher = UF.default.watch(n, (s, o) => {
							o === e.keybindingFileName &&
								(e._logger.info(`keybindings file changed: ${s} ${o}`),
								(this.userKeybindings = this.getUserKeybindings(i)))
						})),
						this.addDisposable({
							dispose: () => {
								this.watcher?.close()
							},
						})
				}
			} else {
				let n = this._globalState.get("userKeybindingInfo")
				;(this.platform = n?.platform),
					(this.userKeybindings = n?.keybindings ?? {}),
					this.addDisposable(
						kl.workspace.onDidSaveTextDocument((i) => {
							i.uri.scheme === "vscode-userdata" &&
								i.fileName.endsWith(e.keybindingFileName) &&
								((this.platform = this.getPlatformFromFilename(i.fileName)),
								(this.userKeybindings = this.getUserKeybindingsFromJSON(i.fileName, i.getText())),
								this._globalState.update(
									"userKeybindingInfo",
									new OF(this.platform, this.userKeybindings),
								))
						}),
					),
					setTimeout(() => {
						this.tryToFindPlatformAndUserKeybindings()
					}, e.remoteHeuristicDelayMs)
			}
		}
		static remoteHeuristicDelayMs = 1e3 * 5
		static _logger = X("KeybindingWatcher")
		static keybindingFileName = "keybindings.json"
		isRemote = kl.env.remoteName !== void 0
		isWeb = kl.env.uiKind === kl.UIKind.Web
		platform
		watcher
		defaultKeybindings = {}
		userKeybindings = {}
		async tryToFindPlatformAndUserKeybindings() {
			if (this.isRemote && this.platform === void 0) {
				let n = (
						await kl.workspace.openTextDocument(kl.Uri.from({ scheme: "output", path: "exthost" }))
					).getText(),
					i = /Skipping acquiring lock for (.*)\./,
					s = n.match(i)
				if (s) {
					e._logger.debug("Loading user keybindings")
					let a = s[1].replace(/workspaceStorage.*/, e.keybindingFileName)
					this.platform = this.getPlatformFromFilename(a)
					let l = await kl.workspace.openTextDocument(kl.Uri.from({ scheme: "vscode-userdata", path: a }))
					;(this.userKeybindings = this.getUserKeybindingsFromJSON(l.fileName, l.getText())),
						this._globalState.update("userKeybindingInfo", new OF(this.platform, this.userKeybindings))
				}
			}
		}
		getKeybindingForCommand(r, n = !1) {
			let i = this.userKeybindings[r]
			if (!i) {
				if (this.userKeybindings["-" + r]) return
				let o = this.defaultKeybindings[r]
				o && (this.platform !== void 0 || o.key === o.mac) && (i = o)
			}
			let s
			return i
				? (this.platform === void 0
						? (s = Array.from(new Set([i.key, i.mac]))
								.filter((o) => o !== void 0)
								.join("/"))
						: this.platform === "darwin" && i.mac
							? (s = i.mac)
							: (s = i.key),
					n ? e.formatKeyboardShortcut(s, this.getSimplifiedPlatform()) : s)
				: null
		}
		static getStructuredKeybinding(r) {
			try {
				if (!r) return null
				let n = PF.parseKeybinding(r)
				return n ? new GG(n.chords) : null
			} catch (n) {
				return this._logger.warn(`error parsing keybinding ${r}`, n), null
			}
		}
		static formatKeyboardShortcut(r, n) {
			try {
				let i = e.getStructuredKeybinding(r)
				return i ? i.toPrettyString(n) : ""
			} catch (i) {
				return this._logger.warn("error formatting keybinding, returning unformatted keybinding.", i), r || ""
			}
		}
		getSimplifiedPlatform() {
			return this.platform === "darwin" ? "darwin" : this.platform === "win32" ? "win32" : "linux"
		}
		getDefaultKeybindings() {
			let r = Qy()
			if (r && r.contributes && r.contributes.keybindings) {
				let { keybindings: n } = r.contributes
				return Object.fromEntries(n.map((i) => [i.command, i]))
			}
			return {}
		}
		getUserKeybindings(r) {
			if (UF.default.existsSync(r)) {
				let n = UF.default.readFileSync(r, "utf8")
				return this.getUserKeybindingsFromJSON(r, n)
			}
			return {}
		}
		getUserKeybindingsFromJSON(r, n) {
			try {
				let i = oxe.default.parse(n)
				return Object.fromEntries(i.map((s) => [s.command, s]))
			} catch (i) {
				return e._logger.debug(`Failed to parse '${r}': ${i.message}`), {}
			}
		}
		getPlatformFromFilename(r) {
			return r.startsWith("/Users/") ? "darwin" : r.match(/^\/?[a-zA-Z](?::|%3A)\/.*/) ? "win32" : "linux"
		}
	},
	LF = {
		meta: { darwin: "\u2318", win32: "Win", linux: "Meta" },
		ctrl: { darwin: "\u2303", win32: "Ctrl", linux: "Ctrl" },
		alt: { darwin: "\u2325", win32: "Alt", linux: "Alt" },
		shift: "\u21E7",
	},
	sxe = {
		Enter: "\u23CE",
		UpArrow: "\u2191",
		DownArrow: "\u2193",
		Backspace: "\u232B",
		Escape: "Esc",
	},
	GG = class extends gA {
		constructor(t) {
			super(t)
		}
		toPrettyString(t) {
			let r = []
			for (let n of this.chords) {
				let i = []
				n.ctrlKey && i.push(LF.ctrl[t]),
					n.shiftKey && i.push(LF.shift),
					n.altKey && i.push(LF.alt[t]),
					n.metaKey && i.push(LF.meta[t])
				let s
				n instanceof uC ? (s = m_.toString(n.keyCode)) : (s = QF.toString(n.scanCode)),
					s in sxe && (s = sxe[s]),
					(s = s.charAt(0).toUpperCase() + s.substring(1).toLowerCase()),
					i.push(s),
					i.join("").length <= 2 || t === "darwin" ? r.push(i.join("")) : r.push(i.join("+"))
			}
			return r.indexOf("Unknown") !== -1 ? "" : r.join(" ").trim()
		}
	}