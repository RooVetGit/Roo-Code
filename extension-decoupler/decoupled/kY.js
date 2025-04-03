
var nF = class extends lt {
		constructor(r, n, i) {
			super()
			this._extension = r
			this._extensionUri = n
			this._apiServer = i
		}
		static commandID = "vscode-augment.internal-dv.o"
		type = "public"
		run = async (...r) => {
			if (!this._extension.workspaceManager) throw new Error("No workspace manager")
			if (!this._extension.keybindingWatcher) throw new Error("No keybinding watcher")
			let [n, i, s] = r,
				o = Rbe(n)
			if (o === void 0) return
			if (o === null) return
			let a = _x(o),
				l = o.fsPath.replace(a.fsPath, ""),
				c = new Je(a.fsPath, l)
			Bn.createOrShow(
				{
					extensionUri: this._extensionUri,
					workspaceManager: this._extension.workspaceManager,
					apiServer: this._apiServer,
					keybindingWatcher: this._extension.keybindingWatcher,
					fuzzyFsSearcher: this._extension.fuzzyFsSearcher,
					fuzzySymbolSearcher: this._extension.fuzzySymbolSearcher,
				},
				{ document: await Qu.fromPathName(c, i), ...s },
			)
		}
		canRun() {
			return !0
		}
	},
	$y = class extends Jo {
		constructor(r, n, i, s, o) {
			super(o)
			this._extension = r
			this._extensionUri = n
			this._apiServer = i
			this._guidelinesWatcher = s
		}
		static commandID = "vscode-augment.internal-dv.i"
		type = "public"
		run = async (...r) => {
			if (!this._extension.workspaceManager) throw new Error("No workspace manager")
			if (!this._extension.keybindingWatcher) throw new Error("No keybinding watcher")
			let n = rf.window.activeTextEditor
			if (!n) {
				rf.window.showInformationMessage("No active editor.")
				return
			}
			if (yo(n.document.uri)) {
				rf.window.showInformationMessage("Code instructions are not supported in notebooks.")
				return
			}
			let [i, s, o] = r,
				a = Rbe(i)
			if (a === void 0) return
			if (a === null) return
			let l = _x(a),
				c = a.fsPath.replace(l.fsPath, ""),
				u = new Je(l.fsPath, c),
				f = await Qu.fromPathName(u, s),
				p = { ...o, document: f, guidelinesWatcher: this._guidelinesWatcher },
				g = n.selection
			;(p.instruction = {
				selection: {
					start: { line: g.start.line, character: g.start.character },
					end: { line: g.end.line, character: g.end.character },
				},
			}),
				Bn.createOrShow(
					{
						extensionUri: this._extensionUri,
						workspaceManager: this._extension.workspaceManager,
						apiServer: this._apiServer,
						keybindingWatcher: this._extension.keybindingWatcher,
						fuzzyFsSearcher: this._extension.fuzzyFsSearcher,
						fuzzySymbolSearcher: this._extension.fuzzySymbolSearcher,
					},
					p,
				)
		}
		canRun() {
			let r = this._extension.featureFlagManager.currentFlags,
				n = rf.window.activeTextEditor
			return !!(r.enableInstructions && n && !yo(n.document.uri))
		}
	},
	Yy = class extends lt {
		static commandID = "vscode-augment.internal-dv.aac"
		type = "public"
		constructor() {
			super()
		}
		run() {
			Bn.currentPanel && Bn.controller?.diffViewMessageHandler.acceptAllChunks()
		}
		canRun() {
			return !0
		}
	},
	/**
	 * Accept the focused chunk in the diff view.
	 *
	 * This command is used to accept the focused chunk in the diff view.
	 * It is used to accept the focused chunk when the user is in the
	 * `diffView` mode.
	 *
	 * @example
	 * {
	 *   "key": "ctrl+shift+a",
	 *   "command": "vscode-augment.internal-dv.afc"
	 * }
	 */
	Ky = class extends lt {
		static commandID = "vscode-augment.internal-dv.afc"
		type = "public"
		constructor() {
			super()
		}
		/**
		 * Run the command to accept the focused chunk in the diff view.
		 *
		 * This function is called when the command is executed.
		 */
		run() {
			Bn.currentPanel && Bn.controller?.diffViewMessageHandler.acceptFocusedChunk()
		}
		/**
		 * Check if the command can be run.
		 *
		 * This function is called when the command is registered.
		 *
		 * @returns {boolean} True if the command can be run, false otherwise.
		 */
		canRun() {
			return !0
		}
	},
	Jy = class extends lt {
		static commandID = "vscode-augment.internal-dv.rfc"
		type = "public"
		constructor() {
			super()
		}
		run() {
			Bn.currentPanel && Bn.controller?.diffViewMessageHandler.rejectFocusedChunk()
		}
		canRun() {
			return !0
		}
	},
	zy = class extends lt {
		static commandID = "vscode-augment.internal-dv.fpc"
		type = "public"
		constructor() {
			super()
		}
		run() {
			Bn.currentPanel && Bn.controller?.diffViewMessageHandler.focusPreviousChunk()
		}
		canRun() {
			return !0
		}
	},
	jy = class extends lt {
		static commandID = "vscode-augment.internal-dv.fnc"
		type = "public"
		constructor() {
			super()
		}
		run() {
			Bn.currentPanel && Bn.controller?.diffViewMessageHandler.focusNextChunk()
		}
		canRun() {
			return !0
		}
	},
	Zy = class extends lt {
		static commandID = "vscode-augment.internal-dv.c"
		type = "public"
		constructor() {
			super()
		}
		run() {
			Bn.currentPanel && Bn.currentPanel.dispose()
		}
		canRun() {
			return !0
		}
	}