
var Mx = class extends z {
	constructor(r, n, i) {
		super()
		this._globalState = r
		this._indexBackKey = n
		this._opts = i
		;(this._maxKeysBeforeRemoval = i.maxKeysBeforeRemoval ?? this._maxKeysBeforeRemoval),
			(this._flushDelay = i.maxDelayBeforeRemovalMs ?? this._flushDelay),
			(this._index = new go(Object.values(this._items), {
				...this._opts.fuse,
			})),
			(this._revalidationQueue = new $o(this._revalidateEntry.bind(this))),
			this.addDisposables(this._revalidationQueue, new Jme.Disposable(() => this.dumpContext.cancel())),
			this.loadContext()
	}
	_index
	_items = {}
	_revalidationQueue
	_keysToRemove = new Set()
	_maxKeysBeforeRemoval = 100
	_flushTimer = null
	_flushDelay = 15e3
	dumpContext = (0, Kme.default)(
		async () => {
			await this._globalState.save(this._indexBackKey, this._items, {
				uniquePerWorkspace: !0,
			}),
				this._globalState.update(this._indexBackKey, void 0)
		},
		60 * 1e3,
		{ leading: !0, trailing: !0 },
	)
	loadContext = async () => {
		let r = await this._globalState.load(this._indexBackKey, {
			uniquePerWorkspace: !0,
		})
		if (r) {
			;(this._items = { ...this._items, ...r }),
				(this._index = new go(Object.values(this._items), this._opts.fuse)),
				this.markForRevalidation(Object.values(this._items))
			return
		}
		let n = this._globalState.get(this._indexBackKey)
		n &&
			((this._items = { ...this._items, ...n }),
			(this._index = new go(Object.values(this._items), this._opts.fuse)),
			this.markForRevalidation(Object.values(this._items)))
	}
	set = (r) => {
		let n = this._opts.keyFn(r)
		return (
			this._cancelQueuedWork(n),
			this._items[n] ? !1 : ((this._items[n] = r), this._index.add(r), this.dumpContext(), !0)
		)
	}
	markForRevalidation = (r) => {
		r.forEach((n) => {
			let i = this._opts.keyFn(n)
			this._revalidationQueue.insert(i, n)
		}),
			this._revalidationQueue.kick()
	}
	search = (r, n) => this._index.search(r, n)
	remove = (r) => {
		this._queueKeyRemoval(this._opts.keyFn(r))
	}
	clear = () => {
		;(this._items = {}), this._index.setCollection([])
	}
	get items() {
		return { ...this._items }
	}
	_cancelQueuedWork = (r) => {
		this._revalidationQueue.cancel(r), this._keysToRemove.delete(r)
	}
	_checkValidity = async (r) => (this._opts.validator ? await this._opts.validator(r) : !0)
	async _revalidateEntry(r) {
		if (r === void 0) return
		let [n, i] = r
		;(await this._checkValidity(i)) || this._queueKeyRemoval(n)
	}
	_queueKeyRemoval = (r) => {
		this._keysToRemove.add(r),
			this._keysToRemove.size >= this._maxKeysBeforeRemoval
				? this._flushToRemove()
				: this._flushTimer || (this._flushTimer = setTimeout(() => this._flushToRemove(), this._flushDelay))
	}
	_flushToRemove = () => {
		this._flushTimer && (clearTimeout(this._flushTimer), (this._flushTimer = null))
		for (let r of this._keysToRemove) delete this._items[r]
		this._index.remove((r) => this._keysToRemove.has(this._opts.keyFn(r))), this._keysToRemove.clear()
	}
}