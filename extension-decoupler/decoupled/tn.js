/**
 * TN class extends the base class z and manages the synchronization of source folders.
 * It handles the configuration, syncing permissions, and events related to file changes
 * and folder management within a workspace.
 *
 * @param {Object} r - The actions model for managing system states.
 * @param {Object} n - The external source folder recorder.
 * @param {Object} i - The syncing permission tracker.
 * @param {Object} s - The storage URI provider.
 * @param {Object} o - The API server instance.
 * @param {Object} a - The configuration listener.
 * @param {Object} l - The feature flag manager.
 * @param {Object} c - The client metrics reporter.
 * @param {Object} u - The completion server.
 * @param {Object} f - The blob name calculator.
 * @param {number} p - The maximum upload size in bytes.
 * @param {Object} g - The syncing enabled tracker.
 * @param {Object} m - The onboarding session event reporter.
 * @param {Array} [y=new Array()] - An array of source folder configurations.
 * @param {Object} C - Additional configuration options.
 */
var TN = class e extends z {
	constructor(r, n, i, s, o, a, l, c, u, f, p, g, m, y = new Array(), C) {
		super()
		this._actionsModel = r
		this._externalSourceFolderRecorder = n
		this._syncingPermissionTracker = i
		this._storageUriProvider = s
		this._apiServer = o
		this._configListener = a
		this._featureFlagManager = l
		this._clientMetricsReporter = c
		this._completionServer = u
		this._blobNameCalculator = f
		this._maxUploadSizeBytes = p
		this._syncingEnabledTracker = g
		this._onboardingSessionEventReporter = m
		;(this._enableFileLimitsForSyncingPermission =
			this._featureFlagManager.currentFlags.enableFileLimitsForSyncingPermission),
			(this._maxTrackableFiles = this._featureFlagManager.currentFlags.maxTrackableFileCount),
			(this._maxTrackableFilesWithoutPermission = Math.min(
				this._featureFlagManager.currentFlags.maxTrackableFileCountWithoutPermission,
				this._maxTrackableFiles,
			))
		let v = Math.min(this._featureFlagManager.currentFlags.minUploadedPercentageWithoutPermission, 100)
		if (
			((this._verifyFolderIsSourceRepo = this._featureFlagManager.currentFlags.verifyFolderIsSourceRepo),
			(this._minUploadedFractionWithoutPermission = v * 0.01),
			(this._refuseToSyncHomeDirectories = this._featureFlagManager.currentFlags.refuseToSyncHomeDirectories),
			(this._useCheckpointManagerContext =
				C?.useCheckpointManagerContext ??
				Gr(this._featureFlagManager.currentFlags.useCheckpointManagerContextMinVersion)),
			(this._validateCheckpointManagerContext =
				this._featureFlagManager.currentFlags.validateCheckpointManagerContext),
			(this._folderEnumeratedEmitter = this.addDisposable(new Ot.EventEmitter())),
			(this._folderSyncedEmitter = this.addDisposable(new Ot.EventEmitter())),
			(this._syncingProgressEmitter = this.addDisposable(new Ot.EventEmitter())),
			(this._syncingStateEmitter = this.addDisposable(new Ot.EventEmitter())),
			(this._sourceFoldersChangedEmitter = this.addDisposable(new Ot.EventEmitter())),
			(this._sourceFolderContentsChangedEmitter = this.addDisposable(new Ot.EventEmitter())),
			(this._sourceFolderContentsChangedEmitter = this.addDisposable(new Ot.EventEmitter())),
			(this._fileChangedEmitter = this.addDisposable(new Ot.EventEmitter())),
			(this._textDocumentOpenedEmitter = this.addDisposable(new Ot.EventEmitter())),
			(this._textDocumentClosedEmitter = this.addDisposable(new Ot.EventEmitter())),
			(this._textDocumentChangedEmitter = this.addDisposable(new Ot.EventEmitter())),
			(this._fileDeletedEmitter = this.addDisposable(new Ot.EventEmitter())),
			(this._fileWillRenameEmitter = this.addDisposable(new Ot.EventEmitter())),
			this._featureFlagManager.currentFlags.bypassLanguageFilter)
		)
			this._fileExtensions = void 0
		else {
			let M = new Set()
			for (let Q of y) for (let O of Q.extensions) M.add(O)
			this._fileExtensions = M
		}
		;(this._pathHandler = new bN(this._maxUploadSizeBytes, H_e())), (this._pathMap = this.addDisposable(new _N()))
		let b
		if (this._configListener.config.openFileManager.v2Enabled) {
			let M = new dN(this._blobNameCalculator, this._apiServer)
			this.addDisposable(M), (b = new hN(M, this._blobNameCalculator))
		}
		let w = new EN(
			this._apiServer,
			this._completionServer,
			this._configListener,
			this._blobNameCalculator,
			this._pathMap,
			this._sequenceGenerator,
		)
		this.addDisposable(w), (this._openFileManager = new oN(this._configListener, w, b))
		let B = C?.blobsCheckpointThreshold
		;(this._blobsCheckpointManager = this.addDisposable(
			new AN(this._apiServer, this._featureFlagManager, this._pathMap.onDidChangeBlobName, B),
		)),
			(this._unknownBlobHandler = this.addDisposable(new DN(this._apiServer, this))),
			(this._sourceFolderReconciler = this.addDisposable(new Ku(() => this._reconcileSourceFolders()))),
			(this._sourceFolderDescriber = new IN(
				this._apiServer,
				this._pathHandler,
				this._fileExtensions,
				this._maxTrackableFiles,
			)),
			this.addDisposable(
				Ot.workspace.onDidChangeWorkspaceFolders(this._handleWorkspaceFolderChangeEvent.bind(this)),
			),
			this.addDisposable(Ot.workspace.onDidChangeTextDocument(this._notifyTextDocumentChanged.bind(this))),
			this.addDisposable(Ot.workspace.onDidOpenTextDocument(this._notifyTextDocumentOpened.bind(this))),
			this.addDisposable(Ot.workspace.onDidCloseTextDocument(this._notifyTextDocumentClosed.bind(this))),
			this.addDisposable(
				Ot.workspace.onDidChangeNotebookDocument(this._notifyNotebookDocumentChanged.bind(this)),
			),
			this.addDisposable(Ot.window.onDidChangeActiveTextEditor(this._notifyActiveEditorChanged.bind(this))),
			this.addDisposable(
				Ot.workspace.onDidCloseTextDocument((M) => {
					this._notifyDocumentClosed(M)
				}),
			),
			this.addDisposable(
				Ot.workspace.onDidCloseNotebookDocument((M) => {
					this._notifyDocumentClosed(M)
				}),
			),
			this.addDisposable(
				Ot.workspace.onWillRenameFiles((M) => {
					this._notifyWillRenameFile(M)
				}),
			),
			this.addDisposable(this._configListener.onDidChange(this._notifyConfigChange.bind(this))),
			this._notifyConfigChange(),
			this.addDisposable(new Ot.Disposable(() => this._disposeSourceFolders())),
			this.addDisposable(new Ot.Disposable(() => this._disposeTabWatcher())),
			this._actionsModel.setSystemStateStatus("syncingPermitted", "complete"),
			this._actionsModel.setSystemStateStatus("workspaceTooLarge", "initializing"),
			this._actionsModel.setSystemStateStatus("uploadingHomeDir", "initializing"),
			this._registerInitialSourceFolders(),
			this._awaitInitialSourceFolders()
	}
	static augmentRootName = ".augmentroot"
	static ignoreSources(r) {
		return [new L_(".gitignore"), new KQ(r), new L_(".augmentignore")]
	}
	static pathMapPersistFrequencyMs = 6e4
	static defaultPathAccept = new lg()
	static _textEncoder = new TextEncoder()
	_initialSourceFolders = new Set()
	_registeredSourceFolders = new Map()
	_trackedSourceFolders = new Map()
	_fileExtensions
	_pathMap
	_sequenceGenerator = new XQ()
	_pathHandler
	_openFileManager
	_blobsCheckpointManager
	_unknownBlobHandler
	_sourceFolderDescriber
	_logger = X("WorkspaceManager")
	_tabWatcher
	_vcsWatcher
	_fileEditManager
	_folderEnumeratedEmitter
	_folderSyncedEmitter
	_syncingProgressEmitter
	_syncingPermissionInitialized = !1
	_sourceFolderReconciler
	_syncingStateEmitter
	_sourceFoldersChangedEmitter
	_sourceFolderContentsChangedEmitter
	_fileChangedEmitter
	_textDocumentOpenedEmitter
	_textDocumentClosedEmitter
	_textDocumentChangedEmitter
	_fileDeletedEmitter
	_fileWillRenameEmitter
	_lastChatResponse = void 0
	_enableFileLimitsForSyncingPermission
	_maxTrackableFiles
	_maxTrackableFilesWithoutPermission
	_verifyFolderIsSourceRepo
	_minUploadedFractionWithoutPermission
	_refuseToSyncHomeDirectories
	_useCheckpointManagerContext
	_validateCheckpointManagerContext
	_stopping = !1
	dispose() {
		;(this._stopping = !0), super.dispose()
	}
	get enableFileLimitsForSyncingPermission() {
		return this._enableFileLimitsForSyncingPermission
	}
	get maxTrackableFiles() {
		return this._maxTrackableFiles
	}
	get maxTrackableFilesWithoutPermission() {
		return this._maxTrackableFilesWithoutPermission
	}
	get verifyFolderIsSourceRepo() {
		return this._verifyFolderIsSourceRepo
	}
	get minUploadedFractionWithoutPermission() {
		return this._minUploadedFractionWithoutPermission
	}
	get refuseToSyncHomeDirectories() {
		return this._refuseToSyncHomeDirectories
	}
	get initialFoldersEnumerated() {
		return Array.from(this._initialSourceFolders).every((r) => {
			let n = this._registeredSourceFolders.get(r)
			if (n === void 0) return !0
			let i = Pa(n)
			return K_(i) || _we(i) || i === "permission denied"
				? !0
				: this._trackedSourceFolders.get(r)?.sourceFolder?.initialEnumerationComplete
		})
	}
	async awaitInitialFoldersEnumerated() {
		for (; !this.initialFoldersEnumerated; ) await $p(this._folderEnumeratedEmitter.event)
	}
	get onDidEnumerateFolder() {
		return this._folderEnumeratedEmitter.event
	}
	get initialFoldersSynced() {
		return Array.from(this._initialSourceFolders).every((r) => {
			let n = this._registeredSourceFolders.get(r)
			if (n === void 0) return !0
			let i = Pa(n)
			return K_(i) || _we(i) || i === "permission denied"
				? !0
				: this._trackedSourceFolders.get(r)?.sourceFolder?.initialSyncComplete
		})
	}
	async awaitInitialFoldersSynced() {
		for (; !this.initialFoldersSynced; ) await $p(this._folderSyncedEmitter.event)
	}
	get onDidChangeSyncingProgress() {
		return this._syncingProgressEmitter.event
	}
	get syncingEnabledState() {
		if (!this._syncingPermissionInitialized) return "initializing"
		if (this._syncingPermissionTracker.syncingPermissionDenied) return "disabled"
		let r = 0
		for (let [n, i] of this._registeredSourceFolders) {
			let s = Pa(i)
			if (K_(s) || s === "permission denied") return "disabled"
			s === "permission needed" && r++
		}
		return r > 0 ? "partial" : "enabled"
	}
	get onDidChangeSyncingState() {
		return this._syncingStateEmitter.event
	}
	get onDidChangeSourceFolders() {
		return this._sourceFoldersChangedEmitter.event
	}
	get onDidChangeSourceFolderContents() {
		return this._sourceFolderContentsChangedEmitter.event
	}
	get onDidChangeFile() {
		return this._fileChangedEmitter.event
	}
	get completionServer() {
		return this._completionServer
	}
	_disposeSourceFolders() {
		this._registeredSourceFolders.forEach((r) => {
			r.cancel?.cancel(), r.cancel?.dispose(), (r.cancel = void 0)
		}),
			this._trackedSourceFolders.forEach((r) => r.sourceFolder?.dispose()),
			this._trackedSourceFolders.clear(),
			this._vcsWatcher?.dispose(),
			this._fileEditManager?.dispose()
	}
	_disposeTabWatcher() {
		this._tabWatcher?.dispose(), (this._tabWatcher = void 0)
	}
	_disposeVCSWatcher() {
		this._vcsWatcher?.dispose(), (this._vcsWatcher = void 0)
	}
	_disposeEditFileManager() {
		this._fileEditManager?.dispose(), (this._fileEditManager = void 0)
	}
	_notifyConfigChange() {
		this._stopping ||
			(this._configListener.config.recencySignalManager.collectTabSwitchEvents
				? this._tabWatcher === void 0 && (this._tabWatcher = new BN(this))
				: this._disposeTabWatcher(),
			this._configListener.config.vcs.watcherEnabled
				? this._vcsWatcher === void 0 &&
					(this._vcsWatcher = new sN(
						new _A.FileUploaderImpl(this._blobNameCalculator, this._apiServer),
						this._configListener,
					))
				: this._disposeVCSWatcher(),
			Rl(this._configListener.config, this._featureFlagManager.currentFlags.vscodeNextEditMinVersion) ||
			this.getEnableCompletionFileEditEvents()
				? this._fileEditManager === void 0 &&
					((this._fileEditManager = new Q_(
						this._blobNameCalculator,
						this._maxUploadSizeBytes,
						this._textDocumentChangedEmitter.event,
						this._textDocumentOpenedEmitter.event,
						this._textDocumentClosedEmitter.event,
						this._fileDeletedEmitter.event,
						this._fileWillRenameEmitter.event,
						this._configListener.config.enableDebugFeatures,
					)),
					this._fileEditManager.listenToEvents(),
					this._trackedSourceFolders.forEach((r) => {
						r.sourceFolder !== void 0 &&
							this._fileEditManager?.startTracking(r.sourceFolder.folderId, r.sourceFolder.folderName, {
								directory: this._computeCacheDirPath(r.sourceFolder.folderRoot),
							})
					}))
				: this._disposeEditFileManager())
	}
	getSyncingProgress() {
		let r = new Array()
		return (
			this._trackedSourceFolders.forEach((n, i) => {
				r.push(this._getSyncingProgress(i, n.sourceFolder))
			}),
			r
		)
	}
	_reportSyncingProgress(r) {
		this._syncingProgressEmitter.fire(this._getSyncingProgress(r.folderRoot, r))
	}
	_getSyncingProgress(r, n) {
		let i = n?.initialEnumerationComplete
			? {
					newlyTracked: n._newlyTracked,
					trackedFiles: this._pathMap.trackedFileCount(n.folderId),
					backlogSize: n.diskFileManager.itemsInFlight,
				}
			: void 0
		return { folderRoot: r, progress: i }
	}
	_isHomeDir(r) {
		return this._featureFlagManager.currentFlags.refuseToSyncHomeDirectories ? swe(r) : !1
	}
	_registerInitialSourceFolders() {
		let r = new Array()
		Ot.workspace.workspaceFolders?.forEach((i) => {
			let s = Y_(i.uri)
			s !== void 0 && this._mtimeCacheExists(s) && r.push(s)
		}),
			this._syncingPermissionTracker.setDefaultPermissions(r),
			this._externalSourceFolderRecorder.getFolders().forEach((i, s) => {
				if (this._isHomeDir(s)) {
					this._logger.info(`Rejecting external source folder ${s}: home directory`)
					return
				}
				this._logger.info(`Adding external source folder ${s}`),
					this._initialSourceFolders.add(s),
					this._registeredSourceFolders.set(s, {
						folderName: i,
						isHomeDir: !1,
						folderType: 1,
						syncingPermission: this._syncingPermissionTracker.syncingPermissionDenied
							? "denied"
							: "granted",
					})
			})
		let n = new Array()
		Ot.workspace.workspaceFolders?.forEach((i) => {
			let s = i.name,
				o = Y_(i.uri)
			if (o === void 0) return
			let a = this._syncingPermissionTracker.getFolderSyncingPermission(o)
			this._logger.info(`Adding workspace folder ${s}; folderRoot = ${o}; syncingPermission = ${a}`),
				this._initialSourceFolders.add(o),
				this._registeredSourceFolders.set(o, {
					folderName: s,
					isHomeDir: this._isHomeDir(o),
					folderType: 0,
					syncingPermission: a,
					workspaceFolder: i,
				}),
				a === "granted" && n.push(o)
		}),
			this._syncingPermissionTracker.dropStaleFolders(n),
			this._setSyncingPermissionInitialized()
	}
	_mtimeCacheExists(r) {
		let n = this._computeCacheDirPath(r)
		return CN(n)
	}
	_setSyncingPermissionInitialized() {
		;(this._syncingPermissionInitialized = !0), (this._syncingEnabledTracker.workspaceManager = this)
	}
	async _awaitInitialSourceFolders() {
		let r = Date.now()
		this._kickSourceFolderReconciler(),
			await this.awaitInitialFoldersSynced(),
			this._reportWorkspaceStartup(Date.now() - r),
			this._folderSyncedEmitter.fire()
	}
	_handleWorkspaceFolderChangeEvent(r) {
		for (let i of r.added) {
			let s = i.name,
				o = Y_(i.uri)
			if (o === void 0) continue
			let a = this._syncingPermissionTracker.getFolderSyncingPermission(o)
			this._logger.info(`Adding workspace folder ${s}; folderRoot = ${o}; syncingPermission = ${a}`),
				this._registeredSourceFolders.set(o, {
					folderName: s,
					isHomeDir: this._isHomeDir(o),
					folderType: 0,
					syncingPermission: a,
					workspaceFolder: i,
				})
		}
		let n = new Array()
		for (let i of r.removed) {
			let s = Y_(i.uri)
			if (s === void 0) continue
			this._logger.info(`Removing workspace folder ${s}`)
			let o = this._registeredSourceFolders.get(s)
			o !== void 0 &&
				(o.cancel?.cancel(),
				o.cancel?.dispose(),
				(o.cancel = void 0),
				this._registeredSourceFolders.delete(s),
				n.push(s))
		}
		this._syncingPermissionTracker.dropPermission(n), this._kickSourceFolderReconciler()
	}
	addExternalSourceFolder(r) {
		let n = Y_(r)
		if (n === void 0) throw new aM()
		if (this._registeredSourceFolders.has(n)) throw new uM()
		try {
			if (Fh(n).type !== "Directory") throw new cM()
		} catch (i) {
			throw new lM(Ye(i))
		}
		if (this._isHomeDir(n)) throw new dM()
		this._logger.info(`Adding external source folder ${z1(r)}`),
			this._registeredSourceFolders.set(n, {
				folderName: dme(n),
				isHomeDir: !1,
				folderType: 1,
				syncingPermission: this._syncingPermissionTracker.syncingPermissionDenied ? "denied" : "granted",
			}),
			this._kickSourceFolderReconciler()
	}
	removeExternalSourceFolder(r) {
		let n = this._registeredSourceFolders.get(r)
		if (n !== void 0) {
			if (n.folderType !== 1) throw new fM()
			this._logger.info(`Removing external source folder ${r}`),
				this._registeredSourceFolders.delete(r),
				this._kickSourceFolderReconciler()
		}
	}
	enableSyncing() {
		this._logger.info("Enabling syncing for all trackable source folders")
		let r = new Array()
		this._registeredSourceFolders.forEach((n, i) => {
			let s = Pa(n)
			K_(s) || s === "qualifying" || ((n.syncingPermission = "granted"), r.push(i))
		}),
			this._syncingPermissionTracker.setPermittedFolders(r),
			this._kickSourceFolderReconciler()
	}
	disableSyncing() {
		this._logger.info("Disabling syncing for all trackable source folders"),
			this._registeredSourceFolders.forEach((r) => {
				let n = Pa(r)
				K_(n) || (r.syncingPermission = "denied")
			}),
			this._syncingPermissionTracker.denyPermission(),
			this._kickSourceFolderReconciler()
	}
	requalifyLargeFolders() {
		this._registeredSourceFolders.forEach((r) => {
			r.folderQualification = void 0
		}),
			this._kickSourceFolderReconciler()
	}
	async _kickSourceFolderReconciler() {
		await this._updateStoredExternalSourceFolders()
		let r = new Set()
		for (let [n, i] of this._registeredSourceFolders)
			if (Pa(i) === "trackable") {
				for (let [o, a] of this._registeredSourceFolders)
					if (Pa(a) === "trackable" && n !== o && Ss(o, n)) {
						r.add(n)
						break
					}
			}
		for (let [n, i] of this._registeredSourceFolders) {
			if (!r.has(n)) {
				i.containingFolderRoot = void 0
				continue
			}
			for (let s of this._registeredSourceFolders.keys())
				if (!(n === s || r.has(s)) && Ss(s, n)) {
					i.containingFolderRoot !== s &&
						this._logger.info(`Source folder ${n} will not be tracked. Containing folder: ${s}`),
						(i.containingFolderRoot = s)
					break
				}
		}
		this._updateActionsModelState()
		for (let [n, i] of this._registeredSourceFolders)
			Pa(i) === "qualifying" && i.cancel === void 0 && this._qualifySourceFolder(n, i)
		this._syncingStateEmitter.fire(this.syncingEnabledState),
			this._sourceFoldersChangedEmitter.fire(),
			this._sourceFolderReconciler.kick()
	}
	async _updateStoredExternalSourceFolders() {
		let r = new Map()
		for (let [n, i] of this._registeredSourceFolders) i.folderType === 1 && r.set(n, i.folderName)
		await this._externalSourceFolderRecorder.setFolders(r)
	}
	_updateActionsModelState() {
		if (this._syncingPermissionTracker.syncingPermissionDenied) {
			this._actionsModel.setSystemStateStatus("syncingPermitted", "incomplete")
			return
		}
		let r = !1,
			n = !1,
			i = !1
		for (let [l, c] of this._registeredSourceFolders) {
			let u = Pa(c)
			if (u === "permission needed") {
				r = !0
				break
			} else if (u === "home directory") {
				n = !0
				break
			} else if (u === "too large") {
				i = !0
				break
			}
		}
		let s = r ? "initializing" : "complete"
		this._actionsModel.setSystemStateStatus("syncingPermitted", s)
		let o = n ? "complete" : "initializing"
		this._actionsModel.setSystemStateStatus("uploadingHomeDir", o)
		let a = i ? "complete" : "initializing"
		this._actionsModel.setSystemStateStatus("workspaceTooLarge", a)
	}
	async _qualifySourceFolder(r, n) {
		let [i, s] = await this._findRepoRoot(r),
			o,
			a
		if (this._enableFileLimitsForSyncingPermission) {
			;(a = "full"), this._logger.info(`Beginning ${a} qualification of source folder ${r}`)
			let c = new Ot.CancellationTokenSource()
			if (
				((n.cancel = c),
				(o = await this._sourceFolderDescriber.describe(r, i, e.ignoreSources(r))),
				c.token.isCancellationRequested)
			) {
				this._logger.info(`Cancelled qualification of source folder ${r}`)
				return
			}
			;(n.cancel = void 0), c.dispose()
		} else
			(a = "phony"),
				this._logger.info(`Beginning ${a} qualification of source folder ${r} per feature flag`),
				(o = { trackable: !0, trackableFiles: 0, uploadedFraction: 1 })
		let l = { ...o, repoRoot: i, isRepo: s }
		;(n.folderQualification = l),
			this._syncingPermissionTracker.syncingPermissionDenied
				? this._logger.info(`Finished ${a} qualification of source folder ${r}: syncing disabled for workspace`)
				: l.trackable
					? (this._logger.info(
							`Finished ${a} qualification of source folder ${r}: trackable files: ${l.trackableFiles}, uploaded fraction: ${l.uploadedFraction}, is repo: ${l.isRepo}`,
						),
						l.trackableFiles > this._maxTrackableFilesWithoutPermission
							? this._logger.info(
									`Requesting syncing permission because source folder has more than ${this._maxTrackableFilesWithoutPermission} files`,
								)
							: this._verifyFolderIsSourceRepo && !l.isRepo
								? this._logger.info(
										"Requesting syncing permission because source folder does not appear to be a source repo",
									)
								: l.uploadedFraction < this._minUploadedFractionWithoutPermission
									? this._logger.info(
											`Requesting syncing permission because source folder has less than ${
												this._minUploadedFractionWithoutPermission * 100
											}% of files uploaded`,
										)
									: ((n.syncingPermission = "granted"),
										this._syncingPermissionTracker.addImplicitlyPermittedFolder(r)))
					: this._logger.info(
							`Finished ${a} qualification of source folder ${r}: folder not trackable; too large`,
						),
			this._kickSourceFolderReconciler()
	}
	async _reconcileSourceFolders() {
		await this._syncingPermissionTracker.persistCurrentPermission()
		let r = this.syncingEnabledState === "disabled",
			n = new Map()
		for (let [s, o] of this._trackedSourceFolders) {
			let a = this._registeredSourceFolders.get(s),
				l
			if (a === void 0) l = "source folder has been removed"
			else if (r) l = "syncing is disabled"
			else if (a.containingFolderRoot !== void 0)
				l = `source folder is nested inside folder ${a.containingFolderRoot}`
			else if (a.isHomeDir) l = "source folder is a home directory"
			else if (a.folderQualification?.trackable === !1) l = "source folder is too large"
			else {
				let c = Pa(a)
				c === "permission denied"
					? (l = "syncing permission denied for this source folder")
					: c === "permission needed"
						? (l = "syncing permission not yet granted for this source folder")
						: c === "qualifying" && (l = "source folder is being qualified")
			}
			l !== void 0 && n.set(s, [o, l])
		}
		let i = new Map()
		for (let [s, o] of this._registeredSourceFolders) {
			if (Pa(o) !== "trackable") continue
			let l = this._trackedSourceFolders.get(s)
			l === void 0 &&
				((l = {
					folderName: o.folderName,
					folderSpec: (0, Ll.cloneDeep)(o),
					cancel: new Ot.CancellationTokenSource(),
					sourceFolder: void 0,
					logger: X(`WorkspaceManager[${o.folderName}]`),
				}),
				i.set(s, l))
		}
		for (let [s, [o, a]] of n)
			o.logger.info(`Stop tracking: ${a}`), this._trackedSourceFolders.delete(s), this._stopTracking(o)
		for (let [s, o] of i)
			o.logger.info("Start tracking"), this._trackedSourceFolders.set(s, o), this._startTracking(s, o)
		return Promise.resolve()
	}
	async _startTracking(r, n) {
		let i = new JQ("Startup metrics"),
			s = n.cancel,
			o = await this._createSourceFolder(r, n, s.token)
		if (s.token.isCancellationRequested) {
			n.logger.info("Cancelled in-progress creation of source folder"), o?.dispose()
			return
		}
		if ((i.charge("create SourceFolder"), s.dispose(), o === void 0 || this._stopping)) {
			n.logger.info("Stopped tracking source folder")
			return
		}
		n.sourceFolder = o
		let a = n.folderName,
			l = o.folderId,
			c = await Awe(a, o.cacheDirPath)
		if ((i.charge("read MtimeCache"), o.stopped)) {
			n.logger.info("Stopped tracking source folder")
			return
		}
		for (let [f, p] of c)
			this._pathMap.insert(l, f, "File", e.defaultPathAccept), this._pathMap.update(l, f, 0, p.name, p.mtime)
		i.charge("pre-populate PathMap")
		let u = new Cc()
		try {
			;(o._newlyTracked = c.size === 0), u.add({ dispose: () => (o._newlyTracked = !1) })
			let f = await this._refreshSourceFolder(o, i)
			if (f === void 0 || o.stopped) return
			i.charge("enumerate"), o.setInitialEnumerationComplete(), this._folderEnumeratedEmitter.fire()
			let p = this._pathMap.onDidChangePathStatus(l)
			if (p === void 0) return
			o.addDisposable(
				p((m) => {
					this._sourceFolderContentsChangedEmitter.fire(r)
				}),
				!0,
			),
				o.addDisposable(
					p((m) => {
						this._reportSyncingProgress(o)
					}),
				),
				o.addDisposable(o.diskFileManager.onDidChangeInProgressItemCount(() => this._reportSyncingProgress(o))),
				this._reportSyncingProgress(o),
				this._sourceFoldersChangedEmitter.fire(),
				await o.diskFileManager.awaitQuiesced(),
				o.setInitialSyncComplete(),
				this._folderSyncedEmitter.fire(),
				i?.charge("await DiskFileManager quiesced")
			let g = new yN(a, o.cacheDirPath)
			this._pathMap.enablePersist(l, g, e.pathMapPersistFrequencyMs),
				i.charge("enable persist"),
				this._reportSourceFolderStartup(n.logger, o, i, f),
				this._onboardingSessionEventReporter.reportEvent("finished-syncing")
		} finally {
			u.dispose(), this._reportSyncingProgress(o)
		}
	}
	async _createSourceFolder(r, n, i) {
		let s = n.folderName,
			o = new Cc(),
			a = new Cc(),
			l = n.folderSpec.folderType === 1 ? void 0 : n.folderSpec.workspaceFolder,
			[c, u] = await this._findRepoRoot(r)
		if (i.isCancellationRequested) return
		let f = this._pathMap.openSourceFolder(r, c)
		o.add(new Ot.Disposable(() => this._pathMap.closeSourceFolder(f))),
			o.addAll(...this._openFileManager.startTrackingFolder(s, f))
		let p = new mN(s, this._apiServer, this._pathHandler, this._pathMap)
		o.add(p)
		let g = n.folderSpec.folderType === 0 && this._vcsWatcher !== void 0 ? await E_(r) : void 0,
			m = await this._migrateMtimeCache(r, n)
		return new C6(s, r, c, l, g, f, p, m, o, a, n.logger)
	}
	async _migrateMtimeCache(r, n) {
		let i = this._computeCacheDirPath(r)
		if (CN(i)) return i
		let s = this._computeCacheDirPath(n.folderName)
		if (!CN(s)) return i
		try {
			n.logger.info(`Migrating mtime cache for ${n.folderName} from "${s}" to "${i}"`), await pwe(s, i)
		} catch (o) {
			n.logger.error(`Failed to migrate mtime cache for ${n.folderName} from "${s}" to "${i}": ${Ye(o)}`)
		}
		return i
	}
	_computeCacheDirPath(r) {
		return e.computeCacheDirPath(r, this._storageUriProvider.storageUri)
	}
	static computeCacheDirPath(r, n) {
		let i = as(n),
			s = CC(e._textEncoder.encode(r))
		return $t(i, s)
	}
	async refreshSourceFolders() {
		this.requalifyLargeFolders()
		let r = Array.from(this._trackedSourceFolders.values())
			.map((n) => n.sourceFolder)
			.filter((n) => n !== void 0)
			.map((n) =>
				n.enqueueSerializedOperation(async () => {
					await this._refreshSourceFolder(n)
				}),
			)
		try {
			await Promise.allSettled(r)
		} catch (n) {
			this._logger.info(`One or more source folders failed to refresh: ${Ye(n)}`)
		}
	}
	async _refreshSourceFolder(r, n) {
		r.logger.debug(`Refreshing source folder ${r.folderName}`)
		let i = await this._createSourceFolderTracker(r, n)
		try {
			r.setTracker(i)
		} catch (l) {
			r.logger.info(`Failed to install SourceFolderTracker for ${r.folderName}: ${Ye(l)}`), i.dispose()
			return
		}
		let s = this._trackVcsRepo(r, i.pathFilter)
		s !== void 0 && r.addDisposable(s)
		let o = this._trackFileEdits(r)
		return o !== void 0 && r.addDisposable(o), this._trackOpenDocuments(r), await this._enumerateSourceFolder(r, n)
	}
	async _enumerateSourceFolder(r, n) {
		let i = r.tracker
		if (i === void 0) return
		let s = this._pathMap.nextEntryTS,
			o = await i.pathNotifier.enumeratePaths()
		if (!r.stopped)
			return (
				n?.charge("enumerate paths"),
				this._pathMap.purge(r.folderId, s),
				n?.charge("purge stale PathMap entries"),
				o
			)
	}
	async _createSourceFolderTracker(r, n) {
		let i = new Cc(),
			s = await ZQ(
				Ot.Uri.file(r.folderRoot),
				Ot.Uri.file(r.repoRoot),
				new QC(e.ignoreSources(r.folderRoot)),
				this._fileExtensions,
			)
		n?.charge("create PathFilter")
		let o = this._createPathNotifier(r, s)
		if ((i.add(o), n?.charge("create PathNotifier"), this._configListener.config.enableDebugFeatures)) {
			let a = new iQ(Ot.Uri.file(r.repoRoot), r.folderName, r.folderId)
			if ((i.add(a), a.listenForChanges(), this._vcsWatcher === void 0 && r.vcsDetails !== void 0)) {
				let l = new S_(r.folderName, r.folderId, r.vcsDetails)
				i.add(l), l.listenForChanges()
			}
		}
		return new v6(s, o, i)
	}
	_createPathNotifier(r, n) {
		let i = new wN(r.folderName, r.folderRoot, r.repoRoot, n, r.workspaceFolder)
		return (
			i.addDisposables(
				i.onDidFindPath((s) => {
					this._handlePathFound(r, s.relPath, s.fileType, s.acceptance)
				}),
				i.onDidCreatePath((s) => {
					this._handlePathCreated(r, s.relPath, s.fileType, s.acceptance)
				}),
				i.onDidChangePath((s) => {
					s.fileType === "File" && this._handleFileChanged(r, s.relPath, s.acceptance)
				}),
				i.onDidDeletePath((s) => {
					this._handlePathDeleted(r, s)
				}),
			),
			i
		)
	}
	_trackFileEdits(r) {
		if ((r.logger.debug(`_trackFileEdits was called on ${r.folderName}`), this._fileEditManager === void 0)) {
			r.logger.debug("_fileEditManager is undefined")
			return
		}
		return (
			r.logger.debug("_fileEditManager tracking the folder"),
			this._fileEditManager.startTracking(r.folderId, r.folderName, {
				directory: this._computeCacheDirPath(r.folderRoot),
			})
		)
	}
	_trackVcsRepo(r, n) {
		if ((r.logger.debug(`_trackVcsRepo was called on ${r.folderName}`), this._vcsWatcher === void 0)) {
			r.logger.debug("_vcsWatcher is undefined")
			return
		}
		let i = r.vcsDetails
		if (i === void 0) {
			r.logger.debug("vcsDetails is undefined")
			return
		}
		if (!Iy(y6(i.root), r.repoRoot)) {
			r.logger.info(`Not creating VCSRepoWatcher: vcs root ${as(i.root)} !== repo root ${r.repoRoot}`)
			return
		}
		return (
			r.logger.debug("_vcsWatcher tracking the folder"),
			this._vcsWatcher.startTracking(
				r.folderName,
				r.folderId,
				i,
				new _A.FileChangeWatcherImpl(i.root, this.onDidChangeFile),
				new _A.BlobNameRetrieverImpl(r.repoRoot, this, this._blobNameCalculator),
				new _A.FileUtilsImpl(n),
			)
		)
	}
	async _findRepoRoot(r) {
		let n
		return (
			(n = await yk(r, e.augmentRootName)),
			n === void 0 && (n = (await E_(r))?.root),
			n !== void 0 ? [y6(n), !0] : [r, !1]
		)
	}
	_trackOpenDocuments(r) {
		let n = this._openFileManager.getTrackedPaths(r.folderId)
		for (let i of n) r.acceptsPath(i) || this._openFileManager.stopTracking(r.folderId, i)
		Ot.workspace.textDocuments.forEach((i) => {
			this._trackDocument(r, i) !== void 0 &&
				this._fileEditManager?.addInitialDocument({
					folderId: r.folderId,
					relPath: r.relativePathName(i.uri.fsPath),
					document: i,
				})
		}),
			Ot.workspace.notebookDocuments.forEach((i) => {
				this._trackDocument(r, i)
			})
	}
	_trackDocument(r, n) {
		let i = hf(n.uri)
		if (i === void 0) return
		let s = r.relativePathName(i)
		if (s === void 0 || !r.acceptsPath(s)) return
		let o = this._pathMap.getBlobName(r.folderId, s)
		return this._openFileManager.addOpenedDocument({ folderId: r.folderId, relPath: s, document: n }, o), s
	}
	_stopTracking(r) {
		if (r.sourceFolder === void 0) {
			let n = r.cancel
			n.cancel(), n.dispose(), r.logger.info("Cancelled in-progress tracking of source folder")
		} else {
			let n = r.sourceFolder
			;(r.sourceFolder = void 0), n.dispose(), r.logger.info("Stopped tracking source folder")
		}
		this._folderSyncedEmitter.fire(), this._folderEnumeratedEmitter.fire()
	}
	translateRange(r, n, i) {
		let s = this._resolveAbsPath(r.absPath)
		if (s === void 0) return
		let [o, a] = s
		return this._openFileManager.translateRange(o.folderId, a, n, i)
	}
	getContext() {
		if (this._openFileManager === void 0 || this._pathMap === void 0) return qC.empty()
		let r = this._openFileManager.getRecencySummary(this._completionServer.completionParams.chunkSize),
			n = new Set(),
			i = new Map(),
			s = new Map()
		for (let [y, C] of r.folderMap) {
			let v = this._pathMap.getRepoRoot(y)
			v !== void 0 && s.set(v, C)
			for (let [b, w] of C) {
				n.add(w)
				let B = this._pathMap.getBlobName(y, b)
				B !== void 0 && B !== w && i.set(B, (i.get(B) ?? 0) + 1)
			}
		}
		let o = new Set()
		for (let [y, C] of i) n.has(y) || (C === this._pathMap.getUniquePathCount(y) && o.add(y))
		let a = new Array()
		for (let y of r.recentChunks) {
			let C = this._pathMap.getRepoRoot(y.folderId)
			C !== void 0 &&
				a.push({
					seq: y.seq,
					uploaded: y.uploaded,
					repoRoot: C,
					pathName: y.pathName,
					blobName: y.blobName,
					text: y.text,
					origStart: y.origStart,
					origLength: y.origLength,
					expectedBlobName: y.expectedBlobName,
				})
		}
		let l = [],
			c = []
		if (this._configListener.config.openFileManager.v2Enabled) {
			let y = this._openFileManager.getAllEditEvents()
			for (let v of y.values()) l.push(...v)
			let C = this._openFileManager.getAllPathToIndexedBlob()
			c = []
			for (let v of C.values()) for (let b of v.values()) c.push(b)
		}
		let u = this._blobsCheckpointManager,
			f = u !== void 0 && this._useCheckpointManagerContext,
			p = f && this._validateCheckpointManagerContext,
			g
		if (!f || p) {
			let y = new Set(n)
			for (let [b, w, B, M, Q] of this._pathMap.pathsWithBlobNames()) r.folderMap.get(b)?.has(B) || y.add(Q)
			let C = Array.from(y),
				v = this._blobNamesToBlobs(C)
			if (((g = new qC(v, a, s, l, c, this._lastChatResponse, C)), !f)) return g
		}
		let m = u.getContextAdjusted(n, o)
		return (
			g !== void 0 &&
				(u.validateMatching(g.blobs, m) ||
					this._clientMetricsReporter.report({
						client_metric: "blob_context_mismatch",
						value: 1,
					})),
			new qC(m, a, s, l, c, this._lastChatResponse)
		)
	}
	getContextWithBlobNames() {
		let r = this.getContext()
		return r.blobNames !== void 0 ? r : { ...r, blobNames: this._blobsCheckpointManager.expandBlobs(r.blobs) }
	}
	recordChatReponse(r) {
		this._lastChatResponse = { seq: this._sequenceGenerator.next(), text: r }
	}
	_blobNamesToBlobs(r) {
		return this._blobsCheckpointManager === void 0
			? { checkpointId: void 0, addedBlobs: r, deletedBlobs: [] }
			: this._blobsCheckpointManager.blobsPayload(r)
	}
	handleUnknownBlobs(r, n) {
		if (n.length === 0) return
		let i = new Set(n),
			s = new Array()
		for (let [o, a] of r.trackedPaths)
			if (o !== void 0) for (let [l, c] of a) i.has(c) && (s.push([c, new Je(o, l)]), i.delete(c))
		for (let o of i) {
			let a = this._pathMap.getAnyPathName(o)
			a !== void 0 && s.push([o, a])
		}
		this._unknownBlobHandler.enqueue(s), this._vcsWatcher?.handleUnknownBlobs(n)
	}
	handleUnknownCheckpoint(r, n) {
		this._logger.info(`received checkpoint not found for request id ${r}`),
			this._blobsCheckpointManager.resetCheckpoint(),
			this._blobsCheckpointManager.updateBlob("")
	}
	notifyBlobMissing(r, n) {
		let i = this._pathMap.reportMissing(n)
		if (i !== void 0) {
			let o = this._getSourceFolder(i.rootPath)
			if (o !== void 0) {
				o.diskFileManager.ingestPath(o.folderId, r.relPath)
				return
			}
		}
		let s = this._getSourceFolder(r.rootPath)
		s !== void 0 && this._openFileManager.handleMissingBlob(s.folderId, r.relPath, n)
	}
	_getSourceFolder(r) {
		return this._trackedSourceFolders.get(r)?.sourceFolder
	}
	resolvePathName(r) {
		let n = typeof r == "string" ? r : hf(r)
		if (n === void 0) return
		let i = this._resolveAbsPath(n)
		if (i === void 0) return
		let [s, o] = i
		return new Je(s.repoRoot, o)
	}
	getFolderRoot(r) {
		let n = typeof r == "string" ? r : hf(r)
		if (n === void 0) return
		let i = this._resolveAbsPath(n)
		if (i === void 0) return
		let [s, o] = i
		return s.folderRoot
	}
	safeResolvePathName(r) {
		let n = typeof r == "string" ? r : hf(r)
		if (n === void 0) return
		let i = this._resolveAbsPath(n)
		if (i === void 0) return new Je("", n)
		let [s, o] = i
		return new Je(s.repoRoot, o)
	}
	_resolveAbsPath(r) {
		for (let [n, i] of this._trackedSourceFolders) {
			if (i.sourceFolder === void 0) continue
			let s = i.sourceFolder.relativePathName(r)
			if (s !== void 0) return [i.sourceFolder, s]
		}
	}
	hasFile(r) {
		let [n, i] = this._resolveAbsPath(r.absPath) ?? [void 0, void 0]
		return n === void 0 || i === void 0 ? !1 : this._pathMap.hasFile(n.folderId, r.relPath)
	}
	getBlobName(r) {
		let [n, i] = this._resolveAbsPath(r.absPath) ?? [void 0, void 0]
		if (!(n === void 0 || i === void 0))
			return (
				this._openFileManager.getBlobName(n.folderId, r.relPath) ??
				this._pathMap.getBlobName(n.folderId, r.relPath)
			)
	}
	getAllPathNames(r) {
		return this._pathMap.getAllPathNames(r)
	}
	getAllQualifiedPathInfos(r) {
		return this._pathMap.getAllQualifiedPathInfos(r)
	}
	getAllQualifiedPathNames(r) {
		return this._pathMap.getAllQualifiedPathNames(r)
	}
	getAllPathInfo(r) {
		return this._pathMap.getAllPathInfo(r)
	}
	_handlePathFound(r, n, i, s) {
		let o = r.folderId
		this._pathMap.insert(o, n, i, s), i === "File" && s.accepted && r.diskFileManager.ingestPath(o, n)
	}
	_handlePathCreated(r, n, i, s) {
		let o = r.folderId
		if ((this._pathMap.insert(o, n, i, s), !!s.accepted)) {
			if (i === "File") r.diskFileManager.ingestPath(r.folderId, n), this._emitFileNotification(o, n, "disk")
			else if (i === "Directory") {
				let a = r.tracker?.pathFilter
				if (a === void 0) return
				r.enqueueSerializedOperation(() => this._handleDirectoryCreated(r, n, a))
			}
		}
	}
	_handleFileChanged(r, n, i) {
		let s = r.folderId
		this._pathMap.insert(s, n, "File", i),
			i.accepted && (r.diskFileManager.ingestPath(s, n), this._emitFileNotification(s, n, "disk"))
	}
	_handlePathDeleted(r, n) {
		let i = r.folderId,
			s = this._pathMap.getPathInfo(i, n)
		if (s === void 0) return
		this._deletePath(r.folderId, n)
		let [o, a] = s
		a.accepted &&
			(o === "Directory"
				? this._handleDirectoryRemoved(r, n)
				: o === "File" && this._emitFileNotification(i, n, "disk"),
			this._fileDeletedEmitter.fire({ folderId: i, relPath: n }))
	}
	_deletePath(r, n) {
		this._pathMap.remove(r, n)
	}
	async _handleDirectoryCreated(r, n, i) {
		r.logger.info(`Directory created: ${n}`)
		let s = Ot.Uri.file(r.repoRoot),
			o = new PC(r.folderName, Ot.Uri.joinPath(s, n), s, i)
		for await (let [a, l, c, u] of o) this._handlePathFound(r, l, c, u)
	}
	_handleDirectoryRemoved(r, n) {
		r.logger.info(`Directory removed: ${n}`)
		let i = r.folderId,
			s = new Array()
		for (let [o] of this._pathMap.pathsInFolder(i)) Nh(n, o) !== void 0 && s.push(o)
		for (let o of s) this._deletePath(i, o)
	}
	_notifyActiveEditorChanged(r) {
		let n = r?.document,
			i = this._uriToPathInfo(n?.uri)
		if (i === void 0) {
			this._openFileManager.loseFocus()
			return
		}
		let [s, o] = i,
			a = this._pathMap.getBlobName(s, o)
		this._openFileManager.addOpenedDocument({ folderId: s, relPath: o, document: n }, a)
	}
	_notifyTextDocumentChanged(r) {
		let n = this._uriToPathInfo(r.document.uri)
		if (n === void 0) return
		let [i, s] = n
		this._openFileManager.handleChangedDocument({
			folderId: i,
			relPath: s,
			event: r,
		}),
			this._emitFileNotification(i, s, "buffer"),
			this._textDocumentChangedEmitter.fire({
				folderId: i,
				relPath: s,
				event: r,
			})
	}
	_notifyTextDocumentOpened(r) {
		let n = this._uriToPathInfo(r.uri)
		if (n === void 0) return
		let [i, s] = n
		this._textDocumentOpenedEmitter.fire({
			folderId: i,
			relPath: s,
			document: r,
		})
	}
	_notifyTextDocumentClosed(r) {
		let n = this._uriToPathInfo(r.uri)
		if (n === void 0) return
		let [i, s] = n
		this._textDocumentClosedEmitter.fire({
			folderId: i,
			relPath: s,
			document: r,
		})
	}
	_notifyNotebookDocumentChanged(r) {
		let n = this._uriToPathInfo(r.notebook.uri)
		if (n === void 0) return
		let [i, s] = n
		this._openFileManager.handleChangedDocument({
			folderId: i,
			relPath: s,
			event: r,
		}),
			this._emitFileNotification(i, s, "buffer")
	}
	_uriToPathInfo(r) {
		if (r === void 0) return
		let n = hf(r)
		if (n === void 0) return
		let i = this._resolveAbsPath(n)
		if (i === void 0) return
		let [s, o] = i
		if (s.acceptsPath(o)) return [s.folderId, o]
	}
	_notifyWillRenameFile(r) {
		r.files.forEach((n) => {
			let i = this._resolveAbsPath(n.oldUri.fsPath),
				s = this._resolveAbsPath(n.newUri.fsPath)
			if (i === void 0 || s === void 0) return
			let [o, a] = i,
				[l, c] = s
			if (o.folderId !== l.folderId) {
				this._logger.debug(
					`[WARN] Rename should not cause a file to move between source folders.     old file: ${i[1]}     new file: ${s[1]}    old source folder: ${o.folderName}     new source folder: ${l.folderName}`,
				)
				return
			}
			this._fileWillRenameEmitter.fire({
				folderId: o.folderId,
				oldRelPath: a,
				newRelPath: c,
				type: Fh(n.oldUri.fsPath).type,
			})
		})
	}
	_notifyDocumentClosed(r) {
		let n = r.uri,
			i = hf(n)
		if (i === void 0) return
		let s = this._resolveAbsPath(i)
		if (s === void 0) return
		let [o, a] = s
		this._openFileManager.handleClosedDocument({
			folderId: o.folderId,
			relPath: a,
			document: r,
		})
	}
	_emitFileNotification(r, n, i) {
		this._fileChangedEmitter.fire({ folderId: r, relPath: n, origin: i })
	}
	getTabSwitchEvents() {
		return this._tabWatcher?.getTabSwitchEvents()
	}
	getFileEditEvents(r = void 0) {
		if (this._fileEditManager === void 0) return []
		let n
		if (r !== void 0) {
			let i = this._trackedSourceFolders.get(r)?.sourceFolder
			if (i === void 0) return []
			n = i.folderId
		} else n = this._fileEditManager.findFolderIdWithMostRecentChanges()
		return n === -1 ? [] : this._fileEditManager.findEventsForFolder(n)
	}
	getMostRecentlyChangedFolderRoot() {
		if (this._fileEditManager === void 0) return
		let r = this._fileEditManager.findFolderIdWithMostRecentChanges()
		if (r !== -1) {
			for (let [n, i] of this._trackedSourceFolders) if (i.sourceFolder?.folderId === r) return n
		}
	}
	findBestWorkspaceRootMatch(r) {
		let n = dW(r).slice(0, -1),
			i = "",
			s
		for (let c of n) {
			i = $t(i, c)
			let u = this.getAllQualifiedPathInfos(i).filter((f) => f.isAccepted)
			if (u.length === 0) break
			s = u[0]
		}
		if (s !== void 0) return s
		let o = this.getMostRecentlyChangedFolderRoot(),
			a = o ? this.getRepoRootForFolderRoot(o) : void 0
		if (a !== void 0)
			return {
				qualifiedPathName: new Je(a, ""),
				fileType: "Directory",
				isAccepted: !1,
			}
		let l = this.listSourceFolders().filter((c) => c.type === 0 && c.syncingEnabled)
		if (l.length > 0)
			return {
				qualifiedPathName: new Je(l[0].folderRoot, ""),
				fileType: "Directory",
				isAccepted: !1,
			}
	}
	getRepoRootForFolderRoot(r) {
		return this._trackedSourceFolders.get(r)?.sourceFolder?.repoRoot
	}
	getVCSWatchedFolderIds() {
		return this?._vcsWatcher?.getWatchedFolderIds() ?? []
	}
	async getVCSChange() {
		return this._vcsWatcher === void 0 ? { commits: [], workingDirectory: [] } : await this._vcsWatcher.getChanges()
	}
	getEnableCompletionFileEditEvents() {
		return this._featureFlagManager.currentFlags.enableCompletionFileEditEvents
	}
	async updateStatusTrace(r) {
		r.addSection("Syncing permission parameters"),
			r.addValue("enableFileLimitsForSyncingPermission", this.enableFileLimitsForSyncingPermission),
			r.addValue("maxTrackableFiles", this.maxTrackableFiles),
			r.addValue("maxTrackableFilesWithoutPermission", this.maxTrackableFilesWithoutPermission),
			r.addValue("minUploadedFractionWithoutPermission", this.minUploadedFractionWithoutPermission),
			r.addValue(
				"minUploadedFractionWithoutPermission as a percentage",
				this.minUploadedFractionWithoutPermission * 100,
			),
			r.addValue("verifyFolderIsSourceRepo", this.verifyFolderIsSourceRepo),
			r.addValue("refuseToSyncHomeDirectories", this.refuseToSyncHomeDirectories)
		let n = 0
		for (let [s, o] of this._registeredSourceFolders) {
			if (
				(n++,
				r.addSection(`Source folder: ${s}`),
				o.folderType === 0
					? r.addValue("Folder type", "vscode workspace folder")
					: r.addValue("Folder type", "external folder"),
				o.containingFolderRoot !== void 0)
			) {
				r.addValue("Not tracked: nested folder. Containing folder", o.containingFolderRoot)
				continue
			}
			if (o.isHomeDir) {
				r.addLine("Not tracked: home directory")
				continue
			}
			if (o.folderQualification !== void 0 && !o.folderQualification.trackable) {
				r.addLine("Not tracked: folder is too large")
				continue
			}
			let a = Pa(o)
			if (a === "permission denied") {
				r.addLine("Not tracked: syncing permission denied")
				continue
			}
			if (a === "permission needed") {
				r.addLine("Not tracked: syncing permission not yet granted")
				continue
			}
			let l = this._trackedSourceFolders.get(s)?.sourceFolder
			if (l === void 0) {
				r.addLine("Tracking in progress")
				continue
			}
			r.addValue("Folder root", s),
				r.addValue("Repo root", l.repoRoot),
				r.addValue("Mtime cache dir", l.cacheDirPath),
				l.diskFileManager.itemsInFlight === 0 || r.addValue("Source folder startup", "in progress"),
				r.addValue("Source folder startup", "complete"),
				r.addValue("Tracked files", this._pathMap.trackedFileCount(l.folderId)),
				r.addValue("Syncing backlog size", l.diskFileManager.itemsInFlight)
		}
		if (
			(n === 0 && r.addSection("Source folders: no open source folders"),
			r.addSection("Workspace status"),
			!this.initialFoldersSynced)
		)
			r.addValue("Workspace startup", "in progress")
		else {
			r.addValue("Workspace startup", "complete")
			let s = this.getContextWithBlobNames()
			r.addValue("Blobs in context", s.blobNames.length)
			let o = r.savePoint()
			try {
				let l = 0
				for (let c = 0; c < s.blobNames.length; c += 1e3) {
					r.rollback(o), r.addLine(`Verifying blob names... ${c} / ${s.blobNames.length} `), r.publish()
					let u = await this._apiServer.findMissing(s.blobNames.slice(c, c + 1e3))
					l += u.unknownBlobNames.length
				}
				r.rollback(o), r.addValue("Unknown blob names", l)
			} catch (a) {
				r.rollback(o), r.addError(`Unable to verify blob names: ${a}`)
			}
		}
		n === 0 && r.addLine("No source folders in workspace")
		let i = this._blobsCheckpointManager
		if (i !== void 0) {
			let s = i.getContext(),
				o = i.getCheckpointedBlobNames().length
			r.addValue("Current checkpoint", s.checkpointId),
				r.addValue("Blobs in current checkpoint", o),
				r.addValue("Added blobs not in checkpoint", s.addedBlobs.length),
				r.addValue("Deleted blobs not in checkpoint", s.deletedBlobs.length)
		}
	}
	_reportSourceFolderStartup(r, n, i, s) {
		let o = n.diskFileManager.metrics
		r.info("Tracking enabled"), r.info(s.format()), r.info(o.format()), r.info(i.format())
	}
	_reportWorkspaceStartup(r) {
		this._logger.info(`Workspace startup complete in ${r} ms`)
	}
	trackedSourceFolderNames() {
		return Array.from(this._registeredSourceFolders)
			.filter(([r, n]) => Pa(n) === "trackable")
			.map(([r, n]) => ({ folderRoot: r }))
	}
	getSourceFoldersReportDetails() {
		let r = this.listSourceFolders(),
			n = (0, Ll.mapValues)(
				(0, Ll.groupBy)(r, (f) => Ly[f.type]),
				(f) => f.length,
			),
			i = (0, Ll.mapValues)(
				(0, Ll.groupBy)(r, (f) => Ly[f.type]),
				(f) => (0, Ll.uniq)(f.map((p) => this.getRepoRootForFolderRoot(p.folderRoot))).length,
			),
			s = (f) => f.type === 0 || f.type === 1,
			o = (f) => f.type === 2 || f.type === 3,
			a = (f) => f.type === 4,
			l = r.filter((f) => s(f)).map((f) => f.trackedFileCount),
			c = r.filter((f) => o(f)).length,
			u = (0, Ll.mapValues)(
				(0, Ll.groupBy)(
					r.filter((f) => a(f)),
					(f) => f.reason,
				),
				(f) => f.length,
			)
		return {
			workspaceStorageUri: this._storageUriProvider.storageUri?.toString(),
			folderCountByType: n,
			repoRootCountByType: i,
			trackedFileCount: l,
			nestedFolderCount: c,
			untrackedCountByReason: u,
		}
	}
	listSourceFolders() {
		if (this._syncingPermissionTracker.syncingPermissionDenied) return []
		let r = this.syncingEnabledState === "disabled",
			n = new Array()
		for (let [i, s] of this._registeredSourceFolders) {
			if (s.containingFolderRoot !== void 0) {
				let f = s.folderType === 0 ? 2 : 3
				n.push({
					type: f,
					name: s.folderName,
					syncingEnabled: !1,
					folderRoot: i,
					containingFolderRoot: s.containingFolderRoot,
				})
				continue
			}
			if (s.isHomeDir) {
				n.push({
					type: 4,
					name: s.folderName,
					syncingEnabled: !1,
					folderRoot: i,
					reason: "home directory",
				})
				continue
			}
			if (s.folderQualification !== void 0 && !s.folderQualification.trackable) {
				n.push({
					type: 4,
					name: s.folderName,
					syncingEnabled: !1,
					folderRoot: i,
					reason: "too large",
				})
				continue
			}
			if (s.syncingPermission === "denied") {
				n.push({
					type: 4,
					name: s.folderName,
					syncingEnabled: !1,
					folderRoot: i,
					reason: "permission not granted",
				})
				continue
			}
			let o = s.folderType === 0 ? 0 : 1,
				a = this._trackedSourceFolders.get(i)?.sourceFolder
			if (!a?.initialEnumerationComplete) {
				let f = !r && s.syncingPermission === "granted"
				n.push({
					name: s.folderName,
					type: o,
					folderRoot: i,
					syncingEnabled: f,
					trackedFileCount: 0,
					containsExcludedItems: !1,
					containsUnindexedItems: !1,
					enumerationState: 0,
				})
				continue
			}
			let l = !r && s.syncingPermission === "granted",
				c = !1,
				u = !1
			for (let [f, p, g, m] of this._pathMap.pathsInFolder(a.folderId))
				g || (c = !0), p === "File" && g && !m && (u = !0)
			n.push({
				name: s.folderName,
				type: o,
				folderRoot: i,
				syncingEnabled: l,
				trackedFileCount: this._pathMap.trackedFileCount(a.folderId),
				containsExcludedItems: c,
				containsUnindexedItems: u,
				enumerationState: 1,
			})
		}
		return n
	}
	listChildren(r, n) {
		if (this._syncingPermissionTracker.syncingPermissionDenied) return []
		let s = this._trackedSourceFolders.get(r)?.sourceFolder
		if (s === void 0) throw new hM()
		if (!s.initialEnumerationComplete) throw new gM()
		let o = $t(r, n),
			a = vl(s.repoRoot, o),
			l = new Map(),
			c = new Map(),
			u = new Set(),
			f = new Set(),
			p = s.folderId
		for (let [g, m, y, C, v] of this._pathMap.pathsInFolder(p)) {
			let b = Nh(a, g)
			if (b === void 0) continue
			let w = dW(b)
			if (!(w.length === 0 || w[0].length === 0))
				if (w.length === 1) l.set(w[0], { type: m, included: y, indexed: C, reason: v })
				else {
					let B = w[0]
					if (!y) u.add(B)
					else if (m === "File") {
						let M = c.get(B) ?? 0
						c.set(B, M + 1), C || f.add(B)
					}
				}
		}
		return Array.from(l.entries()).map(([g, m]) => {
			let y = {
				name: g,
				folderRoot: r,
				relPath: $t(n, g),
				included: m.included,
				reason: m.reason,
			}
			return m.type === "File"
				? { ...y, type: "File", indexed: m.indexed }
				: m.type === "Directory"
					? {
							...y,
							type: "Directory",
							trackedFileCount: c.get(g) ?? 0,
							containsExcludedItems: u.has(g),
							containsUnindexedItems: f.has(g),
						}
					: { ...y, type: "Other" }
		})
	}
	clearFileEdits() {
		this._fileEditManager?.clearAll({ clearLastKnown: !1 })
	}
	unitTestOnlyGetRepoRoot(r) {
		let n = this._trackedSourceFolders.get(r)
		if (n !== void 0) return n.sourceFolder?.repoRoot
	}
	unitTestOnlySourceFolderBacklog(r) {
		let n = this._trackedSourceFolders.get(r)
		if (n === void 0) return
		let i = n.sourceFolder
		if (i !== void 0 && i.initialEnumerationComplete) return i.diskFileManager.itemsInFlight
	}
}