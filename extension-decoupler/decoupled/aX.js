
var Ax = W(gs()),
	gy = class {
		constructor(t, r, n) {
			this.name = t
			this._logger = r
			this._configListener = n
		}
		_isSet = !1
		_value
		get value() {
			return this._value
		}
		update(t) {
			return this._isSet && (0, Ax.isEqual)(t, this._value)
				? !1
				: (this._isSet
						? this._logger.info(`${this.name} changed:
${this.diff(this.value, t).map((r) => `  - ${r}`).join(`
`)}`)
						: this._logger.info(`${this.name} changed from <unset> to ${this._formatValue(t)}`),
					(this._value = (0, Ax.cloneDeep)(t)),
					(this._isSet = !0),
					!0)
		}
		diff(t, r, n = []) {
			if ((0, Ax.isEqual)(r, t)) return []
			if (!this.isObject(r) || !this.isObject(t)) return [`${this._formatValue(t)} to ${this._formatValue(r)}`]
			let i = new Set([...Object.keys(t || {}), ...Object.keys(r || {})]),
				s = []
			for (let o of i) {
				if (this._configListener && !this._configListener.config.enableDebugFeatures && o === "memoriesParams")
					continue
				let a = r ? r[o] : void 0,
					l = t ? t[o] : void 0
				!this.isObject(a) || !this.isObject(l)
					? a !== l &&
						s.push(`${n.concat(o).join(" > ")}: ${this._formatValue(l)} to ${this._formatValue(a)}`)
					: s.push(...this.diff(l, a, n.concat(o)))
			}
			return s
		}
		isObject(t) {
			return typeof t == "object" && t !== null
		}
		toString() {
			return this._isSet ? this._formatValue(this.value) : "<unset>"
		}
		_formatValue(t) {
			return t === void 0 ? "undefined" : JSON.stringify(t)
		}
	}