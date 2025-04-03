
var DN = class e extends z {
	constructor(r, n) {
		super()
		this._apiServer = r
		this._workspaceManager = n
		;(this._logger = X("UnknownBlobHandler")),
			(this._toProbe = new $o(this._probe.bind(this))),
			this.addDisposable(this._toProbe),
			(this._probeWaiters = new $o(this._enqueueForProbe.bind(this))),
			this.addDisposable(this._probeWaiters),
			(this._probeWaitersKicker = new vc(this._probeWaiters, e.probeRetryWaitMs)),
			this.addDisposable(this._probeWaitersKicker),
			(this._longWaiters = new $o(this._enqueueForProbe.bind(this))),
			this.addDisposable(this._longWaiters),
			(this._longWaitersKicker = new vc(this._longWaiters, e.longRetryWaitMs)),
			this.addDisposable(this._longWaitersKicker)
	}
	static probeBatchSize = 1e3
	static probeRetryWaitMs = 5 * 1e3
	static probePatienceMs = 2 * 60 * 1e3
	static longRetryWaitMs = 60 * 1e3
	_toProbe
	_currentBatch = new Map()
	_probeWaiters
	_probeWaitersKicker
	_longWaiters
	_longWaitersKicker
	_logger
	enqueue(r) {
		for (let [n, i] of r)
			this._logger.verbose(`enqueue: ${i.rootPath}:${i.relPath}`),
				this._toProbe.insert(n, { qualifiedPath: i, startTime: Date.now() })
		this._toProbe.kick()
	}
	_grabCurrentBatch() {
		if (this._currentBatch.size === 0) return
		let r = this._currentBatch
		return (this._currentBatch = new Map()), r
	}
	async _probe(r) {
		if (r !== void 0) {
			let [o, a] = r
			if (
				this._workspaceManager.getBlobName(a.qualifiedPath) !== o ||
				(this._currentBatch.set(o, a), this._currentBatch.size < e.probeBatchSize)
			)
				return
		}
		let n = this._grabCurrentBatch()
		if (n === void 0) return
		let i = [...n.keys()],
			s
		try {
			s = await xi(async () => this._apiServer.findMissing(i), this._logger)
		} catch {}
		if (s === void 0) for (let [o, a] of n) this._addRetryWaiter(o, a)
		else {
			this._logger.verbose(`find-missing reported ${s.nonindexedBlobNames.length} nonindexed blob names`),
				s.nonindexedBlobNames.length > 0 && cg(this._logger, "verbose", s.nonindexedBlobNames, 5)
			let o = new Set(s.unknownBlobNames),
				a = new Set(s.nonindexedBlobNames)
			for (let [l, c] of n)
				o.has(l)
					? this._workspaceManager.notifyBlobMissing(c.qualifiedPath, l)
					: a.has(l) && this._addRetryWaiter(l, c)
		}
	}
	_enqueueForProbe(r) {
		if (r === void 0) this._toProbe.kick()
		else {
			let [n, i] = r
			this._logger.verbose(`probe enqueue: ${i.qualifiedPath.rootPath}:${i.qualifiedPath.relPath}: ${n}`),
				this._toProbe.insert(n, i)
		}
		return Promise.resolve()
	}
	_addRetryWaiter(r, n) {
		Date.now() - n.startTime < e.probePatienceMs
			? (this._logger.verbose(`retry enqueue: ${n.qualifiedPath.rootPath}:${n.qualifiedPath.relPath}: ${r}`),
				this._probeWaiters.insert(r, n))
			: (this._logger.verbose(`long retry enqueue: ${n.qualifiedPath.rootPath}:${n.qualifiedPath.relPath}: ${r}`),
				this._longWaiters.insert(r, n))
	}
}