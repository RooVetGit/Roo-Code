
var m6 = class extends ag {
		constructor(r) {
			super()
			this.reason = r
		}
		format() {
			return this.reason
		}
	},
	wN = class extends z {
		constructor(r, n, i, s, o) {
			super()
			this.folderName = r
			this.folderRoot = n
			this.repoRoot = i
			this._pathFilter = s
			this._workspaceFolder = o
			this._logger = X(`PathNotifier[${n}]`)
		}
		_pathFoundEmitter = new Pl.EventEmitter()
		_pathCreatedEmitter = new Pl.EventEmitter()
		_pathChangedEmitter = new Pl.EventEmitter()
		_pathDeletedEmitter = new Pl.EventEmitter()
		_logger
		_filesystemWatcherCreated = !1
		_stopping = !1
		_deletedPaths = void 0
		get onDidFindPath() {
			return this._pathFoundEmitter.event
		}
		get onDidCreatePath() {
			return this._pathCreatedEmitter.event
		}
		get onDidChangePath() {
			return this._pathChangedEmitter.event
		}
		get onDidDeletePath() {
			return this._pathDeletedEmitter.event
		}
		dispose() {
			;(this._stopping = !0), super.dispose()
		}
		async enumeratePaths() {
			if (this._stopping) return
			;(this._deletedPaths = new Set()),
				this._workspaceFolder !== void 0 &&
					!this._filesystemWatcherCreated &&
					(this._createFilesystemWatcher(this._workspaceFolder), (this._filesystemWatcherCreated = !0))
			let r = new PC(this.folderName, Pl.Uri.file(this.folderRoot), Pl.Uri.file(this.repoRoot), this._pathFilter)
			for await (let [i, s, o, a] of r) {
				if (this._stopping) return
				this._pathFoundEmitter.fire({ relPath: s, fileType: o, acceptance: a })
			}
			if (this._stopping) return
			let n = this._deletedPaths
			this._deletedPaths = void 0
			for (let i of n) this._pathDeletedEmitter.fire(i)
			return r.stats
		}
		_handlePathChanged(r, n) {
			let i = this._getRelPath(r)
			if (i === void 0) return
			let s, o
			try {
				;(s = Fh(as(r)).type), (o = this._pathFilter.getPathInfo(i, s))
			} catch (l) {
				;(s = "Other"), (o = new m6(Ye(l)))
			}
			let a = n ? "created" : "changed"
			this._logger.verbose(`${s} ${a}: ${i}, acceptance = ${o.format()}`),
				this._deletedPaths?.delete(i),
				n
					? this._pathCreatedEmitter.fire({
							relPath: i,
							fileType: s,
							acceptance: o,
						})
					: this._pathChangedEmitter.fire({
							relPath: i,
							fileType: s,
							acceptance: o,
						})
		}
		_handlePathDeleted(r) {
			let n = this._getRelPath(r)
			n !== void 0 &&
				(this._logger.verbose(`Path deleted: ${n}`),
				this._deletedPaths !== void 0 ? this._deletedPaths?.add(n) : this._pathDeletedEmitter.fire(n))
		}
		_getRelPath(r) {
			if (this._stopping) return
			let n = hf(r)
			if (n !== void 0) return Nh(this.repoRoot, n)
		}
		_createFilesystemWatcher(r) {
			let n = Pl.workspace.createFileSystemWatcher(new Pl.RelativePattern(r, "**/*"))
			this.addDisposables(
				n,
				n.onDidCreate((i) => this._handlePathChanged(i, !0)),
				n.onDidChange((i) => this._handlePathChanged(i, !1)),
				n.onDidDelete((i) => this._handlePathDeleted(i)),
			)
		}
	}