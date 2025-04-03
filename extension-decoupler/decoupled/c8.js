
var C8 = class extends Error {
		constructor() {
			super("SingletonExecutor has been disposed")
		}
	},
	Ku = class e extends z {
		constructor(r) {
			super()
			this._execute = r
			this.addDisposable({ dispose: () => (this._stopping = !0) })
		}
		static _disposedError = new C8()
		_nextExecutionScheduled = !1
		_kickPromise = Promise.resolve()
		_stopping = !1
		kick() {
			return this._nextExecutionScheduled
				? this._kickPromise
				: ((this._nextExecutionScheduled = !0),
					(this._kickPromise = this._kickPromise.then(
						async () => (
							(this._nextExecutionScheduled = !1),
							this._stopping ? Promise.reject(e._disposedError) : this._execute()
						),
					)),
					this._kickPromise)
		}
	}