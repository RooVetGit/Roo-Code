
var F_ = class extends z {
	constructor(r, n, i, s, o = 5e3) {
		super()
		this._folderName = r
		this._blobNameCalculator = n
		this._maxBlobSizeBytes = i
		this._store = s
		this.maxEventCharsToReturn = o
		;(this._logger = X(`FileEditEventsWatcher[${this._folderName}]`)),
			(this._eventsQueue = new xA(this.maxEventCharsToReturn * 2))
	}
	_eventsQueue
	_lastKnownText = new Map()
	_lastEventTimestamp = 0
	_logger
	_swapLastKnownText(r, n) {
		if (!this._lastKnownText.has(r)) throw new Error(`no known text for [${r}]`)
		let i = this._lastKnownText.get(r)
		return this._lastKnownText.set(r, n), i
	}
	_vscodeEventToFileEditEvent(r, n) {
		let i = n.document.getText(),
			s = this._swapLastKnownText(r, i),
			o = n.contentChanges.map(
				(a) =>
					new Nl({
						beforeStart: a.rangeOffset,
						afterStart: a.rangeOffset,
						beforeText: s.substring(a.rangeOffset, a.rangeOffset + a.rangeLength),
						afterText: a.text,
					}),
			)
		if (o.length > 1) {
			o.sort((l, c) => l.beforeStart - c.beforeStart)
			let a = 0
			o = o.map((l) => {
				let c = l.afterStart + a
				return (
					(a += l.afterText.length - l.beforeText.length),
					new Nl({
						beforeStart: l.beforeStart,
						afterStart: c,
						beforeText: l.beforeText,
						afterText: l.afterText,
					})
				)
			})
		}
		return new og({
			path: r,
			edits: o,
			beforeBlobName: this._blobNameCalculator.calculateNoThrow(r, s),
			afterBlobName: this._blobNameCalculator.calculateNoThrow(r, i),
		}).normalize()
	}
	handleChangedDocument(r) {
		let n = r.relPath,
			i = r.event
		if (!b8.includes(i.document.uri.scheme)) return
		if (i.document.getText().length > this._maxBlobSizeBytes) {
			this._logger.debug(`Ignoring event for ${n} because it is too large`)
			return
		}
		if (!this._lastKnownText.has(n)) {
			this._logger.debug(
				i.contentChanges.length > 0
					? `Last known text is not for the same file. Missing last known text for [${n}].  This is ok if we have recently cleared.`
					: `Updating last known text for ${n} - based on empty event`,
			),
				this._lastKnownText.set(n, i.document.getText())
			return
		}
		if (i.contentChanges.length === 0) {
			this._logger.verbose(`Ignoring event for ${n} - no content changes`)
			return
		}
		let s = this._vscodeEventToFileEditEvent(n, i)
		s.hasChange() && (this._eventsQueue.addEvent(s), (this._lastEventTimestamp = Date.now()))
	}
	get lastEventTimestamp() {
		return this._lastEventTimestamp
	}
	handleOpenedDocument(r) {
		if (b8.includes(r.document.uri.scheme)) {
			if (r.document.getText().length > this._maxBlobSizeBytes) {
				this._logger.debug(`Ignoring event for ${r.relPath} because it is too large`)
				return
			}
			this._logger.debug(`Adding last known text for ${r.relPath}. size before = ${this._lastKnownText.size}`),
				this._lastKnownText.set(r.relPath, r.document.getText())
		}
	}
	handleClosedDocument(r) {
		this._logger.debug(`Removing last known text for ${r.relPath}. size before = ${this._lastKnownText.size}`),
			this._lastKnownText.delete(r.relPath)
	}
	getEvents() {
		let r = [],
			n = 0,
			i = this._eventsQueue.getEvents()
		for (let s = i.length - 1; s >= 0; s--) {
			let o = i[s]
			if (n + o.changedChars() > this.maxEventCharsToReturn) break
			r.push(o), (n += o.changedChars())
		}
		return r.reverse(), r
	}
	handleFileDeleted(r) {
		this._logger.debug(`Deleting events for ${r.relPath}`),
			this._lastKnownText.delete(r.relPath),
			this._eventsQueue.removeEventsForFile(r.relPath)
	}
	_handleFileWillRename(r, n) {
		this._logger.debug(`Renaming events for file [${r}] to [${n}]`),
			this._lastKnownText.has(r) &&
				(this._lastKnownText.set(n, this._lastKnownText.get(r)), this._lastKnownText.delete(r)),
			this._eventsQueue.updatePath(r, n)
	}
	handleFileWillRename(r) {
		if (
			(this._logger.debug(`Renaming events for file/folder [${r.oldRelPath}] to [${r.newRelPath}]`),
			r.type === "File")
		)
			this._handleFileWillRename(r.oldRelPath, r.newRelPath)
		else if (r.type === "Directory") {
			for (let n of this._lastKnownText.keys())
				if (Ss(r.oldRelPath, n)) {
					let i = r.newRelPath + n.slice(r.oldRelPath.length)
					this._handleFileWillRename(n, i)
				}
		}
	}
	clear(r) {
		this._eventsQueue.clear(),
			r.clearLastKnown && this._lastKnownText.clear(),
			(this._lastEventTimestamp = 0),
			this._store.clear()
	}
	async loadEvents() {
		;(await this._store.load()).forEach((n) => this._eventsQueue.addEvent(og.from(n)))
	}
	dispose() {
		super.dispose(),
			this._store.save(this._eventsQueue.getEvents()),
			this._logger.debug("Disposing FileEditEventsWatcher")
	}
}