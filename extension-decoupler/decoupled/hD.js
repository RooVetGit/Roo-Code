
var cI = class e {
		_logger = dn("AgentShardStorage")
		static storagePathKeyPrefix = "agent-edit-shard-storage"
		static manifestKey = "manifest"
		static serializedStoreKey = "serialized-store"
		async save(t) {
			await this._saveJson(this._getStoragePath(hd.serializedStore, e.serializedStoreKey), t)
		}
		async load() {
			return this._loadJson(this._getStoragePath(hd.serializedStore, e.serializedStoreKey))
		}
		async _saveJson(t, r) {
			let n = Buffer.from(JSON.stringify(r), "utf8")
			await lI().saveAsset(t, new Uint8Array(n))
		}
		async _loadJson(t) {
			let r = await lI().loadAsset(t)
			if (!(!r || r.length === 0)) return JSON.parse(Buffer.from(r).toString("utf8"))
		}
		_getStoragePath(t, r) {
			return `agent-edits/${t}/${e.storagePathKeyPrefix}-${r}.json`
		}
		async saveShard(t, r) {
			await this._saveJson(this._getStoragePath(hd.shards, t), r)
		}
		async loadShard(t) {
			return this._loadJson(this._getStoragePath(hd.shards, t))
		}
		async deleteShard(t) {
			await lI().deleteAsset(this._getStoragePath(hd.shards, t))
		}
		async saveManifest(t) {
			await this._saveJson(this._getStoragePath(hd.manifest, e.manifestKey), t)
		}
		async loadManifest() {
			return this._loadJson(this._getStoragePath(hd.manifest, e.manifestKey))
		}
	},
	hd
;