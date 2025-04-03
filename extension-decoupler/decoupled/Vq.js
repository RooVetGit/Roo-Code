
var VQ = class e extends z {
	constructor(r) {
		super()
		this._workspaceStorage = r
		;(this._currentPermission = this._getStoredPermission()),
			(this._persister = new Ku(async () => await this._persistCurrentPermission())),
			this._logPermission("Initial syncing permission", this._currentPermission)
	}
	static storageKey = "syncingPermission.2024102300"
	_currentPermission
	_persister
	_logger = X("SyncingPermissionTracker")
	get syncingPermissionDenied() {
		return this._currentPermission?.state === 1
	}
	getFolderSyncingPermission(r) {
		let n = this._currentPermission
		if (n === void 0)
			return (
				this._logger.info(`Permission to sync folder ${r} unknown: no permission information recorded`),
				"unknown"
			)
		if (n.state === 1) {
			let i = new Date(n.timestamp).toLocaleString()
			return this._logger.info(`Permission to sync folder ${r} denied at ${i}`), "denied"
		}
		for (let i of n.permittedFolders)
			if (r === i.sourceFolder) {
				let s = new Date(i.timestamp).toLocaleString()
				return this._logger.info(`Permission to sync folder ${r} granted at ${s}; type = ${i.type}`), "granted"
			}
		return this._logger.info(`Permission to sync folder ${r} unknown: no current permission for folder`), "unknown"
	}
	setDefaultPermissions(r) {
		if (this._currentPermission !== void 0 || r.length === 0) return
		let n = Date.now()
		this._setSyncingPermission({
			state: 0,
			permittedFolders: r.map((i) => ({
				sourceFolder: i,
				type: "implicit",
				timestamp: n,
			})),
		})
	}
	setPermittedFolders(r) {
		let n = Date.now()
		this._setSyncingPermission({
			state: 0,
			permittedFolders: r.map((i) => ({
				sourceFolder: i,
				type: "explicit",
				timestamp: n,
			})),
		})
	}
	addPermittedFolder(r) {
		let n = this._currentPermission
		;(n === void 0 || n.state === 1) && (n = { state: 0, permittedFolders: [] })
		let i = { sourceFolder: r, type: "explicit", timestamp: Date.now() }
		this._setSyncingPermission({
			...n,
			permittedFolders: [...n.permittedFolders, i],
		})
	}
	addImplicitlyPermittedFolder(r) {
		let n = this._currentPermission
		if (n?.state === 1) return
		if (n === void 0) n = { state: 0, permittedFolders: [] }
		else if (n.permittedFolders.find((o) => o.sourceFolder === r) !== void 0) return
		let i = { sourceFolder: r, type: "implicit", timestamp: Date.now() }
		this._setSyncingPermission({
			...n,
			permittedFolders: [...n.permittedFolders, i],
		})
	}
	dropPermission(r) {
		if (r.length === 0 || this._currentPermission === void 0 || this._currentPermission.state === 1) return
		let n = this._currentPermission.permittedFolders.filter((i) => !r.includes(i.sourceFolder))
		this._setSyncingPermission({
			...this._currentPermission,
			permittedFolders: n,
		})
	}
	dropStaleFolders(r) {
		if (this._currentPermission === void 0 || this._currentPermission.state === 1) return
		let n = this._currentPermission.permittedFolders.filter((i) => r.includes(i.sourceFolder))
		this._setSyncingPermission({
			...this._currentPermission,
			permittedFolders: n,
		})
	}
	denyPermission() {
		this._setSyncingPermission({ state: 1, timestamp: Date.now() })
	}
	_getStoredPermission() {
		return this._workspaceStorage.get(e.storageKey)
	}
	_setSyncingPermission(r) {
		;(this._currentPermission = r), this._logPermission("Updating syncing permission", r), this._persister.kick()
	}
	async persistCurrentPermission() {
		await this._persister.kick()
	}
	async _persistCurrentPermission() {
		await this._workspaceStorage.update(e.storageKey, this._currentPermission)
	}
	_logPermission(r, n) {
		if (n === void 0) {
			this._logger.info(`${r}: undefined`)
			return
		}
		if (n.state === 1) {
			let s = new Date(n.timestamp).toLocaleString()
			this._logger.info(`${r}: syncing permission denied for workspace at ${s}`)
			return
		}
		let i =
			n.permittedFolders.length === 0
				? "none"
				: n.permittedFolders
						.map((s) => {
							let o = new Date(s.timestamp).toLocaleString()
							return `
    ${s.sourceFolder} (${s.type}) at ${o}`
						})
						.join("")
		this._logger.info(`${r}: syncing permission granted for workspace. Folders:${i}`)
	}
}