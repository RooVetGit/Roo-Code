
var u6 = class {
		constructor(t, r) {
			this.maxItems = t
			this.maxByteSize = r
		}
		items = new Map()
		byteSize = 0
		addItem(t, r) {
			let n = this.items.get(t)
			if (n === void 0) {
				if (this.items.size >= this.maxItems || this.byteSize + r.byteSize >= this.maxByteSize) return !1
				this.items.set(t, [r]), (this.byteSize += r.byteSize)
			} else n.push(r)
			return !0
		}
	},
	d6 = class {
		constructor(t) {
			this.maxItemCount = t
		}
		items = new Map()
		get full() {
			return this.items.size >= this.maxItemCount
		}
		addItem(t, r) {
			if (this.items.has(t)) return !1
			this.items.set(t, r)
		}
	},
	mN = class e extends z {
		constructor(r, n, i, s, o) {
			super()
			this.workspaceName = r
			this._apiServer = n
			this._pathHandler = i
			this._pathMap = s
			;(this._logger = X(`DiskFileManager[${r}]`)),
				o === void 0
					? (this._probeBatchSize = e.maxProbeBatchSize)
					: (o < e.minProbeBatchSize
							? this._logger.verbose(
									`Rejecting requested probe batch size of ${o} (min = ${e.minProbeBatchSize})`,
								)
							: o > e.maxProbeBatchSize &&
								this._logger.verbose(
									`Rejecting requested probe batch size of ${o} (max = ${e.maxProbeBatchSize})`,
								),
						(this._probeBatchSize = Math.max(Math.min(o, e.maxProbeBatchSize), e.minProbeBatchSize))),
				(this._toCalculate = new $o(this._calculate.bind(this))),
				this.addDisposable(this._toCalculate),
				(this._toProbe = new $o(this._probe.bind(this))),
				this.addDisposable(this._toProbe),
				(this._probeBatch = this._newProbeBatch()),
				(this._toUpload = new $o(this._upload.bind(this))),
				this.addDisposable(this._toUpload),
				(this._uploadBatch = this._newUploadBatch()),
				(this._probeRetryWaiters = new $o(this._enqueueForProbe.bind(this))),
				this.addDisposable(this._probeRetryWaiters),
				(this._probeRetryKicker = new vc(this._probeRetryWaiters, e.probeRetryPeriodMs)),
				this.addDisposable(this._probeRetryKicker),
				(this._probeRetryBackoffWaiters = new $o(this._enqueueForProbe.bind(this))),
				(this._probeRetryBackoffKicker = new vc(this._probeRetryBackoffWaiters, e.probeRetryBackoffPeriodMs)),
				this.addDisposable(this._probeRetryBackoffKicker)
		}
		static minProbeBatchSize = 1
		static maxProbeBatchSize = 1e3
		static maxUploadBatchBlobCount = 128
		static maxUploadBatchByteSize = 1e6
		static probeRetryPeriodMs = 3 * 1e3
		static probeBackoffAfterMs = 60 * 1e3
		static probeRetryBackoffPeriodMs = 60 * 1e3
		_notAPlainFile = "Not a file"
		_fileNotAccessible = "File not readable"
		_fileNotText = "Binary file"
		_fileUploadFailure = "Upload failed"
		_onDidChangeInProgressItemCountEmitter = new H_.EventEmitter()
		onDidChangeInProgressItemCount = this._onDidChangeInProgressItemCountEmitter.event
		_onQuiescedEmitter = new H_.EventEmitter()
		_onQuiesced = this._onQuiescedEmitter.event
		_textDecoder = new TextDecoder("utf-8", { ignoreBOM: !0, fatal: !0 })
		_toCalculate
		_toProbe
		_probeBatch
		_probeBatchSize
		_probeRetryWaiters
		_probeRetryKicker
		_probeRetryBackoffWaiters
		_probeRetryBackoffKicker
		_toUpload
		_uploadBatch
		_itemsInFlight = new Map()
		_seq = 1e3
		metrics = new NC("File metrics")
		_logger
		_stopping = !1
		_pathsAccepted = this.metrics.counterMetric("paths accepted")
		_pathsNotAccessible = this.metrics.counterMetric("paths not accessible")
		_nonFiles = this.metrics.counterMetric("not plain files")
		_largeFiles = this.metrics.counterMetric("large files")
		_blobNameCalculationFails = this.metrics.counterMetric("blob name calculation fails")
		_encodingErrors = this.metrics.counterMetric("encoding errors")
		_mtimeCacheHits = this.metrics.counterMetric("mtime cache hits")
		_mtimeCacheMisses = this.metrics.counterMetric("mtime cache misses")
		_probeBatches = this.metrics.counterMetric("probe batches")
		_blobNamesProbed = this.metrics.counterMetric("blob names probed")
		_filesRead = this.metrics.counterMetric("files read")
		_blobsUploaded = this.metrics.counterMetric("blobs uploaded")
		_ingestPathMs = this.metrics.timingMetric("ingestPath")
		_probeMs = this.metrics.timingMetric("probe")
		_statMs = this.metrics.timingMetric("stat")
		_readMs = this.metrics.timingMetric("read")
		_uploadMs = this.metrics.timingMetric("upload")
		stop() {
			this.dispose()
		}
		dispose() {
			;(this._stopping = !0), super.dispose()
		}
		get probeBatchSize() {
			return this._probeBatchSize
		}
		get itemsInFlight() {
			return this._itemsInFlight.size
		}
		ingestPath(r, n) {
			this._ingestPathMs.start(),
				!this._stopping && ((n = ume(n)), this._enqueueForCalculate(r, n), this._ingestPathMs.stop())
		}
		async awaitQuiesced() {
			if (!(this._stopping || this._itemsInFlight.size === 0)) return $p(this._onQuiesced)
		}
		_nextSeq() {
			return this._seq++
		}
		_makeAbsPath(r, n) {
			let i = this._pathMap.getRepoRoot(r)
			if (i !== void 0) return $t(i, n)
		}
		_fileTooLargeString(r) {
			return `File too large (${r} > ${this._pathHandler.maxBlobSize})`
		}
		_getMtime(r, n, i, s) {
			this._statMs.start()
			let o = this._pathHandler.classifyPath(r)
			switch ((this._statMs.stop(), o.type)) {
				case "inaccessible":
					this._pathsNotAccessible.increment(), this._pathMapInvalidate(n, i, s, this._fileNotAccessible)
					return
				case "not a file":
					this._nonFiles.increment(), this._pathMapInvalidate(n, i, s, this._notAPlainFile)
					return
				case "large file":
					this._largeFiles.increment(), this._pathMapInvalidate(n, i, s, this._fileTooLargeString(o.size))
					return
				case "accepted":
					return o.mtime
			}
		}
		async _readAndValidate(r, n, i, s) {
			this._readMs.start()
			let o = await this._pathHandler.readText(r)
			switch ((this._readMs.stop(), this._filesRead.increment(), o.type)) {
				case "inaccessible":
					this._pathsNotAccessible.increment(), this._pathMapInvalidate(n, i, s, this._fileNotAccessible)
					return
				case "large file":
					this._largeFiles.increment(), this._pathMapInvalidate(n, i, s, this._fileTooLargeString(o.size))
					return
				case "binary":
					this._pathMapInvalidate(n, i, s, this._fileNotText)
					return
				case "text":
					return o.contents
			}
		}
		_calculateBlobName(r, n, i, s) {
			try {
				return this._pathHandler.calculateBlobName(r, n)
			} catch (o) {
				if (o instanceof fE) {
					this._largeFiles.increment()
					let a = this._fileTooLargeString(n.length)
					this._pathMapInvalidate(i, r, s, a)
				} else this._blobNameCalculationFails.increment(), this._pathMapInvalidate(i, r, s, Ye(o))
				return
			}
		}
		async _calculate(r) {
			if (r === void 0) return
			let [n, [i, s]] = r
			if (!this._pathMapVerify(i, s, n)) return
			let o = this._makeAbsPath(i, s)
			if (o === void 0) {
				this._inflightItemRemove(n)
				return
			}
			let a = this._getMtime(o, i, s, n)
			if (a === void 0) return
			let l,
				c = this._pathMap.getBlobInfo(i, s, a)
			if (c !== void 0) {
				this._mtimeCacheHits.increment()
				let [f, p] = c
				if (p > 0) {
					this._pathMapUpdate(i, s, n, f, a)
					return
				}
				l = f
			} else {
				let f = await this._readAndValidate(o, i, s, n)
				if (
					f === void 0 ||
					(this._mtimeCacheMisses.increment(), (l = this._calculateBlobName(s, f, i, n)), l === void 0)
				)
					return
			}
			this._pathsAccepted.increment()
			let u = {
				folderId: i,
				relPath: s,
				blobName: l,
				mtime: a,
				startTime: Date.now(),
			}
			this._enqueueForProbeRetry(n, u)
		}
		_newProbeBatch() {
			return new d6(this._probeBatchSize)
		}
		_grabProbeBatch() {
			if (this._probeBatch.items.size === 0) return
			let r = this._probeBatch
			return (this._probeBatch = this._newProbeBatch()), r
		}
		async _probe(r) {
			if (r !== void 0) {
				let [o, a] = r
				if (
					!this._pathMapVerify(a.folderId, a.relPath, o) ||
					(this._probeBatch.addItem(o, a), !this._probeBatch.full)
				)
					return
			}
			let n = this._grabProbeBatch()
			if (n === void 0) return
			let i = new Set()
			for (let [o, a] of n.items) i.add(a.blobName)
			this._probeBatches.increment(),
				this._blobNamesProbed.increment(n.items.size),
				this._logger.verbose(`probe ${i.size} blobs`),
				this._probeMs.start()
			let s
			try {
				s = await xi(async () => this._apiServer.findMissing([...i]), this._logger)
			} catch {}
			if ((this._probeMs.stop(), s !== void 0)) {
				this._logger.verbose(
					`find-missing reported ${s.unknownBlobNames.length} unknown blob names and ${s.nonindexedBlobNames.length} nonindexed blob names.`,
				),
					s.unknownBlobNames.length > 0 &&
						(this._logger.verbose("unknown blob names:"),
						cg(this._logger, "verbose", s.unknownBlobNames, 5)),
					s.nonindexedBlobNames.length > 0 &&
						(this._logger.verbose("nonindexed blob names:"),
						cg(this._logger, "verbose", s.nonindexedBlobNames, 5))
				let o = new Set(s.unknownBlobNames),
					a = new Set(s.nonindexedBlobNames),
					l = this._beginUploadBatch()
				for (let [c, u] of n.items)
					this._pathMapVerify(u.folderId, u.relPath, c) &&
						(o.has(u.blobName)
							? this._enqueueForUpload(c, u.folderId, u.relPath, !1)
							: a.has(u.blobName)
								? this._enqueueForProbeRetry(c, u)
								: this._pathMapUpdate(u.folderId, u.relPath, c, u.blobName, u.mtime))
				l.dispose()
			} else for (let [o, a] of n.items) this._enqueueForProbeRetry(o, a)
		}
		_newUploadBatch() {
			return new u6(e.maxUploadBatchBlobCount, e.maxUploadBatchByteSize)
		}
		_grabUploadBatch() {
			if (this._uploadBatch.items.size === 0) return
			let r = this._uploadBatch
			return (this._uploadBatch = this._newUploadBatch()), r
		}
		async _upload(r) {
			let n
			if (r !== void 0) {
				let [a, { seq: l, folderId: c, relPath: u }] = r
				if (!this._pathMapVerify(c, u, l)) return
				let f = this._getMtime(a, c, u, l)
				if (f === void 0) return
				let p = await this._readAndValidate(a, c, u, l)
				if (p === void 0) return
				let g = this._calculateBlobName(u, p, c, l)
				if (g === void 0) return
				let m
				try {
					m = this._textDecoder.decode(p)
				} catch (C) {
					this._pathMapInvalidate(c, u, l, Ye(C)), this._encodingErrors.increment()
					return
				}
				let y = {
					seq: l,
					folderId: c,
					pathName: u,
					text: m,
					blobName: g,
					mtime: f,
					byteSize: p.length,
					metadata: [],
				}
				if (this._uploadBatch.addItem(g, y)) return
				n = y
			}
			let i = this._grabUploadBatch()
			if (i === void 0) return
			n !== void 0 && this._uploadBatch.addItem(n.blobName, n),
				this._logger.verbose(`upload ${i.items.size} blobs`)
			let s = new Array()
			for (let [a, l] of i.items) s.push(l[0])
			this._uploadMs.start()
			let o = await this._uploadBlobBatch(s)
			this._uploadMs.stop(), this._blobsUploaded.increment(o.size)
			for (let [a, l] of i.items) {
				let c = o.get(a)
				if (c === void 0)
					for (let u of l) this._pathMapInvalidate(u.folderId, u.pathName, u.seq, this._fileUploadFailure)
				else
					for (let u of l) {
						let f = {
							folderId: u.folderId,
							relPath: u.pathName,
							blobName: c,
							mtime: u.mtime,
							startTime: Date.now(),
						}
						this._enqueueForProbeRetry(u.seq, f)
					}
			}
		}
		async _uploadBlobBatch(r) {
			this._logger.verbose(`upload begin: ${r.length} blobs`)
			for (let s of r) this._logger.verbose(`    - ${s.folderId}:${s.pathName}; expected blob name ${s.blobName}`)
			let n
			try {
				n = await xi(async () => await this._apiServer.batchUpload(r), this._logger)
			} catch (s) {
				this._logger.error(`batch upload failed: ${Ye(s)}`)
			}
			let i = new Map()
			if (n !== void 0) for (let s = 0; s < n.blobNames.length; s++) i.set(r[s].blobName, n.blobNames[s])
			return await this._uploadBlobsSequentially(r, n?.blobNames.length ?? 0, i), i
		}
		async _uploadBlobsSequentially(r, n, i) {
			for (let s = n; s < r.length; s++) {
				let o = r[s]
				try {
					this._logger.verbose(`sequential upload of ${o.pathName} -> ${o.blobName}`)
					let a = await xi(
						async () => this._apiServer.memorize(o.pathName, o.text, o.blobName, []),
						this._logger,
					)
					i.set(o.blobName, a.blobName)
				} catch {}
			}
		}
		_inflightItemAdd(r, n, i) {
			this._itemsInFlight.set(r, [n, i])
		}
		_inflightItemRemove(r) {
			this._itemsInFlight.delete(r),
				this._onDidChangeInProgressItemCountEmitter.fire(this._itemsInFlight.size),
				this._itemsInFlight.size === 0 &&
					(this._logger.verbose("inflight items signaling empty"), this._onQuiescedEmitter.fire())
		}
		_pathMapVerify(r, n, i) {
			if (!this._pathMap.shouldTrack(r, n)) return this._inflightItemRemove(i), !1
			let s = this._pathMap.getContentSeq(r, n)
			return s !== void 0 && s >= i ? (this._inflightItemRemove(i), !1) : !0
		}
		_pathMapUpdate(r, n, i, s, o) {
			this._inflightItemRemove(i), this._pathMap.update(r, n, i, s, o)
		}
		_pathMapInvalidate(r, n, i, s) {
			this._logger.verbose(`path map invalidate: ${r}:${n} (${s})`),
				this._pathMap.markUntrackable(r, n, i, s),
				this._inflightItemRemove(i),
				this._pathMap.markUntrackable(r, n, i, s)
		}
		_enqueueForCalculate(r, n) {
			let i = this._nextSeq()
			this._inflightItemAdd(i, r, n),
				this._toCalculate.insert(i, [r, n]) ? this._toCalculate.kick() : this._inflightItemRemove(i)
		}
		_enqueueForProbe(r) {
			if (r === void 0) this._toProbe.kick()
			else {
				let [n, i] = r
				this._logger.verbose(`probe enqueue ${i.blobName} -> ${n}, ${i.folderId}:${i.relPath}`),
					this._toProbe.insert(n, i)
			}
			return Promise.resolve()
		}
		_beginUploadBatch() {
			return new H_.Disposable(() => this._toUpload.kick())
		}
		_enqueueForUpload(r, n, i, s = !0) {
			this._logger.verbose(`upload enqueue ${n}:${i} -> ${r}`)
			let o = this._makeAbsPath(n, i)
			if (o === void 0) {
				this._inflightItemRemove(r)
				return
			}
			let a = this._toUpload.get(o)
			if (a !== void 0) {
				let l = a.seq
				if (l > r) this._inflightItemRemove(l)
				else if (l < r) {
					this._inflightItemRemove(r)
					return
				}
			}
			this._toUpload.insert(o, { seq: r, folderId: n, relPath: i }, !0), s && this._toUpload.kick()
		}
		_enqueueForProbeRetry(r, n) {
			Date.now() - n.startTime < e.probeBackoffAfterMs
				? (this._logger.verbose(`probe-retry enqueue ${n.blobName} -> ${r}, ${n.folderId}:${n.relPath}`),
					this._probeRetryWaiters.insert(r, n))
				: (this._logger.verbose(
						`probe-retry enqueue backoff ${n.blobName} -> ${r}, ${n.folderId}:${n.relPath}`,
					),
					this._probeRetryBackoffWaiters.insert(r, n))
		}
	}