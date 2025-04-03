
var VF = class e extends lt {
	constructor(r, n) {
		super(e.title)
		this._extension = r
		this._configListener = n
	}
	static title = "Clear Recent Editing History"
	static commandID = "vscode-augment.clear-recent-editing-history"
	type = "public"
	run() {
		this._extension.clearFileEdits()
	}
	canRun() {
		return (
			super.canRun() &&
			this._extension.ready &&
			Rl(this._configListener.config, this._extension.featureFlagManager.currentFlags.vscodeNextEditMinVersion)
		)
	}
}