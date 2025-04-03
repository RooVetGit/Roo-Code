
var rdt = 8e5,
	Qx = class {
		_selectedCodeReferenceRequestId = void 0
		_selectedCodeReferenceRequestIdOptionB = void 0
		_selectedCode = void 0
		_filePath = void 0
		_maybeUpdateSelectedCodeReferenceRequestId(t, r, n) {
			let i = n ? this._selectedCodeReferenceRequestIdOptionB : this._selectedCodeReferenceRequestId
			return (
				i === void 0 &&
					r &&
					(n
						? (this._selectedCodeReferenceRequestIdOptionB = t.requestId)
						: (this._selectedCodeReferenceRequestId = t.requestId),
					(i = ky._newRequestReferenceId)),
				i
			)
		}
	},
	ky = class e extends z {
		constructor(r, n, i, s, o, a) {
			super()
			this._globalState = r
			this._apiServer = n
			this._workspaceManager = i
			this._recentChats = s
			this._fuzzySymbolSearcher = o
			this._assetManager = a
			;(this.selectionCache = new Uh(this._globalState, "requestIdSelectionMetadata", { lru: { max: 1e3 } })),
				this.addDisposables(
					r0e.window.onDidChangeTextEditorSelection(() => {
						this._selectedCodeReferenceRequestId = void 0
					}),
					{ dispose: () => this._chatStreams.clear() },
					this.selectionCache,
				)
		}
		_chatStreams = new Map()
		static _newRequestReferenceId = "new"
		_selectedCodeReferenceRequestId
		_preferenceState = new Qx()
		selectionCache
		getDiagnostics = (r) => ({ type: "get-diagnostics-response", data: Bme() })
		_maybeUpdateSelectedCodeReferenceRequestId(r, n) {
			let i = this._selectedCodeReferenceRequestId
			return (
				i === void 0 &&
					n &&
					((this._selectedCodeReferenceRequestId = r.requestId),
					(i = e._newRequestReferenceId),
					this.selectionCache.set(r.requestId, n)),
				i
			)
		}
		async _getVCSChange() {
			return this._workspaceManager !== void 0
				? await this._workspaceManager.getVCSChange()
				: { commits: [], workingDirectory: [] }
		}
		async chat(r, n, i) {
			this._recentChats.addItem(r), X("ChatModel").debug(`Sending chat request with ID: ${r.requestId}`)
			let o
			i === void 0
				? (o = this._maybeUpdateSelectedCodeReferenceRequestId(r, n))
				: ((o = this._preferenceState._maybeUpdateSelectedCodeReferenceRequestId(r, n, i.useOptionB)),
					n?.selectedCode &&
						((this._preferenceState._selectedCode = n.selectedCode),
						(this._preferenceState._filePath = n.path)),
					r.selectedCode &&
						((this._preferenceState._selectedCode = r.selectedCode),
						(this._preferenceState._filePath = r.pathName)))
			let a = await this._getVCSChange(),
				l = this._getRecentChanges(),
				c = await this._apiServer.chat(
					r.requestId,
					r.message,
					r.chatHistory,
					r.blobs,
					r.userGuidedBlobs,
					r.externalSourceIds,
					r.modelId,
					a,
					l,
					o,
					n?.selectedCode || r.selectedCode,
					n?.prefix || r.prefix,
					n?.suffix || r.suffix,
					n?.path || r.pathName,
					n?.language || r.language,
				)
			return (c.workspaceFileChunks = OW(c.workspaceFileChunks || [])), c
		}
		getReferenceReqId() {
			return this._selectedCodeReferenceRequestId
		}
		cancelChatStream = (r) => {
			this._chatStreams.get(r)?.cancel()
		}
		async *getChatStream(r) {
			let n = this._chatStreams.get(r.data.requestId)
			if (n) yield* n.copy()
			else throw new Error(`Chat stream with ID ${r.data.requestId} not found`)
		}
		deleteChatStream = (r) => {
			this._chatStreams.get(r)?.cancel(), this._chatStreams.delete(r)
		}
		async *chatStream(r, n, i) {
			this._recentChats.addItem(r),
				yield* this._chatStreams.get(r.requestId)?.copy() ?? this.startChatStream(r, n, i)
		}
		_getRecentChanges() {
			let r = this._workspaceManager.getContext()
			return By(r.recentChunks)
		}
		resolveWorkspaceFileChunk = async (r) => {
			let n = r.data,
				i = this._workspaceManager.getAllPathNames(n.blobName)[0]
			if (!i) throw new Error(`File chunk with blobName=${n.blobName} not found`)
			return {
				type: "resolve-workspace-file-chunk-response",
				data: await t0e(i, n),
			}
		}
		async *startChatStream(r, n, i) {
			let s = r.requestId,
				o = this._chatStreams.get(s)
			if (o) throw new Error(`Chat stream with ID ${s} already exists`)
			{
				X("ChatModel").debug(`Sending chat stream request with ID: ${r.requestId}`)
				let l
				i === void 0
					? (l = this._maybeUpdateSelectedCodeReferenceRequestId(r, n))
					: ((l = this._preferenceState._maybeUpdateSelectedCodeReferenceRequestId(r, n, i.useOptionB)),
						n?.selectedCode &&
							((this._preferenceState._selectedCode = n.selectedCode),
							(this._preferenceState._filePath = n.path)),
						r.selectedCode &&
							((this._preferenceState._selectedCode = r.selectedCode),
							(this._preferenceState._filePath = r.pathName)))
				let c = await this._getVCSChange(),
					u = this._getRecentChanges(),
					f = n?.path || r.pathName,
					p = f ? this._workspaceManager.getAllQualifiedPathNames(f)[0] : void 0,
					g = n?.prefix || r.prefix,
					m = n?.suffix || r.suffix,
					y = n?.language || r.language,
					C = n?.selectedCode || r.selectedCode,
					v = await this.hydrateChatHistory(r.chatHistory),
					b = this.limitChatHistory(v),
					w = r.nodes ? await this.hydrateRequestNodes(r.nodes) : [],
					B = p
						? this._workspaceManager.getFolderRoot(p?.absPath)
						: this._workspaceManager.getMostRecentlyChangedFolderRoot(),
					M = B ? this._workspaceManager.getRepoRootForFolderRoot(B) : void 0,
					Q = vl(M ?? "", B ?? "")
				Q !== "" && Q !== "." && (r = sdt(r, Q))
				let O = await this._apiServer.chatStream(
						r.requestId,
						r.message,
						b,
						r.blobs,
						r.userGuidedBlobs,
						r.externalSourceIds,
						r.modelId,
						c,
						u,
						l,
						C,
						g,
						m,
						f,
						y,
						i && i.useOptionB ? this._apiServer.sessionId + "-B" : void 0,
						i?.disableAutoExternalSources,
						r.userGuidelines,
						r.workspaceGuidelines,
						r.toolDefinitions,
						w,
						r.mode,
						r.agentMemories,
					),
					Y
				n?.path && p
					? (Y = {
							charStart: g?.length ?? 0,
							charEnd: (g?.length ?? 0) + (C?.length ?? 0),
							blobName: this._workspaceManager.getBlobName(p) ?? "",
						})
					: (Y = void 0),
					(o = new Jp(
						ndt(s, Y, O, async (j) => {
							try {
								let ne = await this.resolveWorkspaceFileChunk({
									type: "resolve-workspace-file-chunk",
									data: j,
								})
								return this._fuzzySymbolSearcher.warmupCache(j.blobName), { ...j, file: ne.data }
							} catch {
								return j
							}
						}),
					)),
					this._chatStreams.set(s, o),
					yield* o.copy()
			}
		}
		sendFeedback = async (r) => (
			await this._apiServer.chatFeedback(r.data), { type: "chat-rating-done", data: r.data }
		)
		saveConversation = async (r) => {
			let n = X("ChatModel"),
				i = await this._apiServer.saveChat(r.data.conversationId, r.data.chatHistory, r.data.title)
			return n.debug(`Saved chat with api server: ${i.url}`), { type: "save-chat-done", data: i }
		}
		hydrateRequestNodes = (r) => {
			let n = X("ChatModel")
			return Promise.all(
				r.map(async (i) => {
					if (i.type === $c.IMAGE_ID) {
						if (!i.image_id_node) return n.error("Invalid image_id_node: missing image_id_node"), i
						let s = i.image_id_node.image_id,
							o = await this._assetManager.loadAsset(s ?? "")
						if (!o) return n.error(`Failed to load asset ${s}`), i
						let a = Buffer.from(o)
							.toString("base64")
							.replace(/^data:.*?;base64,/, "")
						return {
							type: $c.IMAGE,
							id: i.id,
							image_node: { image_data: a, format: _I.PNG },
						}
					}
					return i
				}),
			)
		}
		hydrateChatHistory = async (r) =>
			Promise.all(
				r.map(
					async (n) => (
						n.request_nodes && (n.request_nodes = await this.hydrateRequestNodes(n.request_nodes)), n
					),
				),
			)
		limitChatHistory = (r) => {
			let n = r.length - 1,
				i = 0
			for (; n >= 0; ) {
				let s = r[n]
				if (((i += JSON.stringify(s).length), i > rdt)) break
				n--
			}
			return r.slice(n + 1)
		}
	}