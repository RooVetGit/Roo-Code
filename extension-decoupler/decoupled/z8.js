
var Z8 = class extends O_ {
		constructor(r, n) {
			super()
			this._apiServer = r
			this._config = n
		}
		_onFoundIndexedBlobNamesEmitter = new q_.EventEmitter()
		_onFoundUnknownBlobNamesEmitter = new q_.EventEmitter()
		_pollingStartTime = new Map()
		_logger = X("FileUploader#BlobStatusExecutor")
		dispose() {
			super.dispose(),
				this._pollingStartTime.clear(),
				this._onFoundIndexedBlobNamesEmitter.dispose(),
				this._onFoundUnknownBlobNamesEmitter.dispose()
		}
		get onFoundIndexedBlobNames() {
			return this._onFoundIndexedBlobNamesEmitter.event
		}
		get onFoundUnknownBlobNames() {
			return this._onFoundUnknownBlobNamesEmitter.event
		}
		retryBlobNames(r) {
			let [s, o] = r.reduce(
				(a, l) => {
					let c = this._pollingStartTime.get(l)
					return c === void 0
						? (this._logger.debug(`[WARN] retryBlobNames: missing start time for ${l}`), a[1].push(l), a)
						: (Date.now() - c < this._config.oldBlobNameThresholdMs ? a[1].push(l) : a[0].push(l), a)
				},
				[[], []],
			)
			s.length > 0 && this.retry(s, this._config.newBlobNameRetryMs),
				o.length > 0 && this.retry(o, this._config.oldBlobNameRetryMs)
		}
		async internalProcess() {
			let r = new Set(),
				n = 0
			for (; n < this._config.maxBatchCount; ) {
				let o = this.dequeue()
				if (o === void 0) break
				r.add(o), this._pollingStartTime.has(o) || this._pollingStartTime.set(o, Date.now()), n++
			}
			this._logger.verbose(`FindMissingProcess started: for [${r.size}] items`)
			let i
			try {
				i = await xi(() => this._apiServer.findMissing([...r]), this._logger)
			} catch {
				this._logger.debug(`[ERROR] FindMissingProcess failed: for [${r.size}] items`),
					this.retryBlobNames([...r])
				return
			}
			if (i.unknownBlobNames.length > 0) {
				this._logger.debug(`FindMissingProcess found unknown: for [${i.unknownBlobNames.length}] items`)
				for (let o of i.unknownBlobNames) this._pollingStartTime.delete(o)
				this._onFoundUnknownBlobNamesEmitter.fire(i.unknownBlobNames)
			}
			i.nonindexedBlobNames.length > 0 &&
				(this._logger.debug(`FindMissingProcess found nonindexed: for [${i.nonindexedBlobNames.length}] items`),
				this.retryBlobNames(i.nonindexedBlobNames))
			let s = nCt(r, i)
			for (let o of s) this._pollingStartTime.delete(o)
			s.length > 0 &&
				(this._logger.verbose(`FindMissingProcess found not missing: for [${s.length}] items`),
				this._onFoundIndexedBlobNamesEmitter.fire(s))
		}
	},
	X8 = class extends O_ {
		constructor(r, n) {
			super()
			this._apiServer = r
			this._config = n
		}
		_onUploadedEmitter = new q_.EventEmitter()
		_onFailedEmitter = new q_.EventEmitter()
		_logger = X("FileUploader#UploadExecutor")
		dispose() {
			super.dispose(), this._onUploadedEmitter.dispose(), this._onFailedEmitter.dispose()
		}
		get onDidUpload() {
			return this._onUploadedEmitter.event
		}
		get onFailed() {
			return this._onFailedEmitter.event
		}
		async _processUpload(r) {
			let n = Date.now(),
				i
			this._logger.verbose(`Upload started [${n}]: for [${r.length}] items`),
				(i = await xi(() => this._apiServer.batchUpload(r), this._logger)),
				this._logger.debug(`Upload complete [${n}]: for [${i.blobNames.length} / ${r.length}] items`)
			let s = new Map()
			if (i !== void 0)
				for (let a = 0; a < i.blobNames.length; a++) {
					let l = r[a].blobName,
						c = i.blobNames[a]
					s.set(l, c), l !== c && this._logger.debug(`[WARN]Upload blob name mismatch: ${l} -> ${c}`)
				}
			let o = r.length - (i?.blobNames.length ?? 0)
			return { expectedToActualBlobNameMap: s, failedCount: o }
		}
		processResult(r, n) {
			let { expectedToActualBlobNameMap: i, failedCount: s } = r
			s > 0 &&
				(this._logger.debug(`[WARN] Scheduling for retry [${s}] items`),
				this.retry(n.slice(n.length - s), this._config.retryMs)),
				i.size > 0 && this._onUploadedEmitter.fire(i)
		}
		async internalProcess() {
			let r = 0,
				n = [],
				i = [],
				s = 0
			for (; !this.isDisposed() && s < this._config.maxBatchCount; ) {
				let o = this.peek()
				if (o === void 0) break
				let a = await o.readContent()
				if (a.length > this._config.maxUploadSize) {
					this._logger.debug(`[WARN] UploadExecutor: skipping upload for ${o.path} because it is too large`),
						this.dequeue()
					continue
				}
				if (r + a.length > this._config.maxUploadSize) break
				;(r += a.length),
					n.push({
						pathName: o.path,
						text: a,
						blobName: o.blobName,
						metadata: [],
					}),
					i.push(o),
					this.dequeue(),
					s++
			}
			if (n.length === 0) {
				this._logger.debug("UploadExecutor: no items to upload")
				return
			}
			try {
				let o = await this._processUpload(n)
				this.processResult(o, i)
			} catch (o) {
				this._logger.debug(
					`[ERROR] UploadExecutor failed: for [${n.length}] items. Caused by: ${o.message} ${o.stack}`,
				),
					await this.processIndividualUploads(i, n)
			}
		}
		async processIndividualUploads(r, n) {
			for (let i = 0; i < r.length; i++) {
				let s = r[i],
					o = n[i]
				try {
					let a = await this._processUpload([o])
					this.processResult(a, [s])
				} catch {
					this._logger.debug(`[ERROR] UploadExecutor failed: for [${s.blobName}]`),
						this._onFailedEmitter.fire(s)
				}
			}
		}
	},
	iCt = {
		uploadConfig: { maxUploadSize: 1e7, maxBatchCount: 128, retryMs: 6e4 },
		blobStatusConfig: {
			maxBatchCount: 1e3,
			oldBlobNameThresholdMs: 6e4,
			oldBlobNameRetryMs: 6e4,
			newBlobNameRetryMs: 3e3,
		},
	},
	dN = class extends z {
		constructor(r, n, i = iCt) {
			super()
			this._blobNameCalculator = r
			this._apiServer = n
			this._config = i
			;(this._uploadExecutor = new X8(n, i.uploadConfig)),
				(this._blobStatusExecutor = new Z8(n, i.blobStatusConfig)),
				this.addDisposables(
					{
						dispose: () => {
							this._handledItems.clear()
						},
					},
					this._uploadExecutor,
					this._blobStatusExecutor,
					this._uploadExecutor.onDidUpload((s) => {
						K8.fire({ expectedToActualBlobNameMap: s })
						for (let [o, a] of s)
							this._handledItems.has(o) &&
								(o !== a &&
									(this._handledItems.set(a, this._handledItems.get(o)),
									this._handledItems.delete(o)),
								this._blobStatusExecutor.enqueue(a))
						this._blobStatusExecutor.startProcess()
					}),
					this._uploadExecutor.onFailed((s) => {
						this._logger.debug(`[ERROR] Upload failed: ${s.path}`),
							this._handledItems.delete(s.blobName),
							$8.fire({ blobName: s.blobName })
					}),
					this._blobStatusExecutor.onFoundIndexedBlobNames((s) => {
						for (let o of s) this._handledItems.delete(o)
						z8.fire({ blobNames: s })
					}),
					this._blobStatusExecutor.onFoundUnknownBlobNames((s) => {
						for (let o of s) {
							let a = this._handledItems.get(o)
							a && this._uploadExecutor.enqueue(a)
						}
						this._uploadExecutor.startProcess()
					}),
				)
		}
		_logger = X("BlobUploaderImpl")
		_uploadExecutor
		_blobStatusExecutor
		_handledItems = new Map()
		enqueueUpload(r, n) {
			let i = this._blobNameCalculator.calculate(r.path, n)
			if (i === void 0) {
				this._logger.debug(`blobNameCalculator returned undefined for ${r.path}`)
				return
			}
			let s = { ...r, blobName: i }
			return (
				this._handledItems.set(i, s),
				this._logger.debug(`upload: ${r.path}. total: ${this._handledItems.size}`),
				this._blobStatusExecutor.enqueue(i),
				i
			)
		}
		startUpload() {
			this._blobStatusExecutor.startProcess()
		}
	}