
var r8 = class {
		constructor(t, r, n) {
			this._uploadBatchFunction = t
			this._batchSize = r
			this._maxUploadDelayMs = n
		}
		_queue = []
		_queueNonEmptyTimer
		add(t) {
			if (
				(this._queue.push(t),
				this._queue.length === 1 &&
					(clearTimeout(this._queueNonEmptyTimer),
					(this._queueNonEmptyTimer = setTimeout(() => {
						this._uploadBatch()
					}, this._maxUploadDelayMs))),
				this._queue.length >= this._batchSize)
			) {
				let r = this._queue
				this._queue = []
				let n = { user_events: r }
				this._uploadBatchFunction(n)
			}
		}
		_uploadBatch() {
			let t = this._queue
			this._queue = []
			let r = t.length,
				n = { user_events: t }
			r !== 0 && this._uploadBatchFunction(n), clearTimeout(this._queueNonEmptyTimer)
		}
		dispose() {
			this.stop()
		}
		stop() {
			clearTimeout(this._queueNonEmptyTimer)
		}
	},
	n8 = class {
		constructor(t) {
			this._apiServer = t
			this._logger = X("UploadHandler")
		}
		_logger
		_lastErrorTime
		_uploadInterruptPeriodMs = 15e3
		async uploadUserEvents(t) {
			try {
				if (this._lastErrorTime ? Date.now() - this._lastErrorTime < this._uploadInterruptPeriodMs : !1) return
				await this._apiServer.uploadUserEvents(t)
			} catch (r) {
				throw (this._logger.info("Error uploading tracked events", r), (this._lastErrorTime = Date.now()), r)
			}
		}
	},
	D1 = class e extends z {
		constructor(r, n, i, s, o, a = e.defaultUploadBatchSize, l = e.defaultMaxUploadDelayMs) {
			super()
			this._pathResolver = n
			this._recentInstructions = i
			this._recentCompletions = s
			this._recentNextEditSuggestions = o
			;(this._uploadHandler = new n8(r)),
				(this._uploadQueue = new r8(
					(c) => void this._uploadHandler.uploadUserEvents.bind(this._uploadHandler)(c),
					a,
					l,
				)),
				this._createSubscriptions(),
				this.addDisposable(this._uploadQueue)
		}
		static defaultUploadBatchSize = 128
		static defaultMaxUploadDelayMs = 5e3
		_uploadQueue
		_uploadHandler
		_createSubscriptions() {
			this.addDisposable(T1.workspace.onDidChangeTextDocument(this._processChangeTextDocument.bind(this))),
				this.addDisposable(this._recentInstructions.onNewItems(this._processInstruction.bind(this))),
				this.addDisposable(this._recentCompletions.onNewItems(this._processCompletion.bind(this))),
				this.addDisposable(this._recentNextEditSuggestions.onNewItems(this._processNextEdit.bind(this)))
		}
		_processChangeTextDocument(r) {
			let n = r.document.uri.fsPath,
				i = new Date().toISOString(),
				s = this._pathResolver.resolvePathName(n)
			if (s === void 0 || r.contentChanges.length === 0) return
			let o = []
			for (let y of r.contentChanges) o.push(Y0t(r.document, y))
			let a = 500,
				l = r.document.getText().length,
				c = o.map((y) => new bo(y.range.start, y.range.end)).map((y) => y.offset(-a, a, 0, l)),
				u = vC.mergeTouching(c),
				f = u.map((y) =>
					r.document.getText(new T1.Range(r.document.positionAt(y.start), r.document.positionAt(y.stop))),
				),
				p = CC(new TextEncoder().encode(f.join(""))),
				g = {
					reason: r.reason,
					content_changes: o,
					after_changes_hash: p,
					source_folder_root: s.rootPath,
					hash_char_ranges: u.map((y) => ({ start: y.start, end: y.stop })),
					after_doc_length: l,
				},
				m = { time: i, file_path: s.relPath, text_edit: g }
			this._uploadQueue.add(m)
		}
		_processInstruction(r) {
			let n = { request_id: r.requestId },
				i = {
					time: r.requestedAt.toISOString(),
					file_path: r.pathName,
					edit_request_id_issued: n,
				}
			this._uploadQueue.add(i)
		}
		_processNextEdit(r) {
			let n = { request_id: r.requestId },
				i = {
					time: r.requestTime.toISOString(),
					file_path: r.qualifiedPathName?.relPath ?? "",
					next_edit_request_id_issued: n,
				}
			this._uploadQueue.add(i)
		}
		_processCompletion(r) {
			let n = {
				time: r.occuredAt.toISOString(),
				file_path: r.pathName ?? "",
				completion_request_id_issued: { request_id: r.requestId },
			}
			this._uploadQueue.add(n)
		}
	}