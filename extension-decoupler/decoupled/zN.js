
var Zn = class {
	_uploadMsec
	_uploadBatchSize
	_logger
	_store
	_uploadIntervalId = void 0
	_currentUploadPromise
	constructor(t, r, n, i) {
		;(this._uploadMsec = n), (this._uploadBatchSize = i), (this._store = new Gc(r)), (this._logger = dn(t))
	}
	report(t) {
		this._store.addItem(t)
	}
	get uploadEnabled() {
		return this._uploadIntervalId !== void 0
	}
	enableUpload() {
		this.uploadEnabled ||
			(this._uploadIntervalId = setInterval(() => {
				this._currentUploadPromise === void 0 &&
					(async () => {
						try {
							;(this._currentUploadPromise = this._doUpload()), await this._currentUploadPromise
						} finally {
							this._currentUploadPromise = void 0
						}
					})()
			}, this._uploadMsec))
	}
	/**
	 * Perform the actual upload of metrics.
	 *
	 * This method is called by the interval that is set up when `enableUpload` is
	 * called. It will take all the metrics in the store and split them into
	 * batches of the specified size. Each batch is then uploaded to the server
	 * using the `performUpload` method. If any of the uploads fail, the method will
	 * retry the upload up to the maximum number of times specified by the
	 * `maxTries` option.
	 *
	 * @private
	 */
	async _doUpload() {
		if (this._store.length === 0) return
		let t = this._store.slice()
		this._store.clear()
		for (let r = 0; r < t.length; r += this._uploadBatchSize) {
			let n = t.slice(r, r + this._uploadBatchSize)
			await xi(async () => {
				if (this.uploadEnabled)
					try {
						return this._logger.debug(`Uploading ${n.length} metric(s)`), await this.performUpload(n)
					} catch (i) {
						throw (
							(this._logger.error(`Error uploading metrics: ${i} ${i instanceof Error ? i.stack : ""}`),
							i)
						)
					}
			}, this._logger)
		}
	}
	disableUpload() {
		clearInterval(this._uploadIntervalId), (this._uploadIntervalId = void 0)
	}
	dispose() {
		this.disableUpload()
	}
}