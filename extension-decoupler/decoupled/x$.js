
var X$ = W(ZA()),
	dI = class {
		_storage
		_shardFunction
		_options
		_shardCache = new Map()
		_manifest = { version: 1, lastUpdated: Date.now(), shards: {} }
		_accessOrder = []
		_checkpointDocumentIdFn
		_flushManifest
		constructor(t, r, n = {}) {
			;(this._storage = t),
				(this._shardFunction = r),
				(this._options = n),
				(this._checkpointDocumentIdFn = (i) => `${i.conversationId}:${i.path.absPath}`),
				(this._flushManifest = (0, X$.default)(
					async () => {
						await this._storage.saveManifest(this._manifest)
					},
					this._options.manifestUpdateThrottleMs ?? 1e3,
					{ leading: !0, trailing: !0 },
				))
		}
		get manifest() {
			return this._manifest
		}
		initialize = async () => {
			let t = await this._storage.loadManifest()
			t && uI(t).isValid
				? (this._manifest = t)
				: ((this._manifest = {
						version: 1,
						lastUpdated: Date.now(),
						shards: {},
					}),
					await this._storage.saveManifest(this._manifest))
		}
		_getShardId(t) {
			let r = this._checkpointDocumentIdFn(t)
			for (let [n, i] of Object.entries(this._manifest.shards)) if (i.checkpointDocumentIds.includes(r)) return n
			return this._shardFunction(t, {
				manifestSnapshot: this._manifest,
				pathStats: { checkpointCount: 0, estimatedSize: 0 },
			})
		}
		_updateAccessTime(t) {
			let r = this._accessOrder.indexOf(t)
			r > -1 && this._accessOrder.splice(r, 1), this._accessOrder.push(t)
		}
		async _loadShard(t) {
			let r = this._shardCache.get(t)
			if (r) return this._updateAccessTime(t), r
			let n = await this._storage.loadShard(t)
			r = n ? _g.fromSerialized(t, n, this._checkpointDocumentIdFn) : new _g(t, this._checkpointDocumentIdFn)
			for (let s of r.getAllTrackedConversationIds())
				for (let o of r.getAllTrackedFilePaths(s)) {
					let a = r.getLatestCheckpoint({ conversationId: s, path: o })
					if (!a) continue
					let l = (await Do().readFile(o.absPath)).contents
					if (l && l !== a.document.modifiedCode) {
						let c = new hi(o, a.document.modifiedCode, l, {})
						r.addCheckpoint(
							{ conversationId: s, path: o },
							{
								sourceToolCallRequestId: crypto.randomUUID(),
								timestamp: Date.now(),
								document: c,
								conversationId: s,
							},
						)
					}
				}
			let i = this._options.maxCachedShards ?? 10
			for (; this._shardCache.size >= i && this._accessOrder.length > 0; ) {
				let s = this._accessOrder.shift()
				if (s) {
					let o = this._shardCache.get(s)
					o && (await this._storage.saveShard(s, o.serialize()), this._shardCache.delete(s))
				}
			}
			return this._shardCache.set(t, r), this._updateAccessTime(t), r
		}
		async _updateManifest(t, r) {
			;(this._manifest.shards[t] = r.getMetadata()),
				(this._manifest.lastUpdated = Date.now()),
				await this._flushManifest()
		}
		getShard = async (t) => {
			let r = this._getShardId(t)
			return await this.getShardById(r)
		}
		getShardById = async (t) => await this._loadShard(t)
		getCheckpoints = async (t, r) => {
			let n = this._getShardId(t)
			return (await this._loadShard(n)).getCheckpoints(t, r) || []
		}
		getLatestCheckpoint = async (t) => {
			let r = this._getShardId(t)
			return (await this._loadShard(r)).getLatestCheckpoint(t)
		}
		addCheckpoint = async (t, r) => {
			let n = this._getShardId(t),
				i = await this._loadShard(n)
			i.addCheckpoint(t, r), await this._storage.saveShard(n, i.serialize()), await this._updateManifest(n, i)
		}
		updateCheckpoint = async (t, r) => {
			let n = this._getShardId(t),
				i = await this._loadShard(n)
			i.updateCheckpoint(t, r), await this._updateManifest(n, i)
		}
		removeCheckpoint = async (t, r) => {
			let n = this._getShardId(t),
				i = await this._loadShard(n),
				s = i.removeCheckpoint(t, r)
			return (
				s &&
					(i.checkpointCount === 0
						? (this._shardCache.delete(n),
							delete this._manifest.shards[n],
							await this._storage.deleteShard(n))
						: (await this._storage.saveShard(n, i.serialize()), await this._updateManifest(n, i))),
				s
			)
		}
		clearShard = async (t) => {
			let r = await this._loadShard(t)
			r.clear(), await this._storage.saveShard(t, r.serialize()), await this._updateManifest(t, r)
		}
		clear = async () => {
			for (let [t, r] of this._shardCache) r.clear(), await this._storage.saveShard(t, r.serialize())
			this._shardCache.clear(),
				(this._accessOrder.length = 0),
				(this._manifest = { version: 1, lastUpdated: Date.now(), shards: {} }),
				await this._storage.saveManifest(this._manifest)
		}
	}