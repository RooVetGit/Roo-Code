
var kv,
	Mv,
	za = class {
		constructor(t, r, n, i) {
			;(this._cachedPath = []), (this.parent = t), (this.data = r), (this._path = n), (this._key = i)
		}
		get path() {
			return (
				this._cachedPath.length ||
					(this._key instanceof Array
						? this._cachedPath.push(...this._path, ...this._key)
						: this._cachedPath.push(...this._path, this._key)),
				this._cachedPath
			)
		}
	},
	gY = (e, t) => {
		if (wg(t)) return { success: !0, data: t.value }
		if (!e.common.issues.length) throw new Error("Validation failed but no issues detected.")
		return {
			success: !1,
			get error() {
				if (this._error) return this._error
				let r = new ua(e.common.issues)
				return (this._error = r), this._error
			},
		}
	}