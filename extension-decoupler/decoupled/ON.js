
var oN = class {
	constructor(t, r, n) {
		this._configListener = t
		this._openFileManagerV1 = r
		this._openFileManagerV2 = n
	}
	_logger = X("OpenFileManagerProxy")
	get isV2Enabled() {
		return this._configListener.config.openFileManager.v2Enabled
	}
	startTrackingFolder(t, r) {
		return this.isV2Enabled
			? [this._openFileManagerV2.startTrackingFolder(t, r), this._openFileManagerV1.openSourceFolder(r)]
			: [this._openFileManagerV1.openSourceFolder(r)]
	}
	addOpenedDocument(t, r) {
		this._openFileManagerV1.startTracking(t.folderId, t.relPath, t.document),
			this.isV2Enabled && this._openFileManagerV2.addOpenedDocument(t, r)
	}
	getBlobName(t, r) {
		if (this.isV2Enabled) {
			let n = this._openFileManagerV2.getBlobName(t, r),
				i = this._openFileManagerV1.getBlobName(t, r)
			return (
				((n === void 0 && i !== void 0) || (n !== void 0 && i === void 0)) &&
					this._logger.debug(`[WARN] getBlobName returned different results between v1 and v2 [${t}:${r}]
[${JSON.stringify(n)}]
[${JSON.stringify(i)}]`),
				i
			)
		} else return this._openFileManagerV1.getBlobName(t, r)
	}
	handleMissingBlob(t, r, n) {
		if (this.isV2Enabled) {
			let i = this._openFileManagerV2.handleMissingBlob(t, r, n)
			return this._openFileManagerV1.notifyMissingBlob(t, r, n) || i
		} else return this._openFileManagerV1.notifyMissingBlob(t, r, n)
	}
	loseFocus() {
		this._openFileManagerV1.loseFocus()
	}
	stopTracking(t, r) {
		this._openFileManagerV1.stopTracking(t, r), this.isV2Enabled && this._openFileManagerV2.stopTracking(t, r)
	}
	handleClosedDocument(t) {
		let r = tf(t.document)
		this._openFileManagerV1.stopTracking(t.folderId, t.relPath, r ? 1 : 0),
			this.isV2Enabled && this._openFileManagerV2.handleClosedDocument(t)
	}
	handleChangedDocument(t) {
		Object.prototype.hasOwnProperty.call(t.event, "notebook")
			? this._openFileManagerV1.applyNotebookChange(t.folderId, t.relPath, t.event)
			: this._openFileManagerV1.applyTextDocumentChange(t.folderId, t.relPath, t.event),
			this.isV2Enabled && this._openFileManagerV2.handleChangedDocument(t)
	}
	isTracked(t, r) {
		if (this.isV2Enabled) {
			let n = this._openFileManagerV2.isTracked(t, r),
				i = this._openFileManagerV1.isTracked(t, r)
			return (
				n !== i &&
					this._logger.debug(`[WARN] isTracked returned different results between v1 and v2 [${t}:${r}]
[${JSON.stringify(n)}]
[${JSON.stringify(i)}]`),
				i
			)
		} else return this._openFileManagerV1.isTracked(t, r)
	}
	getTrackedPaths(t) {
		if (this.isV2Enabled) {
			let r = this._openFileManagerV2.getTrackedPaths(t),
				n = this._openFileManagerV1.getTrackedPaths(t),
				i = (0, W8.difference)(r, n)
			i.length > 0 &&
				this._logger.debug(`[WARN] getTrackedPaths in new but not in old [${t}]
[${JSON.stringify(i)}]`)
			let s = (0, W8.difference)(n, r)
			return (
				s.length > 0 &&
					this._logger.debug(`[WARN] getTrackedPaths in old but not in new [${t}]
[${JSON.stringify(s)}]`),
				n
			)
		} else return this._openFileManagerV1.getTrackedPaths(t)
	}
	getRecencySummary(t) {
		return this._openFileManagerV1.getRecencySummary(t)
	}
	getAllEditEvents() {
		return this.isV2Enabled ? this._openFileManagerV2.getAllEditEvents() : new Map()
	}
	getAllPathToIndexedBlob() {
		return this.isV2Enabled ? this._openFileManagerV2.getAllPathToIndexedBlob() : new Map()
	}
	translateRange(t, r, n, i) {
		if (this.isV2Enabled) {
			let s = this._openFileManagerV2.translateRange(t, r, n, i),
				o = this._openFileManagerV1.translateRange({
					folderId: t,
					relPath: r,
					beginOffset: n,
					endOffset: i,
				})
			return (
				(s?.blobName !== o?.blobName || s?.beginOffset !== o?.beginOffset || s?.endOffset !== o?.endOffset) &&
					this._logger.debug(`[WARN] translateRange returned different results between v1 and v2 [${t}:${r}]
[${JSON.stringify(s)}]
[${JSON.stringify(o)}]`),
				o
			)
		} else
			return this._openFileManagerV1.translateRange({
				folderId: t,
				relPath: r,
				beginOffset: n,
				endOffset: i,
			})
	}
}