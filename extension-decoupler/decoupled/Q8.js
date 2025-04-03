
var q8 = class extends z {
	constructor(r, n) {
		super()
		this._blobNameCalculator = r
		this._apiServer = n
		;(this._uploadQueue = new Ia(async (i) => {
			i !== void 0 && (await this._processUpload(i))
		})),
			this.addDisposable(this._uploadQueue)
	}
	_emitter = new awe.EventEmitter()
	_uploadQueue
	_logger = X("FileUploaderImpl")
	get onDidChange() {
		return this._emitter.event
	}
	upload(r, n) {
		let i = this._blobNameCalculator.calculate(r, n)
		if (i === void 0) throw new Error(`blobNameCalculator returned undefined for ${r}`)
		return (
			this._uploadQueue.insert({ path: r, content: n, blobName: i }), this._uploadQueue.kick(), Promise.resolve(i)
		)
	}
	async _processUpload(r) {
		try {
			this._logger.debug(`Upload started: path [${r.path}] with blob name [${r.blobName}]`),
				await this._apiServer.batchUpload([
					{
						pathName: r.path,
						text: r.content,
						blobName: r.blobName,
						metadata: [],
					},
				]),
				this._logger.debug(`Upload complete: path [${r.path}] with blob name [${r.blobName}]`)
		} catch (n) {
			this._logger.debug(`Failed upload for [${r.path}]. Caused by: ${n.stack}.`)
		}
	}
}