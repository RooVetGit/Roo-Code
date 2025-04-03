
var Xp = class e extends z {
	constructor(r, n) {
		super()
		this._config = r
		this._actionsModel = n
		this.addDisposable(
			Gs.workspace.onDidChangeConfiguration((i) => {
				;(i.affectsConfiguration("github.copilot") || i.affectsConfiguration("codeium")) &&
					this.checkAndUpdateState()
			}),
		),
			this.addDisposable(
				Gs.extensions.onDidChange(() => {
					this.checkAndUpdateState()
				}),
			)
	}
	logger = X("ConflictingExtensions")
	checkAndUpdateState() {
		if (this._config.config.conflictingCodingAssistantCheck === !1) {
			this._actionsModel.setSystemStateStatus("disabledGithubCopilot", "complete"),
				this._actionsModel.setSystemStateStatus("disabledCodeium", "complete")
			return
		}
		let n = [
			{
				check: () => e._checkGitHubCopilot(),
				stateName: "disabledGithubCopilot",
			},
			{ check: () => e._checkCodeium(), stateName: "disabledCodeium" },
		]
		for (let { check: i, stateName: s } of n) {
			let a = i().isConflicting ? "incomplete" : "complete"
			this._actionsModel.setSystemStateStatus(s, a)
		}
	}
	static _checkGitHubCopilot() {
		if (!Gs.extensions.getExtension(dgt)) return { extension: "copilot", isConflicting: !1 }
		let n = Gs.workspace.getConfiguration("github.copilot")
		return {
			extension: "copilot",
			isConflicting: (n.enable && n.enable["*"]) || !1,
		}
	}
	static async disableGitHubCopilot() {
		try {
			let r = Gs.workspace.getConfiguration("github.copilot")
			await r.update("enable", { "*": !1 }, this.targetForConfig(r.inspect("enable")))
		} catch {
			Gs.commands.executeCommand("workbench.extensions.search", "@enabled GitHub Copilot")
		}
	}
	static _checkCodeium() {
		if (!Gs.extensions.getExtension(fgt)) return { extension: "codeium", isConflicting: !1 }
		let n = Gs.workspace.getConfiguration("codeium")
		return {
			extension: "codeium",
			isConflicting: (n.enableConfig && n.enableConfig["*"]) || !1,
		}
	}
	static async disableCodeium() {
		try {
			let r = Gs.workspace.getConfiguration("codeium")
			await r.update("enableConfig", { "*": !1 }, this.targetForConfig(r.inspect("enableConfig")))
		} catch {
			Gs.commands.executeCommand("workbench.extensions.search", "@enabled Codeium")
		}
	}
	static packageName(r, n) {
		return r.packageJSON.displayName || r.packageJSON.name || n
	}
	static targetForConfig(r) {
		return r && r.workspaceValue !== void 0 ? Gs.ConfigurationTarget.Workspace : Gs.ConfigurationTarget.Global
	}
}