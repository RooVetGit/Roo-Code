
var EQ = class e extends z {
		constructor(r, n, i, s, o, a, l, c, u, f, p, g) {
			super()
			this._apiServer = r
			this._configListener = n
			this._workspaceManager = i
			this._diagnosticsManager = s
			this._nextEditSessionEventReporter = o
			this._clientMetricsReporter = a
			this._blobNameCalculator = l
			this._suggestionManager = c
			this._recentSuggestions = u
			this._stateController = f
			this._completionJustAccepted = p
			this._featureFlagManager = g
			this.addDisposable(
				new Ql.Disposable(() => {
					this._inflightRequest?.cancelTokenSource?.cancel(),
						this._inflightRequest?.cancelTokenSource?.dispose(),
						(this._inflightRequest = void 0),
						this.lastFinishedRequest.dispose(),
						this.lastResponse.dispose(),
						this.state.dispose()
				}),
			),
				this.addDisposable(
					new Ql.Disposable(
						this.state.listen((y) => {
							xc("vscode-augment.nextEdit.loading", y === "inflight")
						}),
					),
				)
			let m = (y) => {
				let C = y ?? this._featureFlagManager.currentFlags.nextEditDebounceMs
				this._processPendingRequestsDebounced && this._processPendingRequestsDebounced.cancel(),
					(this._processPendingRequestsDebounced = (0, F_e.debounce)(
						() => void this._processPendingRequests(),
						C,
					))
			}
			m(this._configListener.config.nextEdit.useDebounceMs),
				this.addDisposable(
					this._configListener.onDidChange((y) => {
						y.newConfig.nextEdit.useDebounceMs !== y.previousConfig.nextEdit.useDebounceMs &&
							m(y.newConfig.nextEdit.useDebounceMs)
					}),
				),
				this.addDisposable(
					Ql.workspace.onDidChangeTextDocument((y) => {
						y.contentChanges.length > 0 &&
							this._workspaceManager.safeResolvePathName(y.document.uri) &&
							(this._freshCompletedRequests = []),
							!(
								!Je.equals(this._inflightRequest?.qualifiedPathName, y.document.uri) &&
								!this._pendingRequests.some((C) => Je.equals(C.qualifiedPathName, y.document.uri))
							) &&
								y.contentChanges.length > 0 &&
								!this._suggestionManager.suggestionWasJustAccepted.value &&
								this.cancelAll()
					}),
				)
		}
		_logger = X("NextEditRequestManager")
		static _statusClearTimeoutMs = 2e3
		_pendingRequests = []
		_inflightRequest
		lastFinishedRequest = new ta(void 0)
		lastResponse = new ta(void 0)
		state = new ta("ready")
		_processPendingRequestsDebounced
		_freshCompletedRequests = []
		get hasInflightRequest() {
			return !!this._inflightRequest
		}
		get pendingQueueLength() {
			return this._pendingRequests.length
		}
		shouldNotEnqueueRequestReason(r, n, i, s) {
			let o = this._resolvePath(r),
				a = {
					mode: n,
					scope: i,
					selection: s ?? o?.selection,
					requestBlobName: o?.blobName,
					qualifiedPathName: r,
				},
				l = this._inflightRequest || this._pendingRequests[0]
			if (l && A8(a, l)) return `Skipping ${n}/${i} request because it is subsumed by inflight request ${l.id}.`
			let c = this._freshCompletedRequests.find((f) => A8(a, f)),
				u = `${r?.relPath}@${a.selection?.toString()}`
			if (c)
				return `Skipping ${n}/${i} request at ${u} because it is subsumed by ${c.id}, which was recently completed.`
		}
		enqueueRequest(r, n, i, s) {
			let o = this.shouldNotEnqueueRequestReason(r, n, i, s)
			if (o) {
				this._logger.debug(o)
				return
			}
			let a = this._resolvePath(r)
			s = s ?? a?.selection
			let l = `${r?.relPath}@${s?.toString()}`,
				c = {
					id: this._apiServer.createRequestId(),
					qualifiedPathName: r,
					mode: n,
					scope: i,
					enqueuedAt: Date.now(),
				}
			this._logger.debug(`Starting enqueuing ${n}/${i} request ${c.id} at ${l}.`)
			let u = this._inflightRequest || this._pendingRequests[0]
			u &&
				(c.mode === "FOREGROUND" || c.mode === "FORCED"
					? (this._logger.debug(`Clearing requests for foreground request @ ${l}.`), this.cancelAll())
					: c.mode === "BACKGROUND" &&
						  u.mode === "BACKGROUND" &&
						  !Je.equals(u.qualifiedPathName, c.qualifiedPathName)
						? (this._logger.debug(`Clearing requests for background request @ ${l}.`), this.cancelAll())
						: c.mode === "BACKGROUND" &&
							u.mode === "BACKGROUND" &&
							u.scope === "WORKSPACE" &&
							c.scope === "FILE" &&
							(this._logger.debug(
								`Clearing background workspace requests for background file request @ ${l}.`,
							),
							this.cancelAll()))
			let f = this._pendingRequests.find((p) => A8(c, p))
			return (
				f
					? this._logger.debug(
							`Skipping enqueueing request ${c.id} at ${l} because it is subsumed by ${f.id}, which is already pending.`,
						)
					: this._pendingRequests.push(c),
				(this.state.value = this._inflightRequest ? "inflight" : "pending"),
				this._processPendingRequestsDebounced(),
				(c.mode === "FOREGROUND" ||
					c.mode === "FORCED" ||
					this._suggestionManager.suggestionWasJustAccepted.value ||
					this._completionJustAccepted.value) &&
					this._processPendingRequestsDebounced.flush(),
				c.id
			)
		}
		cancelAll() {
			this._inflightRequest &&
				(this._logger.debug(`Cancelling inflight request ${this._inflightRequest.id}.`),
				this._inflightRequest.cancelTokenSource?.cancel(),
				this._inflightRequest.cancelTokenSource?.dispose(),
				(this._inflightRequest = void 0)),
				this._pendingRequests.length > 0 &&
					(this._logger.debug(
						`Cancelling ${this._pendingRequests.length} pending requests: ${this._pendingRequests
							.map((r) => r.id)
							.toString()}.`,
					),
					(this._pendingRequests = []),
					this._processPendingRequestsDebounced.cancel())
		}
		async _processPendingRequests() {
			if (this._inflightRequest) {
				this._logger.debug("Waiting for inflight request to complete.")
				return
			} else if (!this._pendingRequests.length) {
				this._logger.debug("Waiting for a request to be enqueued.")
				return
			}
			let [r] = this._pendingRequests.splice(0, 1),
				n = this._resolvePath(r.qualifiedPathName),
				i = Date.now() - r.enqueuedAt
			this._logger.debug(`Starting to process ${r.id} after ${i} ms.`)
			let s = n?.blobName,
				o = r.qualifiedPathName,
				a = n?.document,
				l = n?.selection,
				c = r.mode,
				u = r.scope,
				f = this._suggestionManager
					.getRejectedSuggestions()
					.filter(
						(b) =>
							b.changeType !== "noop" &&
							(u === "WORKSPACE" || o === void 0 || b.qualifiedPathName.equals(o)),
					)
					.map((b) => new ZR(b.qualifiedPathName.relPath, b.lineRange, b.result.charStart, b.result.charEnd)),
				p = r.id,
				g = (this._inflightRequest = {
					...r,
					requestBlobName: s,
					selection: l,
					cancelTokenSource: new Ql.CancellationTokenSource(),
				})
			this.state.value = "inflight"
			let m = this._stateController.setState(Jxe),
				y = He.ok,
				C = [],
				v = new Date()
			try {
				let b = Date.now(),
					w = M_e(
						{
							requestId: p,
							clientCreatedAt: new Date(),
							instruction: "",
							selectedCode: a?.getText(l && Ds(l, a)),
							prefix: l && a?.getText(Ds({ start: 0, stop: l.start }, a)),
							suffix: l && a?.getText(Ds({ start: l.stop, stop: a.lineCount }, a)),
							language: a?.languageId,
							pathName: o,
							mode: c,
							scope: u,
							blockedLocations: f,
							unindexedEditEvents: [],
							unindexedEditEventsBaseBlobNames: [],
						},
						this._workspaceManager,
						this._diagnosticsManager,
						this._apiServer,
						this._blobNameCalculator,
						this._configListener,
						g.cancelTokenSource.token,
						this._nextEditSessionEventReporter,
					),
					B = Date.now(),
					M = 0,
					Q = 0,
					O = 0,
					Y = b - g.enqueuedAt
				this._logger.debug(`[${g.id}] queued for ${Y} ms.`)
				for await (let ne of w) {
					if (((y = ne.status), !ne.suggestion)) break
					O++
					let me = Date.now() - g.enqueuedAt
					this._logger.debug(
						`[${ne.suggestion?.requestId}/${
							ne.suggestion?.result.suggestionId
						}] ${ne.suggestion?.changeType?.toString()} took ${me} ms since enqueue.`,
					),
						M === 0 && ne.suggestion !== void 0 && ne.suggestion.changeType !== "noop" && (M = me),
						O === 4 && M === 0 && (Q = me),
						(this.lastResponse.value = ne.suggestion),
						ne.suggestion && C.push(ne.suggestion)
				}
				let j = y === He.ok && C.length === 0
				if ((y === He.ok && !j && this._freshCompletedRequests.push(g), !j && g.mode === "BACKGROUND")) {
					this._clientMetricsReporter.report({
						client_metric: "next_edit_bg_stream_preprocessing_latency_ms",
						value: B - b,
					})
					let ne = Date.now() - g.enqueuedAt
					y === He.ok
						? this._clientMetricsReporter.report({
								client_metric: "next_edit_bg_stream_finish_latency_ms",
								value: ne,
							})
						: M > 0 || Q > 0
							? this._clientMetricsReporter.report({
									client_metric: "next_edit_bg_stream_partial_latency_ms",
									value: ne,
								})
							: y === He.cancelled
								? this._clientMetricsReporter.report({
										client_metric: "next_edit_bg_stream_cancel_latency_ms",
										value: ne,
									})
								: this._clientMetricsReporter.report({
										client_metric: "next_edit_bg_stream_error_latency_ms",
										value: ne,
									}),
						M > 0
							? this._clientMetricsReporter.report({
									client_metric: "next_edit_bg_first_change_latency_ms",
									value: M,
								})
							: Q > 0
								? this._clientMetricsReporter.report({
										client_metric: "next_edit_bg_sufficient_noops_latency_ms",
										value: Q,
									})
								: O < 4 &&
									y === He.ok &&
									this._clientMetricsReporter.report({
										client_metric: "next_edit_bg_sufficient_noops_latency_ms",
										value: ne,
									})
				}
			} catch (b) {
				this._logger.warn(`[${p}] Next edit failed: ${b}.`),
					this._nextEditSessionEventReporter.reportEvent(p, void 0, Date.now(), "error-api-error", "unknown")
			} finally {
				g === this._inflightRequest &&
					((this._inflightRequest = void 0),
					this._pendingRequests.length > 0
						? (this._processPendingRequestsDebounced(), this._processPendingRequestsDebounced.flush())
						: (this._logger.debug("No more pending requests."),
							(this.state.value = "ready"),
							y === He.ok &&
							!this._suggestionManager
								.getActiveSuggestions()
								.some((w) => w.state === "fresh" && w.changeType !== "noop")
								? myt(this._stateController.setState(zxe), e._statusClearTimeoutMs)
								: y !== He.cancelled &&
									y !== He.ok &&
									(this._stateController.setState(Kxe),
									this._logger.debug(`Request ${p} failed with status: ${y}.`))))
				let b = new XR(p, c, u, o, y, C, v)
				this._recentSuggestions.addItem(b),
					(this.lastFinishedRequest.value = b),
					m.dispose(),
					g.cancelTokenSource.dispose()
			}
		}
		clearCompletedRequests(r) {
			this._freshCompletedRequests = this._freshCompletedRequests.filter((n) => r !== void 0 && n.mode !== r)
		}
		_resolvePath(r) {
			let n = r && Je.from(r),
				i = n && this._findEditorForPath(n),
				s = i && i.document,
				o = s && this._blobNameCalculator.calculate(n.relPath, s.getText()),
				a = i && new Rn(i.selection.start.line, i.selection.end.line)
			return { blobName: o, document: s, selection: a }
		}
		_findEditorForPath(r) {
			let n = Je.from(r)
			return Ql.window.activeTextEditor &&
				this._workspaceManager.safeResolvePathName(Ql.window.activeTextEditor.document.uri)?.equals(n)
				? Ql.window.activeTextEditor
				: Ql.window.visibleTextEditors.find((i) =>
						this._workspaceManager.safeResolvePathName(i.document.uri)?.equals(n),
					)
		}
	},
	Ayt = 15