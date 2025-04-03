
var e6 = class {
		constructor(t) {
			this._blobNameCalculator = t
		}
		_logger = X("OpenDocumentSnapshotCache")
		_lastKnownText = new Map()
		handleDocumentOpened(t) {
			tf(t.document) || this._lastKnownText.set(t.relPath, t.document.getText())
		}
		handleDocumentClosed(t) {
			this._lastKnownText.delete(t.relPath)
		}
		handleFileRename(t) {
			for (let r of this._lastKnownText.keys())
				if (Ss(t.oldRelPath, r)) {
					let n = t.newRelPath + r.slice(t.oldRelPath.length)
					this._lastKnownText.set(n, this._lastKnownText.get(r)), this._lastKnownText.delete(r)
				}
		}
		handleFileDeletion(t) {
			this._lastKnownText.delete(t.relPath)
		}
		_swapLastKnownText(t, r) {
			if (!this._lastKnownText.has(t)) {
				this._logger.verbose(`[WARN] no known last text for path [${t}]. initializing.`),
					this._lastKnownText.set(t, r)
				return
			}
			let n = this._lastKnownText.get(t)
			return this._lastKnownText.set(t, r), n
		}
		handleDocumentChange(t) {
			if (Object.prototype.hasOwnProperty.call(t.event, "notebook")) return
			t = t
			let r = t.event.document.getText(),
				n = this._swapLastKnownText(t.relPath, r)
			if (!n || t.event.contentChanges.length === 0) return
			let i = t.event.contentChanges.map(
				(s) =>
					new Nl({
						beforeStart: s.rangeOffset,
						afterStart: s.rangeOffset,
						beforeText: n.substring(s.rangeOffset, s.rangeOffset + s.rangeLength),
						afterText: s.text,
					}),
			)
			if (i.length > 1) {
				i.sort((o, a) => o.beforeStart - a.beforeStart)
				let s = 0
				i = i.map((o) => {
					let a = o.afterStart + s
					return (
						(s += o.afterText.length - o.beforeText.length),
						new Nl({
							beforeStart: o.beforeStart,
							afterStart: a,
							beforeText: o.beforeText,
							afterText: o.afterText,
						})
					)
				})
			}
			return new og({
				path: t.relPath,
				edits: i,
				beforeBlobName: this._blobNameCalculator.calculateNoThrow(t.relPath, n),
				afterBlobName: this._blobNameCalculator.calculateNoThrow(t.relPath, r),
			}).normalize()
		}
		getLastKnownText(t) {
			return this._lastKnownText.get(t)
		}
	},
	fN = class {
		constructor(t) {
			this._blobNameCalculator = t
			;(this._openDocumentSnapshotCache = new e6(this._blobNameCalculator)), (this._fileEditsStore = new xA(1e6))
		}
		_openDocumentSnapshotCache
		_fileEditsStore
		handleDocumentOpened(t) {
			this._openDocumentSnapshotCache.handleDocumentOpened(t)
		}
		handleDocumentClosed(t) {
			this._openDocumentSnapshotCache.handleDocumentClosed(t)
		}
		handleFileWillRename(t) {
			this._openDocumentSnapshotCache.handleFileRename(t)
		}
		handleFileDeletion(t) {
			this._openDocumentSnapshotCache.handleFileDeletion(t)
		}
		handleDocumentChange(t, r) {
			let n = this._openDocumentSnapshotCache.handleDocumentChange(t)
			return n === void 0 ? 0 : this._fileEditsStore.addEvent(n, r)
		}
		getEvents() {
			return this._fileEditsStore.getEvents()
		}
		removeEventsPriorToBlob(t) {
			this._fileEditsStore.removeEventsPriorToBlob(t)
		}
		getLastKnownText(t) {
			return this._openDocumentSnapshotCache.getLastKnownText(t)
		}
	}