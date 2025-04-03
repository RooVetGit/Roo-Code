
var AM = class extends z {
	constructor(r) {
		super()
		this._getter = r
		;(this._cache = new Ry({
			max: 1e3,
			ttl: 1e3 * 60 * 60,
			fetchMethod: this._fetchSmartPasteResults,
		})),
			this.addDisposable({
				dispose: () => {
					this._cache.clear()
				},
			})
	}
	_cache
	_fetchSmartPasteResults = async (r, n, { context: i }) => {
		let s = await this._getter(i)
		return Promise.resolve({
			generator: new Jp(s.generator),
			requestId: s.requestId,
		})
	}
	get = async (r, n, i, s) => {
		let o = ugt(r, n, i),
			a = this._cache.get(o)
		;(!a || a.generator.hasErrored) && this._cache.delete(o)
		let l = await this._cache.fetch(o, { context: s, forceRefresh: !1 })
		if (l) return { generator: l.generator.copy(), requestId: l.requestId }
	}
	getDirect = async (r) => {
		let n = await Promise.resolve(this._getter(r))
		if (!n) return
		let i = new Jp(n.generator)
		if (i) return { generator: i.copy(), requestId: n.requestId }
	}
}