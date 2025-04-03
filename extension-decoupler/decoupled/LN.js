
var lN = class {
	_logger = X("BlobStatusStore")
	_store = new aN("blobName")
	_embargoedPaths = new Set()
	getIndexedBlobName(t) {
		if (this._embargoedPaths.has(t)) {
			this._logger.debug(`Path [${t}] is embargoed`)
			return
		}
		let r = this._store.search({ pathName: t, status: "indexed" })
		if (r.length === 0) {
			this._logger.debug(`No indexed blob found for ${t}`)
			return
		}
		return r.length > 1
			? (this._logger.warn(`Multiple indexed blobs found for ${t}`),
				r.sort((n, i) => (n.indexedAt ?? 0) - (i.indexedAt ?? 0)),
				r[r.length - 1].blobName)
			: r[0].blobName
	}
	isTrackingBlob(t) {
		return this._store.get(t) !== void 0
	}
	removePath(t) {
		this._store.deleteBy({ pathName: t }), this._embargoedPaths.delete(t)
	}
	isTrackingPath(t) {
		return this._embargoedPaths.has(t) || this._store.search({ pathName: t }, { limit: 1 }).length > 0
	}
	clear() {
		this._store.clear(), this._embargoedPaths.clear()
	}
	getTrackedPaths() {
		return [...new Set(...this._store.getAll().map((t) => t.pathName), ...this._embargoedPaths)]
	}
	addIndexedBlob(t, r) {
		this.addUploadedBlob(t, r), this.updateBlobIndexed(t)
	}
	addUploadedBlob(t, r) {
		this._store.add({
			blobName: t,
			pathName: r,
			status: "uploaded",
			uploadRequestedAt: Date.now(),
		})
	}
	getLastBlobNameForPath(t) {
		return this._store
			.search({ pathName: t })
			.reduce((n, i) => (n === void 0 ? i : (n.uploadRequestedAt ?? 0) > (i.uploadRequestedAt ?? 0) ? n : i))
			?.blobName
	}
	updateBlobIndexed(t) {
		let r = Date.now(),
			n = this._store.get(t)
		if (!n) {
			this._logger.debug(`[ERROR] Failed to find record for ${t}`)
			return
		}
		if (n.status === "indexed") {
			this._logger.debug(`[WARN] Blob ${t} is already indexed`)
			return
		}
		let i = this._store.search({ pathName: n.pathName, status: "indexed" })
		if (i.length === 0) {
			;(n.status = "indexed"), (n.indexedAt = r)
			return
		}
		if (
			(i.reduce((o, a) => ((o.uploadRequestedAt ?? 0) > (a.uploadRequestedAt ?? 0) ? o : a)).uploadRequestedAt ??
				0) > (n.uploadRequestedAt ?? 0)
		) {
			this._logger.info(`Blob ${t} is indexed but there is a newer blob to upload for ${n.pathName}`),
				this._store.delete(t)
			return
		}
		for (let o of i) this._store.delete(o.blobName)
		;(n.status = "indexed"), (n.indexedAt = r)
	}
	embargoPath(t) {
		if (this._embargoedPaths.has(t)) {
			this._logger.debug(`Path [${t}] is already embargoed`)
			return
		}
		this._logger.debug(`Embargoing path [${t}]`), this._store.deleteBy({ pathName: t }), this._embargoedPaths.add(t)
	}
	isEmbargoed(t) {
		return this._embargoedPaths.has(t)
	}
	updateBlobName(t, r) {
		let n = this._store.get(t)
		if (!n) {
			this._logger.debug(`[ERROR] Failed to find record for ${t}`)
			return
		}
		this._store.delete(t), (n.blobName = r), this._store.add(n)
	}
	getAllPathToIndexedBlob() {
		return this._store.search({ status: "indexed" }).reduce((t, r) => (t.set(r.pathName, r.blobName), t), new Map())
	}
}