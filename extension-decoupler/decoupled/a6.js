
var _N = class {
		_nextFolderId = 100
		_sourceFolders = new Map()
		_blobNameChangedEmitter = new xN.EventEmitter()
		_nextEntryTS = 1e3
		_logger = X("PathMap")
		constructor() {}
		dispose() {
			for (let [t, r] of this._sourceFolders) r.dispose()
		}
		get nextEntryTS() {
			return this._nextEntryTS
		}
		get onDidChangeBlobName() {
			return this._blobNameChangedEmitter.event
		}
		onDidChangePathStatus(t) {
			return this._sourceFolders.get(t)?.onDidChangePathStatus
		}
		openSourceFolder(t, r) {
			for (let [o, a] of this._sourceFolders) {
				if (Iy(a.folderRoot, t)) throw new Error(`Source folder ${t} is already open`)
				if (Ss(t, a.folderRoot)) throw new Error(`Source folder ${t} contains ${a.folderRoot}`)
				if (Ss(a.folderRoot, t)) throw new Error(`Source folder ${a.folderRoot} contains ${t}`)
			}
			let n = this._nextFolderId++,
				i = new A6(t, r)
			this._sourceFolders.set(n, i)
			let s = i.onDidChangeBlobName(this._handleBlobNameChangeEvent.bind(this))
			return i.addDisposable(s), this._logger.info(`Opened source folder ${t} with id ${n}`), n
		}
		closeSourceFolder(t) {
			let r = this._sourceFolders.get(t)
			if (r === void 0) return
			r.clear()
			let n = r.folderRoot
			this._sourceFolders.delete(t), r.dispose(), this._logger.info(`Closed source folder ${n} with id ${t}`)
		}
		_handleBlobNameChangeEvent(t) {
			this._blobNameChangedEmitter.fire(t)
		}
		getRepoRoot(t) {
			return this._sourceFolders.get(t)?.repoRoot
		}
		hasFile(t, r) {
			return this._sourceFolders.get(t)?.hasFile(r) ?? !1
		}
		getBlobName(t, r) {
			return this._sourceFolders.get(t)?.getBlobName(r)
		}
		getBlobInfo(t, r, n) {
			return this._sourceFolders.get(t)?.getBlobInfo(r, n)
		}
		getAnyPathName(t) {
			for (let r of this._sourceFolders.values()) {
				let n = r.getPathName(t)
				if (n !== void 0) return this._makeQualifiedPathName(r, n)
			}
		}
		getAllPathNames(t) {
			let r = new Array()
			for (let n of this._sourceFolders.values()) {
				let i = n.getPathName(t)
				i !== void 0 && r.push(new Je(n.repoRoot, i))
			}
			return r
		}
		getUniquePathCount(t) {
			let r = 0
			for (let n of this._sourceFolders.values()) n.getPathName(t) !== void 0 && r++
			return r
		}
		getAllQualifiedPathNames(t) {
			return this.getAllQualifiedPathInfos(t).map((r) => r.qualifiedPathName)
		}
		getAllQualifiedPathInfos(t) {
			let r = new Array()
			for (let n of this._sourceFolders.values()) {
				let i = n.getPathInfo(t)
				if (i !== void 0) {
					let [s, o] = i
					r.push({
						qualifiedPathName: new Je(n.repoRoot, t),
						fileType: s,
						isAccepted: o.accepted,
					})
				}
			}
			return r
		}
		getAllPathInfo(t) {
			let r = new Array()
			for (let n of this._sourceFolders.values()) {
				let i = n.getPathName(t)
				i !== void 0 && r.push([n.folderRoot, n.repoRoot, i])
			}
			return r
		}
		getPathInfo(t, r) {
			return this._sourceFolders.get(t)?.getPathInfo(r)
		}
		reportMissing(t) {
			for (let r of this._sourceFolders.values()) {
				let n = r.reportMissing(t)
				if (n !== void 0) return this._makeQualifiedPathName(r, n)
			}
		}
		insert(t, r, n, i) {
			let s = this._nextEntryTS++
			this._sourceFolders.get(t)?.insert(r, s, n, i)
		}
		remove(t, r) {
			this._sourceFolders.get(t)?.remove(r)
		}
		shouldTrack(t, r) {
			return this._sourceFolders.get(t)?.shouldTrack(r) ?? !1
		}
		getContentSeq(t, r) {
			return this._sourceFolders.get(t)?.getContentSeq(r)
		}
		update(t, r, n, i, s) {
			this._sourceFolders.get(t)?.update(r, n, i, s)
		}
		markUntrackable(t, r, n, i) {
			this._sourceFolders.get(t)?.markUntrackable(r, n, i)
		}
		purge(t, r) {
			this._sourceFolders.get(t)?.purge(r)
		}
		*pathsWithBlobNames() {
			for (let [t, r] of this._sourceFolders)
				for (let [n, i, s] of r.pathsWithBlobNames()) yield [t, r.repoRoot, n, i, s]
		}
		*pathsInFolder(t) {
			let r = this._sourceFolders.get(t)
			r !== void 0 && (yield* r.allPaths())
		}
		enablePersist(t, r, n) {
			this._sourceFolders.get(t)?.enablePersist(r, n)
		}
		_makeQualifiedPathName(t, r) {
			return new Je(t.repoRoot, r)
		}
		trackedFileCount(t) {
			return this._sourceFolders.get(t)?.trackedFileCount ?? 0
		}
		getFolderIds() {
			return Array.from(this._sourceFolders.keys())
		}
	},
	A6 = class extends z {
		constructor(r, n) {
			super()
			this.folderRoot = r
			this.repoRoot = n
		}
		static defaultPersistThreshold = 100
		_allPathNames = new Map()
		_trackableFilePaths = new Set()
		_blobNameToPathName = new Map()
		_persistState = void 0
		_pathStatusChangedEmitter = new xN.EventEmitter()
		_blobNameChangedEmitter = new xN.EventEmitter()
		get onDidChangePathStatus() {
			return this._pathStatusChangedEmitter.event
		}
		get onDidChangeBlobName() {
			return this._blobNameChangedEmitter.event
		}
		get trackedFileCount() {
			return this._trackableFilePaths.size
		}
		shouldTrack(r) {
			let n = this._allPathNames.get(r)
			return n === void 0 ? !1 : n.fileType === "File" && n.pathAcceptance.accepted
		}
		getContentSeq(r) {
			return this._allPathNames.get(r)?.fileInfo?.contentSeq
		}
		insert(r, n, i, s) {
			let o = this._allPathNames.get(r),
				a = o === void 0 || o.fileType !== i || o.pathAcceptance.format() !== s.format()
			if (o === void 0) (o = { entryTS: n, fileType: i, pathAcceptance: s }), this._allPathNames.set(r, o)
			else {
				let l = o.fileInfo
				;(o.entryTS = n),
					(o.fileType = i),
					(o.pathAcceptance = s),
					s.accepted ||
						((o.fileInfo = void 0),
						l?.trackable &&
							(this._blobNameToPathName.delete(l.blobName),
							this._publishBlobNameChange(r, l.blobName, void 0),
							this._markDirty()))
			}
			o.fileType === "File" && o.pathAcceptance.accepted && o.fileInfo?.trackable !== !1
				? this._trackableFilePaths.add(r)
				: this._trackableFilePaths.delete(r),
				a && this._pathStatusChangedEmitter.fire({ relPath: r })
		}
		remove(r) {
			let n = this._allPathNames.get(r)
			if (n !== void 0) {
				if (
					(this._allPathNames.delete(r),
					this._trackableFilePaths.delete(r),
					n.fileInfo !== void 0 && n.fileInfo.trackable)
				) {
					let i = n.fileInfo.blobName
					this._blobNameToPathName.delete(i), this._publishBlobNameChange(r, i, void 0), this._markDirty()
				}
				this._pathStatusChangedEmitter.fire({ relPath: r })
			}
		}
		clear() {
			for (let [r, n] of this._allPathNames)
				n.fileInfo !== void 0 &&
					n.fileInfo.trackable &&
					this._publishBlobNameChange(r, n.fileInfo.blobName, void 0)
			this._allPathNames.clear(),
				this._trackableFilePaths.clear(),
				this._blobNameToPathName.clear(),
				this._markDirty()
		}
		update(r, n, i, s) {
			let o = this._allPathNames.get(r)
			if (
				o === void 0 ||
				o.fileType !== "File" ||
				!o.pathAcceptance.accepted ||
				(o.fileInfo !== void 0 && o.fileInfo.contentSeq > n)
			)
				return
			let a = o.fileInfo === void 0 ? !0 : o.fileInfo.trackable,
				l
			o.fileInfo?.trackable && (l = o.fileInfo.blobName),
				(o.fileInfo = { trackable: !0, contentSeq: n, blobName: i, mtime: s }),
				this._trackableFilePaths.add(r),
				i !== l &&
					(l !== void 0 && this._blobNameToPathName.delete(l),
					this._blobNameToPathName.set(i, r),
					this._publishBlobNameChange(r, l, i),
					this._markDirty()),
				(!a || l === void 0) && this._pathStatusChangedEmitter.fire({ relPath: r })
		}
		markUntrackable(r, n, i) {
			let s = this._allPathNames.get(r)
			if (
				s === void 0 ||
				s.fileType !== "File" ||
				!s.pathAcceptance.accepted ||
				(s.fileInfo !== void 0 && s.fileInfo.contentSeq > n)
			)
				return
			let o = s.fileInfo
			;(s.fileInfo = { trackable: !1, contentSeq: n, reason: i }), this._trackableFilePaths.delete(r)
			let a = !1
			if (o === void 0) a = !0
			else if (o.trackable === !0) {
				a = !0
				let l = o.blobName
				this._blobNameToPathName.delete(l), this._publishBlobNameChange(r, l, void 0), this._markDirty()
			} else a = i !== o.reason
			a && this._pathStatusChangedEmitter.fire({ relPath: r })
		}
		_makeAbsPath(r) {
			return $t(this.repoRoot, r)
		}
		_publishBlobNameChange(r, n, i) {
			n !== i &&
				this._blobNameChangedEmitter.fire({
					absPath: this._makeAbsPath(r),
					prevBlobName: n,
					newBlobName: i,
				})
		}
		purge(r) {
			let n = new Array()
			for (let [i, s] of this._allPathNames) s.entryTS < r && n.push(i)
			for (let i of n) this.remove(i)
		}
		hasFile(r) {
			return this._trackableFilePaths.has(r)
		}
		getBlobName(r) {
			let n = this._allPathNames.get(r)
			if (n?.fileInfo?.trackable) return n.fileInfo?.blobName
		}
		getBlobInfo(r, n) {
			let i = this._allPathNames.get(r)
			if (i?.fileInfo?.trackable && i.fileInfo.mtime === n) return [i.fileInfo.blobName, i.fileInfo.contentSeq]
		}
		getPathName(r) {
			return this._blobNameToPathName.get(r)
		}
		getPathInfo(r) {
			let n = this._allPathNames.get(r)
			if (n !== void 0) return [n.fileType, n.pathAcceptance]
		}
		reportMissing(r) {
			let n = this._blobNameToPathName.get(r)
			if (n === void 0) return
			let i = this._allPathNames.get(n)
			if (i?.fileInfo?.trackable) return (i.fileInfo.contentSeq = 0), n
		}
		*pathsWithBlobNames() {
			for (let [r, n] of this._allPathNames) {
				let i = n.fileInfo
				i?.trackable && (yield [r, i.mtime, i.blobName, i.contentSeq])
			}
		}
		*allPaths() {
			for (let [r, n] of this._allPathNames) {
				let i = n.pathAcceptance.accepted,
					s = !1,
					o = n.pathAcceptance.format()
				i &&
					(n.fileType === "Other"
						? ((i = !1), (o = "Not a file"))
						: n.fileInfo !== void 0 &&
							(n.fileInfo?.trackable === !0 ? (s = !0) : ((i = !1), (o = n.fileInfo.reason)))),
					yield [r, n.fileType, i, s, o]
			}
		}
		_markDirty() {
			this._persistState !== void 0 && this._persistState.dirtyCount++
		}
		enablePersist(r, n) {
			if (this._persistState) return
			;(this._persistState = {
				dirtyCount: this._trackableFilePaths.size,
				lastPersistDirtyCount: 0,
				mtimeCacheWriter: r,
				persisting: !1,
			}),
				this._maybePersist()
			let i = setInterval(() => void this._maybePersist(), n)
			this.addDisposable({ dispose: () => clearInterval(i) })
		}
		async _maybePersist() {
			if (!(this._persistState === void 0 || this._persistState.persisting)) {
				this._persistState.persisting = !0
				try {
					this._persistState.dirtyCount > this._persistState.lastPersistDirtyCount &&
						(await this._persist(this._persistState))
				} finally {
					this._persistState.persisting = !1
				}
			}
		}
		async _persist(r) {
			let n = function* (o) {
					for (let [a, l] of o) {
						let c = l.fileInfo
						c?.trackable && (yield [a, c.mtime, c.blobName])
					}
				},
				i = r.dirtyCount
			await r.mtimeCacheWriter.write(n(this._allPathNames.entries())), (r.lastPersistDirtyCount = i)
		}
	}