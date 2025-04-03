
var EN = class e extends z {
	constructor(r, n, i, s, o, a) {
		super()
		this._apiServer = r
		this._completionServer = n
		this._configListener = i
		this._blobNameCalculator = s
		this._pathMap = o
		this._sequenceGenerator = a
		;(this._logger = X("OpenFileManager")),
			(this._uploadQueue = new Ia(this._upload.bind(this))),
			this.addDisposable(this._uploadQueue),
			(this._verifyWaiters = new Ia(this._enqueueForVerify.bind(this))),
			this.addDisposable(this._verifyWaiters),
			(this._verifyWaitersKicker = new vc(this._verifyWaiters, dCt)),
			this.addDisposable(this._verifyWaitersKicker),
			(this._longWaiters = new Ia(this._enqueueForVerify.bind(this))),
			this.addDisposable(this._longWaiters),
			(this._longWaitersKicker = new vc(this._longWaiters, fCt)),
			this.addDisposable(this._longWaitersKicker),
			(this._verifyQueue = new Ia(this._verify.bind(this))),
			this.addDisposable(this._verifyQueue)
	}
	_trackedFolders = new Map()
	_uploadQueue
	_verifyWaiters
	_longWaiters
	_verifyWaitersKicker
	_longWaitersKicker
	_verifyQueue
	_verifyBatch = new Map()
	_prevUpdatedDocument
	_logger
	openSourceFolder(r) {
		if (this._trackedFolders.has(r)) throw new Error(`Source folder ${r} is already open`)
		return (
			this._trackedFolders.set(r, new Map()),
			this._logger.info(`Opened source folder ${r}`),
			new G_.Disposable(() => {
				this._closeSourceFolder(r)
			})
		)
	}
	_closeSourceFolder(r) {
		this._trackedFolders.delete(r), this._logger.info(`Closed source folder ${r}`)
	}
	startTracking(r, n, i) {
		this._trackDocument(r, n, i)
	}
	stopTracking(r, n, i) {
		let s = this._getFolder(r)
		if (s === void 0) return
		let o = s.get(n)
		o !== void 0 &&
			((i !== void 0 && o.documentType !== i) ||
				(s.delete(n),
				this._prevUpdatedDocument === o && (this._prevUpdatedDocument = void 0),
				this._logger.verbose(`stop tracking ${r}:${n}`)))
	}
	isTracked(r, n) {
		return this._getDocument(r, n) !== void 0
	}
	getTrackedPaths(r) {
		let n = this._getFolder(r)
		return n === void 0 ? new Array() : Array.from(n.keys())
	}
	loseFocus() {
		this._setFocus(void 0)
	}
	get _chunkSize() {
		return this._completionServer.completionParams.chunkSize
	}
	_getFolder(r) {
		return this._trackedFolders.get(r)
	}
	_getDocument(r, n, i) {
		let s = typeof r == "number" ? this._getFolder(r) : r
		if (s === void 0) return
		let o = s.get(n)
		if (o !== void 0 && !(i !== void 0 && o.key !== i)) return o
	}
	getBlobName(r, n) {
		return this._getDocument(r, n)?.getBlobName()
	}
	translateRange(r) {
		let n = this._getDocument(r.folderId, r.relPath)
		if (n === void 0 || n.uploadedBlobName === void 0) return
		let i = n.changesSinceUpload
		if (i === void 0) return
		let s = i.translate(r.beginOffset, r.endOffset - r.beginOffset)
		return {
			blobName: n.uploadedBlobName,
			beginOffset: s[0],
			endOffset: s[0] + s[1],
		}
	}
	notifyMissingBlob(r, n, i) {
		let s = this._getDocument(r, n)
		return s === void 0 || s.uploadedBlobName !== i
			? !1
			: (s.invalidateUploadState(), this._tryEnqueueUpload(r, n, "blob name reported missing", s), !0)
	}
	getRecencySummary(r) {
		let n = new Map(),
			i = new Array()
		for (let [s, o] of this._trackedFolders) {
			let a = new Map()
			n.set(s, a)
			for (let [l, c] of o) {
				if (c.embargoed || c.uploadedSeq === void 0) continue
				let u = c.recentChanges(!1)
				if (u === void 0 || u.blobName === void 0) continue
				a.set(l, u.blobName)
				let f = c.getText(),
					p = u.changeTracker.getChunks(r, f.length)
				if (p.length === 0) continue
				let g = this._blobNameCalculator.calculateNoThrow(l, f)
				for (let m of p)
					i.push({
						seq: m.seq,
						uploaded: m.seq <= c.uploadedSeq,
						folderId: s,
						pathName: l,
						blobName: u.blobName,
						text: f.slice(m.start, m.end),
						origStart: m.origStart,
						origLength: m.origLength,
						expectedBlobName: g,
					})
			}
		}
		return i.sort(e._compareChunks), { folderMap: n, recentChunks: i }
	}
	getRecentChunkInfo(r, n = !1) {
		let i = new Array()
		for (let [s, o] of this._trackedFolders)
			for (let [a, l] of o) {
				if (l.embargoed || l.uploadedSeq === void 0) continue
				let c = l.recentChanges(n)
				if (c === void 0) continue
				let u = c.changeTracker.getChunks(r, l.getText().length)
				if (u.length !== 0)
					for (let f of u)
						i.push({
							seq: f.seq,
							uploaded: f.seq <= l.uploadedSeq,
							folderId: s,
							pathName: a,
							blobName: c.blobName,
						})
			}
		return i.sort(e._compareChunks), i
	}
	static _compareChunks(r, n) {
		return r.uploaded === n.uploaded ? n.seq - r.seq : r.uploaded ? 1 : -1
	}
	applyTextDocumentChange(r, n, i) {
		let s = this._getDocument(r, n)
		if (s === void 0) {
			this._trackDocument(r, n, i.document)
			return
		}
		if (!this._prepareForUpdate(s) || i.contentChanges.length === 0) return
		let o = i.contentChanges.map((a) => [a.rangeOffset, a.rangeLength, a.text.length])
		this._applyChangedRanges(r, n, s, o)
	}
	applyNotebookChange(r, n, i) {
		let s = this._getDocument(r, n)
		if (s === void 0) {
			this._trackDocument(r, n, i.notebook)
			return
		}
		if (!this._prepareForUpdate(s) || i.contentChanges.length === 0) return
		let o = i.notebook.getCells().slice(),
			a = new Array()
		i.contentChanges
			.slice()
			.reverse()
			.forEach((l) => {
				o.splice(l.range.start, l.addedCells.length), o.splice(l.range.start, 0, ...l.removedCells)
				let c = o.slice(0, l.range.start).every((y) => y.kind === G_.NotebookCellKind.Markup),
					u = o.slice(l.range.end).every((y) => y.kind === G_.NotebookCellKind.Markup),
					f = Gy(o.slice(0, l.range.start)).length
				f > 0 && !c && !u && (f += l_.length)
				let p = !c || !u ? l_.length : 0,
					g = Gy(l.addedCells).length
				g > 0 && (g += p)
				let m = Gy(l.removedCells).length
				m > 0 && (m += p), (g > 0 || m > 0) && a.push([f, m, g])
			}),
			a.reverse(),
			this._applyChangedRanges(r, n, s, a)
	}
	_setFocus(r) {
		this._prevUpdatedDocument !== void 0 &&
			r !== this._prevUpdatedDocument &&
			(this._tryEnqueueUpload(
				this._prevUpdatedDocument.folderId,
				this._prevUpdatedDocument.pathName,
				"document lost focus",
			),
			this._purgeUnneededChangesets()),
			(this._prevUpdatedDocument = r)
	}
	_trackDocument(r, n, i) {
		let s = this._getFolder(r)
		if (s === void 0) throw new Error(`Source folder ${r} is not open`)
		let o = this._getDocument(s, n)
		if ((this._setFocus(o), o !== void 0)) return
		let a = this._sequenceGenerator.next(),
			l = yCt(i)
		if (l === void 0) {
			let p = i
			o = new g6(r, n, a, p, a)
		} else o = new p6(r, n, a, l, a)
		s.set(n, o)
		let c = o.getText(),
			u = this._blobNameCalculator.calculate(n, c)
		if (u === void 0) {
			this._embargo(r, n, o, "blob name calculation failed")
			return
		}
		this._pathMap.getAnyPathName(u) === void 0
			? this._tryEnqueueUpload(r, n, "new document has no blob name", o)
			: ((o.uploadedBlobName = u), (o.uploadedSeq = o.appliedSeq)),
			this._logger.verbose(`start tracking ${r}:${n}`)
	}
	_prepareForUpdate(r) {
		return this._setFocus(r), !r.embargoed
	}
	_applyChangedRanges(r, n, i, s) {
		let o = this._sequenceGenerator.next()
		i.recentChangesets.empty &&
			(i.addChangeset(o),
			this._logger.verbose(`apply: new changeset for ${r}:${n}; total = ${i.recentChangesets.length}`))
		let a = i.inProgressUpload
		for (let u of s) {
			let [f, p, g] = u
			a !== void 0 &&
				(a.savedChangeset !== void 0 && a.savedChangeset.changeTracker.apply(o, f, p, g),
				a.changesSinceUpload.apply(o, f, p, g)),
				i.applyAll(o, f, p, g),
				i.changesSinceUpload?.apply(o, f, p, g)
		}
		if (((i.appliedSeq = o), a !== void 0)) {
			let u = a.changesSinceUpload.length >= hCt
			u || (u = a.changesSinceUpload.countChunks(this._chunkSize) >= W_),
				u && this._cancelInProgressUpload(r, n, i)
		}
		if (i.changesSinceUpload !== void 0) {
			let u = i.changesSinceUpload.countChunks(this._chunkSize)
			u > 1 && this._tryEnqueueUpload(r, n, "multiple non-uploaded chunks", i),
				u >= W_ &&
					(this._logger.verbose(`apply: no longer tracking non-uploaded changes for ${r}:${n}`),
					(i.changesSinceUpload = void 0))
		}
		let c = i.recentChangesets.at(-1).changeTracker.countChunks(this._chunkSize)
		c >= Cwe &&
			(i.addChangeset(o),
			this._logger.verbose(
				`apply: new changeset for ${r}:${n}; chunks = ${c}; total = ${i.recentChangesets.length}`,
			))
	}
	_cancelInProgressUpload(r, n, i) {
		this._logger.verbose(`cancel in-progress upload: ${r}:${n}`),
			(i.inProgressUpload = void 0),
			(i.key = this._sequenceGenerator.next())
	}
	_validateInProgressUpload(r, n, i) {
		let s = this._getDocument(r, n, i)
		if (!(s === void 0 || s.inProgressUpload === void 0)) return [s, s.inProgressUpload]
	}
	_tryEnqueueUpload(r, n, i, s) {
		let o = s ?? this._getDocument(r, n)
		o !== void 0 &&
			(o.uploadRequested ||
				(o.appliedSeq !== o.uploadedSeq &&
					o.appliedSeq !== o.inProgressUpload?.uploadSeq &&
					(this._logger.verbose(`upload request: ${r}:${n}; reason = ${i}`),
					(o.uploadRequested = !0),
					o.uploadInProgress
						? this._logger.verbose(`upload request delayed: upload for ${r}:${n} already in progress`)
						: this._enqueueUpload(r, n, o.key))))
	}
	_retryUpload(r, n) {
		this._logger.verbose(`retry upload; ${r}:${n}`)
		let i = this._getDocument(r, n)
		if (i === void 0) {
			this._logger.verbose(`retry upload: document is no longer tracked; ${r}:${n}`)
			return
		}
		if (i.inProgressUpload !== void 0) {
			this._logger.verbose(`retry upload: upload already in progress; ${r}:${n}`)
			return
		}
		;(i.uploadRequested = !0), this._enqueueUpload(r, n, i.key)
	}
	_enqueueUpload(r, n, i) {
		this._uploadQueue.insert([r, n, i]) &&
			(this._logger.verbose(`enqueue upload: ${r}:${n}`), this._uploadQueue.kick())
	}
	async _upload(r) {
		if (r === void 0) return
		let [n, i, s] = r,
			o = this._getDocument(n, i, s)
		if (o === void 0) {
			this._logger.verbose(`upload: upload cancelled or no longer tracking document ${n}:${i}`)
			return
		}
		o.uploadRequested = !1
		let a = o.getText(),
			l = this._blobNameCalculator.calculate(i, a)
		if (l === void 0) {
			this._embargo(n, i, o, "failed to compute blob name")
			return
		}
		let c = o.longestHistory(!1),
			u =
				c === void 0 || c.blobName === void 0
					? void 0
					: {
							changeTracker: (0, ywe.cloneDeep)(c.changeTracker),
							blobName: c.blobName,
						}
		;(o.inProgressUpload = {
			uploadSeq: o.appliedSeq,
			blobName: l,
			savedChangeset: u,
			changesSinceUpload: new OC(),
		}),
			o.advanceAll(),
			(o.uploadedBlobName = void 0)
		let f
		try {
			this._logger.verbose(`upload: begin; ${n}:${i}, ${l}`)
			let g = Date.now()
			f = await xi(async () => {
				if (!(Date.now() - g > gCt) && this._validateInProgressUpload(n, i, s))
					return this._apiServer.memorize(i, a, l, [])
			}, this._logger)
		} catch (g) {
			return (
				this._logger.verbose(`upload: failed; ${n}:${i}, ${l}; ${Ye(g)};`),
				this._embargo(n, i, o, `upload encountered permanent error: ${Ye(g)}`)
			)
		}
		if (!this._validateInProgressUpload(n, i, s))
			return this._logger.verbose(`upload: upload cancelled; pathName = ${n}:${i}`), this._retryUpload(n, i)
		if (f === void 0)
			return (
				this._logger.verbose(`upload: upload timed out, cancelling; pathName = ${n}:${i}`),
				this._cancelInProgressUpload(n, i, o),
				this._retryUpload(n, i)
			)
		let p = f.blobName
		p === l
			? this._logger.verbose(`upload: completed; ${n}:${i}, ${p}`)
			: this._logger.error(
					`upload: completed with mismatched blobName; pathName, received, expected = ${n}:${i}, ${p}, ${l}`,
				),
			(o.inProgressUpload.blobName = p),
			this._enqueueVerifyWaiter({ folderId: n, pathName: i, key: s, startTime: Date.now() }, p)
	}
	_requeueVerifyWaiter(r, n) {
		let i = r.folderId,
			s = r.pathName
		if (!this._validateInProgressUpload(i, s, r.key))
			return (
				this._logger.verbose(`requeue verify-wait: upload cancelled; ${i}:${s}, ${n}`), this._retryUpload(i, s)
			)
		Date.now() - r.startTime > ACt
			? (this._logger.verbose(`verify-wait: enqueue long; pathName = ${i}:${s}`), this._longWaiters.insert(r))
			: this._enqueueVerifyWaiter(r, n)
	}
	_enqueueVerifyWaiter(r, n) {
		this._logger.verbose(`verify-wait: enqueue; ${r.folderId}:${r.pathName}, ${n}`), this._verifyWaiters.insert(r)
	}
	_enqueueForVerify(r) {
		return r === void 0
			? (this._verifyQueue.kick(), Promise.resolve())
			: (this._verifyQueue.insert(r), Promise.resolve())
	}
	_grabVerifyBatch() {
		if (this._verifyBatch.size === 0) return
		let r = this._verifyBatch
		return (this._verifyBatch = new Map()), r
	}
	async _verify(r) {
		if (r !== void 0) {
			let o = this._getDocument(r.folderId, r.pathName, r.key)
			if (o === void 0 || o.inProgressUpload === void 0) return
			let a = this._verifyBatch.get(o.inProgressUpload.blobName)
			if (
				(a === void 0 && ((a = new Array()), this._verifyBatch.set(o.inProgressUpload.blobName, a)),
				a.push(r),
				this._verifyBatch.size < uCt)
			)
				return
		}
		let n = this._grabVerifyBatch()
		if (n === void 0) return
		let i = [...n.keys()]
		this._logger.verbose(`verify batch: blob count = ${i.length}`)
		let s
		try {
			let o = Date.now()
			s = await xi(async () => {
				if (!(Date.now() - o > pCt)) return this._apiServer.findMissing(i)
			}, this._logger)
		} catch {}
		if (s === void 0) {
			this._logger.verbose("verify: timeout exceeded")
			for (let o of i) {
				let a = n.get(o)
				for (let l of a) this._requeueVerifyWaiter(l, o)
			}
		} else {
			this._logVerifyResult(s)
			let o = new Set(s.unknownBlobNames),
				a = new Set(s.nonindexedBlobNames)
			for (let [l, c] of n)
				if (o.has(l)) for (let u of c) this.notifyMissingBlob(u.folderId, u.pathName, l)
				else if (a.has(l)) for (let u of c) this._requeueVerifyWaiter(u, l)
				else for (let u of c) this._commit(u, l)
		}
	}
	_commit(r, n) {
		let i = r.folderId,
			s = r.pathName,
			o = this._validateInProgressUpload(i, s, r.key)
		if (o === void 0) {
			this._logger.verbose(`commit: upload cancelled for ${i}:${s}`)
			return
		}
		let [a, l] = o
		;(a.inProgressUpload = void 0),
			this._logger.verbose(`commit: ${i}:${s}, ${n}; uploadSeq = ${l.uploadSeq}`),
			(a.uploadedBlobName = n),
			(a.uploadedSeq = l.uploadSeq),
			(a.changesSinceUpload = l.changesSinceUpload),
			a.uploadRequested && this._retryUpload(r.folderId, r.pathName)
	}
	_purgeUnneededChangesets() {
		let r = this.getRecentChunkInfo(this._chunkSize, !0)
		if (r.length < W_) return
		let n = r[W_ - 1].seq,
			i = new Set()
		for (let s = W_; s < r.length; s++) {
			let o = this._getDocument(r[s].folderId, r[s].pathName)
			o !== void 0 && i.add(o)
		}
		for (let s of i) {
			if (s === void 0) continue
			let o = s.purgeChangesets(n)
			o > 0 && this._logger.verbose(`purge: removed ${o} changesets from ${s.folderId}:${s.pathName}`)
		}
	}
	_embargo(r, n, i, s) {
		this._logger.info(`embargoing: ${r}:${n} reason = ${s}`), i.embargo()
	}
	_logVerifyResult(r) {
		let n = r.unknownBlobNames.length > 0 ? "error" : "verbose"
		this._logger.log(
			n,
			`find-missing reported ${r.unknownBlobNames.length} unknown blob names and ${r.nonindexedBlobNames.length} nonindexed blob names.`,
		),
			r.unknownBlobNames.length > 0 &&
				(this._logger.log(n, "unknown blob names:"), cg(this._logger, n, r.unknownBlobNames, 5)),
			r.nonindexedBlobNames.length > 0 &&
				(this._logger.log(n, "nonindexed blob names:"), cg(this._logger, n, r.nonindexedBlobNames, 5))
	}
}