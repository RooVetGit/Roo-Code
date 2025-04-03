
var gC = class e extends z {
	constructor(r, n, i) {
		super()
		this._workspaceManager = r
		this._webview = n
		this._featureFlagManager = i
		;(this._asyncMsgHandler = Ti(this._webview)),
			this.addDisposable(
				this._featureFlagManager.subscribe(["enableWorkspaceManagerUi"], this._registerAllHandlers.bind(this)),
			),
			this._registerAllHandlers()
	}
	_logger = X("WorkspaceUIModel")
	_asyncMsgHandler
	_registerAllHandlers() {
		this._featureFlagManager.currentFlags.enableWorkspaceManagerUi &&
			(this._setupWorkspaceListeners(),
			this.addDisposable(this._asyncMsgHandler),
			this.addDisposable(this._webview.onDidReceiveMessage(this.onDidReceiveMessage)),
			this._asyncMsgHandler.registerHandler(
				"ws-context-get-source-folders-request",
				this.getSourceFoldersHandler,
			),
			this._asyncMsgHandler.registerHandler("ws-context-get-children-request", this.getChildrenHandler))
	}
	_setupWorkspaceListeners() {
		this.addDisposable(
			this._workspaceManager.onDidChangeSourceFolders(
				(0, zG.default)(
					() => {
						this._webview.postMessage({
							type: "ws-context-source-folders-changed",
						})
					},
					500,
					{ leading: !0, trailing: !0 },
				),
			),
		),
			this.addDisposable(
				this._workspaceManager.onDidChangeSourceFolderContents(
					(0, zG.default)(
						(r) => {
							this._webview.postMessage({
								type: "ws-context-folder-contents-changed",
								data: r,
							})
						},
						500,
						{ leading: !0, trailing: !0 },
					),
				),
			)
	}
	getSourceFoldersHandler = () => {
		let r = this._workspaceManager.listSourceFolders().sort((n, i) => n.name.localeCompare(i.name))
		return {
			type: "ws-context-get-source-folders-response",
			data: { workspaceFolders: r.map(e.makeWSContextSourceFolder) },
		}
	}
	getChildrenHandler = (r) => {
		let n = this._workspaceManager
			.listChildren(r.data.fileId.folderRoot, r.data.fileId.relPath)
			.sort((i, s) => i.name.localeCompare(s.name))
		return {
			type: "ws-context-get-children-response",
			data: { children: n.map(e.makeWSContextFileItem) },
		}
	}
	static getInclusionState(r) {
		return r.included ? (r.type === "Directory" && r.containsExcludedItems ? "partial" : "included") : "excluded"
	}
	static makeWSContextFileItem = (r) => ({
		name: r.name,
		fileId: { folderRoot: r.folderRoot, relPath: r.relPath },
		type: r.type === "Directory" ? "folder" : "file",
		inclusionState: e.getInclusionState(r),
		reason: r.reason,
		trackedFileCount: r.type === "Directory" ? r.trackedFileCount : void 0,
	})
	static makeWSContextSourceFolder = (r) => ({
		name: r.name,
		fileId: { folderRoot: r.folderRoot, relPath: "" },
		inclusionState: r.containsExcludedItems ? "partial" : "included",
		isWorkspaceFolder: r.type === 0 || r.type === 2,
		isNestedFolder: r.type === 2 || r.type === 3,
		isPending: r.enumerationState === 0,
		trackedFileCount: r.type === 0 || r.type === 1 ? r.trackedFileCount : void 0,
	})
	onDidReceiveMessage = async (r) => {
		switch ((this._logger.debug(`Extension received message: ${r.type}`), r.type)) {
			case "ws-context-add-more-source-folders": {
				let n = await h1.window.showOpenDialog({
					canSelectFolders: !0,
					canSelectFiles: !1,
					canSelectMany: !0,
					openLabel: "Add Source Folder",
				})
				if (n && n.length > 0) {
					let i = n
						.map((s) => {
							try {
								return this._workspaceManager.addExternalSourceFolder(s), null
							} catch (o) {
								return (
									this._logger.error("Failed to add source folder:", o),
									o instanceof Error
										? { path: s.fsPath, message: o.message }
										: { path: s.fsPath, message: String(o) }
								)
							}
						})
						.filter((s) => s !== null)
					i.length > 0 &&
						h1.window.showErrorMessage(
							`One or more source folders could not be added:
` +
								i.map((s) => `${s.path}: ${s.message}`).join(`
`),
						)
				}
				break
			}
			case "ws-context-remove-source-folder": {
				try {
					this._workspaceManager.removeExternalSourceFolder(r.data)
				} catch (n) {
					let i = n
					n instanceof Error && (i = n.message),
						this._logger.error("Failed to remove source folder:", i),
						h1.window.showErrorMessage(`Failed to remove source folder ${r.data}:
 ${String(i)}`)
				}
				break
			}
			case "ws-context-user-requested-refresh": {
				this._workspaceManager.refreshSourceFolders()
				break
			}
		}
	}
}