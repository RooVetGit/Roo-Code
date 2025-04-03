
var AN = class e extends z {
	static defaultCheckpointThreshold = 1e3
	_checkpointId
	_checkpointBlobNames = new Map()
	_toAdd = new Map()
	_toRemove = new Set()
	_apiServer
	_logger
	_checkpointQueue
	_checkpointThreshold
	_maxCheckpointBatchSize = 1e4
	_featureFlagManager
	_onContextChange = new hwe.EventEmitter()
	onContextChange = this._onContextChange.event
	get _flags() {
		return this._featureFlagManager.currentFlags
	}
	constructor(t, r, n, i) {
		super(),
			(this._logger = X("BlobsCheckpointManager")),
			(this._checkpointId = void 0),
			(this._apiServer = t),
			(this._featureFlagManager = r),
			(this._checkpointThreshold = i ?? e.defaultCheckpointThreshold),
			this.addDisposable(
				n((s) => {
					this.updateBlob(s.absPath, s.prevBlobName, s.newBlobName)
				}),
			),
			(this._checkpointQueue = new pN("checkpoint", {
				processOne: async (s, o) => await this._checkpoint(s, o),
			})),
			this._logger.info(`BlobsCheckpointManager created. checkpointThreshold: ${this._checkpointThreshold}`)
	}
	refBlob(t) {
		let r = this._checkpointBlobNames.get(t)
		r !== void 0
			? (this._checkpointBlobNames.set(t, r + 1), r === 0 && this._toRemove.delete(t))
			: this._toAdd.set(t, (this._toAdd.get(t) ?? 0) + 1)
	}
	derefBlob(t) {
		!this.derefFromCheckpoint(t) &&
			!this.derefFromAdded(t) &&
			this._logger.error(`derefBlob: blob ${t} not found in checkpoint or toAdd`)
	}
	derefFromCheckpoint(t) {
		let r = this._checkpointBlobNames.get(t)
		return r === void 0 || r <= 0
			? (r !== void 0 &&
					this._logger.error(
						`derefFromCheckpoint: blob ${t} has reference count ${r}. In toRemove? ${this._toRemove.has(
							t,
						)}`,
					),
				!1)
			: (this._checkpointBlobNames.set(t, r - 1), r === 1 && this._toRemove.add(t), !0)
	}
	derefFromAdded(t) {
		let r = this._toAdd.get(t)
		return r === void 0 ? !1 : r <= 1 ? (this._toAdd.delete(t), r === 1) : (this._toAdd.set(t, r - 1), !0)
	}
	getCheckpointedBlobNames() {
		return Array.from(this._checkpointBlobNames.keys())
	}
	getContext() {
		return {
			checkpointId: this._checkpointId,
			addedBlobs: Array.from(this._toAdd.keys()),
			deletedBlobs: Array.from(this._toRemove),
		}
	}
	getContextAdjusted(t, r) {
		let n = new Set(this._toAdd.keys()),
			i = new Set(this._toRemove)
		for (let s of t) this._checkpointBlobNames.has(s) || n.add(s), i.delete(s)
		for (let s of r) this._checkpointBlobNames.has(s) && i.add(s), n.delete(s)
		return {
			checkpointId: this._checkpointId,
			addedBlobs: Array.from(n),
			deletedBlobs: Array.from(i),
		}
	}
	blobsPayload(t) {
		let r = this.getCheckpointedBlobNames(),
			n = LC(t, r),
			i = LC(r, t)
		return { checkpointId: this._checkpointId, addedBlobs: n, deletedBlobs: i }
	}
	expandBlobs(t) {
		if (t.checkpointId === void 0) return t.addedBlobs
		if (t.checkpointId !== this._checkpointId)
			throw new Error(`expandBlobs: checkpointId mismatch: ${t.checkpointId} != ${this._checkpointId}`)
		let r = this.getCheckpointedBlobNames()
		if ((r.push(...t.addedBlobs), t.deletedBlobs.length > 0)) {
			let n = new Set(t.deletedBlobs)
			return r.filter((i) => !n.has(i))
		}
		return r
	}
	validateMatching(t, r, n = !1) {
		if (t.checkpointId !== r.checkpointId)
			return this._logger.error(`checkpointId mismatch: ${t.checkpointId} vs ${r.checkpointId}`), !1
		let i = !0,
			s = LC(t.addedBlobs, r.addedBlobs),
			o = LC(r.addedBlobs, t.addedBlobs)
		return (
			(s.length > 0 || o.length > 0) &&
				((i = !1),
				this._logger.error(`addedBlobs mismatch: -${s.length}/+${o.length}`),
				n &&
					(this._logger.error(`left-added: ${s.slice(0, 5).join(",")}`),
					this._logger.error(`right-added: ${o.slice(0, 5).join(",")}`))),
			(s = LC(t.deletedBlobs, r.deletedBlobs)),
			(o = LC(r.deletedBlobs, t.deletedBlobs)),
			(s.length > 0 || o.length > 0) &&
				((i = !1),
				this._logger.error(`deletedBlobs mismatch: -${s.length}/+${o.length}`),
				n &&
					(this._logger.error(`left-deleted: ${s.slice(0, 5).join(",")}`),
					this._logger.error(`right-deleted: ${o.slice(0, 5).join(",")}`))),
			i
		)
	}
	updateBlob(t, r, n) {
		this._logger.verbose(`notifyBlobChange ${t}: ${r} to ${n}`),
			n && n !== r && this.refBlob(n),
			r && n !== r && this.derefBlob(r),
			this._toAdd.size + this._toRemove.size >= this._checkpointThreshold &&
				this._checkpointQueue.size() === 0 &&
				this._queueCheckpoint()
	}
	resetCheckpoint() {
		for (let [t, r] of this._checkpointBlobNames)
			r > 0
				? this._toAdd.set(t, r)
				: this._toRemove.delete(t) ||
					this._logger.warn(`blob with 0 references was not found in toRemove: ${t}`)
		for (let t of this._toRemove) this._logger.warn(`blob in toRemove was not found in checkpoint: ${t}`)
		this._toRemove.clear(),
			(this._checkpointId = void 0),
			this._checkpointBlobNames.clear(),
			this._onContextChange.fire(this.getContext())
	}
	async awaitEmptyQueue() {
		await this._checkpointQueue.awaitEmpty(void 0, !1)
	}
	async _checkpoint(t, r) {
		let { checkpointId: n, addedBlobs: i, deletedBlobs: s } = t
		this._logger.debug(`Begin checkpoint of working set into ${n}`),
			this._logger.debug(`add ${i.length} blobs, remove ${s.length} blobs into ${n}`)
		let o = { newCheckpointId: "" }
		try {
			o = await this._apiServer.checkpointBlobs(t)
		} catch (a) {
			let l = a instanceof Error ? a.message : `${a}`,
				c = this._checkpointId ? this._checkpointId : "{initial}"
			kr.isAPIErrorWithStatus(a, He.invalidArgument) || kr.isAPIErrorWithStatus(a, He.unimplemented)
				? (this._logger.warn(
						`checkpoint-blobs from ${c} failed with invalid argument: ${l}. Recreating checkpoint.`,
					),
					this.resetCheckpoint(),
					this._queueCheckpoint(),
					r.throwError(a, !1))
				: (this._logger.error(`checkpoint-blobs failed with error: ${l}.`), r.throwError(a, !1))
		}
		if (n !== this._checkpointId)
			this._logger.warn(
				`original checkpointId ${n} does not match current checkpointId ${this._checkpointId}. Abandoning new checkpoint.`,
			)
		else {
			this._logger.debug(`checkpointId ${n} advanced to ${o.newCheckpointId}`),
				(this._checkpointId = o.newCheckpointId)
			for (let a of i) {
				let l = this._toAdd.get(a)
				l === void 0
					? (this._checkpointBlobNames.set(a, 0), this._toRemove.add(a))
					: (this._checkpointBlobNames.set(a, l), this._toAdd.delete(a))
			}
			for (let a of s) {
				let l = this._checkpointBlobNames.get(a)
				l === void 0
					? this._logger.warn(`In _checkpoint: deleted blob ${a} not found in checkpoint`)
					: l > 0 && this._toAdd.set(a, l),
					this._checkpointBlobNames.delete(a),
					this._toRemove.delete(a)
			}
			this._onContextChange.fire(this.getContext())
		}
		this._toAdd.size + this._toRemove.size >= this._checkpointThreshold &&
			(this._logger.debug(
				`starting a new round of checkpointing due to size ${this._toAdd.size} + ${this._toRemove.size}`,
			),
			this._queueCheckpoint())
	}
	_queueCheckpoint() {
		this._logger.debug("queue checkpoint")
		let t = Array.from(this._toAdd.keys()).slice(0, this._maxCheckpointBatchSize),
			r = Array.from(this._toRemove).slice(0, this._maxCheckpointBatchSize),
			n = { checkpointId: this._checkpointId, addedBlobs: t, deletedBlobs: r }
		this._logger.debug(
			`queue checkpoint: version: ${n.checkpointId}, add: ${n.addedBlobs.length} blobs, rm: ${n.deletedBlobs.length} blob`,
		),
			this._checkpointQueue.add(n)
	}
}