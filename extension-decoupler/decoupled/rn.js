
/**
 * RN class extends the base class z and manages the workspace state.
 * 
 * This class is responsible for checking if a workspace is selected and populated.
 * It interacts with the actions model to update the system state status based on the 
 * current workspace conditions. The class provides methods to initialize the workspace 
 * state, check if any files exist in the workspace, and update the status accordingly.
 */
var RN = class extends z {
	constructor(r, n) {
		super()
		this.actionsModel = r
		this.workspaceManager = n
		this.setInitializing(), this.addDisposable(n), this.checkWorkspaceSelected(), this.checkWorkspacePopulated()
	}
	checkWorkspaceSelected() {
		!!wwe.workspace.workspaceFolders?.length ? this._setWorkspaceSelected() : this._setWorkspaceNotSelected()
	}
	async checkWorkspacePopulated() {
		if ((await this.workspaceManager.awaitInitialFoldersEnumerated(), this._anyFilesExist())) {
			this._setWorkspacePopulated()
			return
		}
		for (this._setWorkspaceEmpty(); !this._anyFilesExist(); )
			await $p(this.workspaceManager.onDidChangeSyncingProgress)
		this._setWorkspacePopulated()
	}
	_anyFilesExist() {
		return !!this.workspaceManager
			.getSyncingProgress()
			.some((n) => n.progress?.trackedFiles !== void 0 && n.progress.trackedFiles > 0)
	}
	setInitializing() {
		this.actionsModel.setSystemStateStatus("workspacePopulated", "initializing"),
			this.actionsModel.setSystemStateStatus("workspaceSelected", "initializing")
	}
	_setWorkspaceEmpty() {
		this.actionsModel.setSystemStateStatus("workspacePopulated", "incomplete")
	}
	_setWorkspacePopulated() {
		this.actionsModel.setSystemStateStatus("workspacePopulated", "complete")
	}
	_setWorkspaceSelected() {
		this.actionsModel.setSystemStateStatus("workspaceSelected", "complete")
	}
	_setWorkspaceNotSelected() {
		this.actionsModel.setSystemStateStatus("workspaceSelected", "incomplete")
	}
}