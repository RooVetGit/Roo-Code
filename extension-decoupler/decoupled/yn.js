
var yN = class extends pf {
	constructor(r, n) {
		super()
		this._name = r
		this._cacheDirName = n
		;(this._cacheFileName = $t(this._cacheDirName, pf.cacheFileName)),
			(this._tmpFileName = $t(this._cacheDirName, pf.tmpFileName))
	}
	_cacheFileName
	_tmpFileName
	_logger = X("MTimeCacheWriter")
	get cacheFileName() {
		return this._cacheFileName
	}
	async write(r) {
		this._logger.debug(`persisting to ${this._cacheFileName}`)
		let n = new f6()
		for (let [i, s, o] of r) n.entries.push([i, { mtime: s, name: o }])
		await Su(this._cacheDirName),
			await Bu(this._tmpFileName, JSON.stringify(n, void 0, 4)),
			await cW(this._tmpFileName, this._cacheFileName),
			this._logger.debug(
				`persisted ${n.entries.length} entries at naming version ${hE} to ${this._cacheFileName}`,
			)
	}
}