
var U8 = class {
	constructor(t, r, n) {
		this._rootPath = t
		this._workspaceManager = r
		this._blobNameCalculator = n
	}
	async getBufferBlobName(t) {
		let r = owe.Uri.file($t(this._rootPath, t)),
			i = (await ho(r)).getText()
		return this._blobNameCalculator.calculate(t, i)
	}
	getIndexedBlobName(t) {
		return this._workspaceManager.getBlobName(new Je(this._rootPath, t))
	}
}