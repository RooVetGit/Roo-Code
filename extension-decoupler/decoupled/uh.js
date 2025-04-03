
var Uh = class extends z {
	constructor(r, n, i) {
		super()
		this._globalState = r
		this._cacheBackKey = n
		this._options = i
		;(this._cache = new Ry({ max: 1e3, ...this._options?.lru })),
			this.loadContext(),
			this.addDisposable(new Yme.Disposable(() => this.dumpContext.cancel()))
	}
	_cache
	dumpContext = (0, $me.default)(
		async () => {
			let r = this._cache.dump()
			await this._globalState.save(this._cacheBackKey, r, {
				uniquePerWorkspace: !0,
			}),
				this._globalState.update(this._cacheBackKey, void 0)
		},
		60 * 1e3,
		{ leading: !0, trailing: !0 },
	)
	loadContext = async () => {
		let r = await this._globalState.load(this._cacheBackKey, {
			uniquePerWorkspace: !0,
		})
		if (r) {
			this._cache.load(r)
			return
		}
		let n = this._globalState.get(this._cacheBackKey)
		n && this._cache.load(n)
	}
	set = async (r, n) => {
		this._cache.set(r, n), await this.dumpContext()
	}
	get = (r) => (this.dumpContext(), this._cache.get(r))
	get cache() {
		return this._cache
	}
	remove = (r) => {
		this._cache.delete(r)
	}
	clear = () => {
		this._cache.clear()
	}
	getItems = () => [...this._cache.values()]
}