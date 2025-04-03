
var U1 = class extends z {
	constructor(r, n) {
		super()
		this._workspaceManager = r
		this._featureFlagManager = n
	}
	_workspaceUiModel = null
	appType() {
		return "workspace-context"
	}
	title() {
		return "Workspace Context"
	}
	register(r) {
		this._workspaceUiModel?.dispose(),
			this._featureFlagManager.currentFlags.enableWorkspaceManagerUi &&
				((this._workspaceUiModel = new gC(this._workspaceManager, r, this._featureFlagManager)),
				this.addDisposable(this._workspaceUiModel))
	}
}