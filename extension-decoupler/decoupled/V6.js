
var C6 = class extends z {
		constructor(r, n, i, s, o, a, l, c, u, f, p) {
			super(u, f)
			this.folderName = r
			this.folderRoot = n
			this.repoRoot = i
			this.workspaceFolder = s
			this.vcsDetails = o
			this.folderId = a
			this.diskFileManager = l
			this.cacheDirPath = c
			this.logger = p
			;(this._operationQueue = new Ia(async (g) => await this._runSerializedOperation(g))),
				this.addDisposables(this._operationQueue, {
					dispose: () => this._disposeTracker(),
				})
		}
		_operationQueue
		_tracker
		_newlyTracked = !1
		_initialEnumerationComplete = !1
		_initialSyncComplete = !1
		_stopped = !1
		dispose() {
			;(this._stopped = !0), super.dispose()
		}
		get stopped() {
			return this._stopped
		}
		get type() {
			return this.workspaceFolder === void 0 ? 1 : 0
		}
		_disposeTracker() {
			this._tracker?.dispose(), (this._tracker = void 0)
		}
		setTracker(r) {
			if (this.stopped) throw new Error("Source folder has been disposed")
			this._disposeTracker(), (this._tracker = r)
		}
		get tracker() {
			return this._tracker
		}
		get initialEnumerationComplete() {
			return this._initialEnumerationComplete
		}
		setInitialEnumerationComplete() {
			this._initialEnumerationComplete = !0
		}
		get initialSyncComplete() {
			return this._initialSyncComplete
		}
		setInitialSyncComplete() {
			this._initialSyncComplete = !0
		}
		relativePathName(r) {
			if (Ss(this.folderRoot, r)) return vl(this.repoRoot, r)
		}
		acceptsPath(r) {
			return this._tracker === void 0 ? !1 : this._tracker.pathFilter.acceptsPath(r)
		}
		async enqueueSerializedOperation(r) {
			this._operationQueue.insert(r), await this._operationQueue.kick()
		}
		async _runSerializedOperation(r) {
			r !== void 0 && (!this._initialEnumerationComplete || this._stopped || (await r()))
		}
	},
	v6 = class extends z {
		constructor(r, n, i) {
			super(i)
			this.pathFilter = r
			this.pathNotifier = n
		}
	}