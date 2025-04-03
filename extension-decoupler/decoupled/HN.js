
var hN = class extends z {
	constructor(r, n) {
		super()
		this._blobUploader = r
		this._blobNameCalculator = n
		this.addDisposables(
			j8((i) => this.handleBlobIndexed(i)),
			J8((i) => this.handleBlobUploaded(i)),
			Y8((i) => this.handleBlobUploadFailed(i)),
		)
	}
	_folderResources = new Map()
	_logger = X("OpenFileManagerV2")
	_uploadingBlobToFolder = new Map()
	startTrackingFolder(r, n) {
		let i = new fN(this._blobNameCalculator),
			s = new t6(new lN(), i, new r6(), r, n)
		return this._folderResources.set(n, s), this.addDisposable(s), s
	}
	handleBlobIndexed(r) {
		for (let n of r.blobNames) {
			this._logger.verbose(`Blob ${n} indexed`)
			let i = this._uploadingBlobToFolder.get(n)
			if (i === void 0) {
				this._logger.debug(`[WARN] Blob ${n} was indexed but not tracked. Ignoring.`)
				return
			}
			this._uploadingBlobToFolder.delete(n),
				this._folderResources.get(i)?.blobStatusStore.updateBlobIndexed(n),
				this._folderResources.get(i)?.fileEditProcessor.removeEventsPriorToBlob(n)
		}
	}
	handleBlobUploadFailed(r) {
		let n = r.blobName
		this._uploadingBlobToFolder.has(n) &&
			(this._logger.debug(`Blob ${n} failed to upload`), this._uploadingBlobToFolder.delete(n))
	}
	handleBlobUploaded(r) {
		this._logger.verbose(`Handling ${r.expectedToActualBlobNameMap.size} uploaded blobs`)
		for (let [n, i] of r.expectedToActualBlobNameMap) {
			if (n === i) continue
			let s = this._uploadingBlobToFolder.get(n)
			if (s === void 0) {
				this._logger.debug(`Blob ${n} was uploaded but not tracked. Ignoring.`)
				continue
			}
			this._logger.debug(`[WARN] Blob name mismatch. Expected ${n} but got ${i}.`),
				this._uploadingBlobToFolder.set(i, s),
				this._uploadingBlobToFolder.delete(n)
			let o = this._folderResources.get(s)
			if (o === void 0) {
				this._logger.debug(`[WARN] Blob ${n} was uploaded but folder ${s} is not tracked. Ignoring.`)
				continue
			}
			o.blobStatusStore.updateBlobName(n, i)
		}
	}
	_upload(r, n, i, s) {
		let o = this._folderResources.get(r)?.workspaceName
		this._logger.info(`[${o}] Uploading [${i}] because [${s}]`)
		let a = this._blobUploader.enqueueUpload({ path: i, readContent: async () => n }, n)
		a &&
			(this._uploadingBlobToFolder.set(a, r), this._folderResources.get(r)?.blobStatusStore.addUploadedBlob(a, i))
	}
	stopTracking(r, n) {
		this._logger.info(`[${this._folderResources.get(r)?.workspaceName}] Stopping tracking [${n}]`),
			this._folderResources.get(r)?.blobStatusStore.removePath(n)
	}
	addOpenedDocument(r, n) {
		let i = this._folderResources.get(r.folderId)
		if (i === void 0) throw new Error(`Source folder [${r.folderId}] is not open`)
		let s = i.workspaceName
		tf(r.document) && this._logger.info(`TODO [${s}] Ignoring notebook document ${r.relPath}`)
		let o = fwe(r.document),
			a = this._blobNameCalculator.calculate(r.relPath, o)
		if (!a) {
			i.blobStatusStore.embargoPath(r.relPath),
				this._logger.debug(`[WARN] Failed to calculate blob name for ${r.relPath}`)
			return
		}
		a !== n
			? (this._upload(r.folderId, o, r.relPath, "new file"),
				this._logger.debug(`[INFO] Blob name mismatch. Expected ${n} but got ${a}.`))
			: i.blobStatusStore.addIndexedBlob(n, r.relPath)
	}
	getBlobName(r, n) {
		return this._folderResources.get(r)?.blobStatusStore?.getIndexedBlobName(n)
	}
	handleMissingBlob(r, n, i) {
		let s = this._folderResources.get(r)
		if (s === void 0) return !1
		let o = s.blobStatusStore.isTrackingBlob(i),
			a = s.workspaceName
		if (!o) return !1
		this._logger.info(`[${a}] Re-uploading ${i} for ${n} in ${r}`)
		let l = s.fileEditProcessor.getLastKnownText(n)
		return l === void 0 ? !1 : (this._upload(r, l, n, "missing blob"), !0)
	}
	handleClosedDocument(r) {
		let n = this._folderResources.get(r.folderId)?.workspaceName
		this._logger.info(`[${n}] Handling closed document ${r.relPath}`), this.stopTracking(r.folderId, r.relPath)
	}
	handleChangedDocument(r) {
		let n = this._folderResources.get(r.folderId)
		if (n === void 0) {
			this._logger.debug(`Ignoring change event for ${r.relPath} because folder is not tracked`)
			return
		}
		if (n.blobStatusStore.isEmbargoed(r.relPath)) return
		let i = n.workspaceName
		if (Object.prototype.hasOwnProperty.call(r.event, "notebook")) {
			this._logger.debug(`[${i}] Ignoring notebook document ${r.relPath}`)
			return
		}
		let s = n.fileEditProcessor
		if (s === void 0) {
			this._logger.debug(`[${i}] Ignoring change event for ${r.relPath} because folder is not tracked`)
			return
		}
		let o = n.blobStatusStore.getLastBlobNameForPath(r.relPath),
			a = s.handleDocumentChange(r, o)
		;(n.fileChangeSizeCounter.add(a, r.relPath) ?? 0) > sCt &&
			(this._upload(r.folderId, fwe(oCt(r)), r.relPath, "large change"), n.fileChangeSizeCounter.clear())
	}
	isTracked(r, n) {
		return this._folderResources.get(r)?.blobStatusStore.isTrackingPath(n) ?? !1
	}
	getTrackedPaths(r) {
		return this._folderResources.get(r)?.blobStatusStore.getTrackedPaths() ?? []
	}
	translateRange(r, n, i, s) {
		let o = this.getBlobName(r, n)
		if (o === void 0) return
		let a = { blobName: o, beginOffset: i, endOffset: s },
			l = (u, f) => {
				if (u.afterStart > f.endOffset) return f
				if (u.afterEnd < f.beginOffset) {
					let p = u.afterText.length - u.beforeText.length
					return {
						blobName: f.blobName,
						beginOffset: f.beginOffset - p,
						endOffset: f.endOffset - p,
					}
				}
				return {
					blobName: f.blobName,
					beginOffset: Math.min(u.afterStart, f.beginOffset),
					endOffset: Math.max(u.afterEnd, f.endOffset),
				}
			},
			c =
				this._folderResources
					.get(r)
					?.fileEditProcessor.getEvents()
					.filter((u) => u.path === n) ?? []
		for (let u of c) for (let f of u.edits) a = l(f, a)
		return a
	}
	getAllEditEvents() {
		let r = new Map()
		return Array.from(this._folderResources.keys()).reduce((n, i) => {
			let s = Number(i)
			return n.set(s, this._folderResources.get(s)?.fileEditProcessor.getEvents() ?? []), n
		}, r)
	}
	getAllPathToIndexedBlob() {
		let r = new Map()
		return Array.from(this._folderResources.keys()).reduce((n, i) => {
			let s = Number(i)
			return n.set(s, this._folderResources.get(s)?.blobStatusStore.getAllPathToIndexedBlob() ?? new Map()), n
		}, r)
	}
}