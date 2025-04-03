
var EI = class extends JA {
	_storage
	_getMemoriesAbsPath
	_onDocumentChange
	shardManager
	_shardFunction = (t) => `shard-${t.conversationId}`
	_currentConversationId
	_logger = dn("AggregateCheckpointManager")
	_agentEditListHasUpdatesCallbacks = new Set()
	constructor(t, r, n) {
		super(),
			(this._storage = t),
			(this._getMemoriesAbsPath = r),
			(this._onDocumentChange = n),
			(this.shardManager = new dI(this._storage, this._shardFunction)),
			this.addDisposable(
				this._onDocumentChange((i) => {
					this._handleDocumentChange(i)
				}),
			),
			this.addDisposable({
				dispose: () => {
					this._agentEditListHasUpdatesCallbacks.clear()
				},
			})
	}
	get currentConversationId() {
		return this._currentConversationId
	}
	setCurrentConversation(t) {
		this._currentConversationId = t
	}
	getAgentMemoriesAbsPath = () => this._getMemoriesAbsPath()
	onAgentEditListHasUpdates = (t) => (
		this._agentEditListHasUpdatesCallbacks.add(t),
		{
			dispose: () => {
				this._agentEditListHasUpdatesCallbacks.delete(t)
			},
		}
	)
	_notifyAgentEditListHasUpdates = () => {
		this._agentEditListHasUpdatesCallbacks.forEach((t) => t())
	}
	_getAllTrackedFiles = async (t) => {
		await this.shardManager.initialize()
		let r = this._shardFunction({ conversationId: t })
		return (await this.shardManager.getShardById(r)).getAllTrackedFilePaths(t)
	}
	_checkpointFileState = async (t, r) => {
		let n = (await Do().readFile(r.absPath)).contents
		if (n === void 0) return
		let i = {
				sourceToolCallRequestId: pd(),
				timestamp: Date.now(),
				document: new hi(r, n, n, { logger: this._logger }),
				conversationId: t,
			},
			s = { conversationId: t, path: r }
		return (
			await this.shardManager.addCheckpoint(s, i),
			this._notifyAgentEditListHasUpdates(),
			i.sourceToolCallRequestId
		)
	}
	_trackFile = async (t, r) => {
		await this.shardManager.initialize()
		let n = { conversationId: t, path: r }
		if ((await this.shardManager.getCheckpoints(n)).length > 0) {
			this._logger.debug(`File already tracked: ${r.absPath}`)
			return
		}
		this._logger.debug(`Tracking file: ${r.absPath}`), await this._checkpointFileState(t, r)
	}
	storeCurrentFileStateAsCheckpoint = async (t, r) => (
		await this.shardManager.initialize(), await this._checkpointFileState(t, r)
	)
	addCheckpoint = async (t, r) => {
		await this.shardManager.initialize(),
			await this._trackFile(t.conversationId, r.document.filePath),
			await this.shardManager.addCheckpoint(t, r),
			this._notifyAgentEditListHasUpdates(),
			await Do().writeFile(r.document.filePath, r.document.modifiedCode)
	}
	_getFileStateAtTimestamp = async (t, r, n) => {
		let i = { conversationId: t, path: r },
			o = (await this.shardManager.getCheckpoints(i, { maxTimestamp: n })).at(-1)
		return o
			? o.document.modifiedCode
			: (await this.shardManager.getCheckpoints(i, { minTimestamp: n })).at(0)?.document.originalCode
	}
	_handleDocumentChange = async (t) => {
		let r = Je.from(t.document.qualifiedPathName)
		if (r === void 0 || this._currentConversationId === void 0) return
		let n = t.document.getText?.() ?? ""
		await this.updateLatestCheckpoint(r, n)
	}
	updateLatestCheckpoint = async (t, r, n) => {
		if (this._currentConversationId === void 0) return
		let i = { conversationId: this._currentConversationId, path: t },
			o = (await this.shardManager.getCheckpoints(i)).at(-1)
		if (o === void 0) return
		let a = { ...o, document: new hi(t, o.document.originalCode, r, {}) }
		await this.shardManager.updateCheckpoint(i, a),
			this._notifyAgentEditListHasUpdates(),
			(n?.saveToWorkspace ?? !1) && (await Do().writeFile(t, r))
	}
	getAggregateCheckpointForFile = async (t, r) => {
		await this.shardManager.initialize()
		let n = this._currentConversationId
		if (n === void 0)
			return {
				fromTimestamp: 0,
				toTimestamp: 1 / 0,
				conversationId: "",
				files: [],
			}
		let i = r.minTimestamp ?? 0,
			s = r.maxTimestamp ?? 1 / 0,
			o = await this._getFileStateAtTimestamp(n, t, i),
			a = await this._getFileStateAtTimestamp(n, t, s),
			l = new hi(t, o ?? "", a ?? "", {})
		return {
			fromTimestamp: i,
			toTimestamp: s,
			conversationId: n,
			files: [{ changesSummary: fP(l), changeDocument: l }],
		}
	}
	getCheckpointByRequestId = async (t) => {
		await this.shardManager.initialize()
		let r = this._currentConversationId
		if (r === void 0) return
		let n = this._shardFunction({ conversationId: r }),
			s = (await this.shardManager.getShardById(n)).getCheckpointBySourceId(t)
		if (s !== void 0)
			return {
				fromTimestamp: s.timestamp,
				toTimestamp: s.timestamp,
				conversationId: r,
				files: [{ changesSummary: fP(s.document), changeDocument: s.document }],
			}
	}
	getAggregateCheckpoint = async (t) => {
		await this.shardManager.initialize()
		let r = t.minTimestamp ?? 0,
			n = t.maxTimestamp ?? 1 / 0,
			i = this._currentConversationId
		if (i === void 0)
			return {
				fromTimestamp: 0,
				toTimestamp: 1 / 0,
				conversationId: "",
				files: [],
			}
		let s = await this._getAllTrackedFiles(i),
			o = await Promise.all(
				s.map(async (a) => {
					let l = await this._getFileStateAtTimestamp(i, a, r),
						c = await this._getFileStateAtTimestamp(i, a, n)
					return new hi(a, l ?? "", c ?? "", {})
				}),
			)
		return {
			fromTimestamp: r,
			toTimestamp: n,
			conversationId: i,
			files: o.map((a) => ({ changesSummary: fP(a), changeDocument: a })),
		}
	}
	clearConversationCheckpoints = async (t) => {
		await this.shardManager.initialize(),
			await this.shardManager.clearShard(this._shardFunction({ conversationId: t }))
	}
	revertDocumentToTimestamp = async (t, r) => {
		await this.shardManager.initialize()
		let n = this._currentConversationId
		if (n === void 0) return
		let i = await this._getFileStateAtTimestamp(n, t, r)
		if (i === void 0) return
		let s = await this._getFileStateAtTimestamp(n, t, Number.MAX_SAFE_INTEGER)
		await this.addCheckpoint(
			{ conversationId: n, path: t },
			{
				sourceToolCallRequestId: pd(),
				timestamp: Date.now(),
				document: new hi(t, s ?? "", i, {}),
				conversationId: n,
			},
		)
	}
	revertToTimestamp = async (t) => {
		if ((await this.shardManager.initialize(), this._currentConversationId === void 0)) return
		let n = await this.getAggregateCheckpoint({
			minTimestamp: t,
			maxTimestamp: void 0,
		})
		await Promise.all(
			n.files.map(async (i) => {
				await this.revertDocumentToTimestamp(i.changeDocument.filePath, t)
			}),
		)
	}
}