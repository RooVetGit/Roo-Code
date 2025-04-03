
var IQ = class e {
	constructor(t) {
		this.publish = t
	}
	static _lineLen = 80
	static _indent = "    "
	static _subIndent = "  "
	_content = ""
	_disposed = !1
	get content() {
		return this._content
	}
	addSection(t) {
		let r =
			(this._content.length === 0
				? ""
				: `
`) +
			`================
`
		this._addLine(r + t)
	}
	addObject(t) {
		if (t === void 0) this.addLine(this.formatValue(t))
		else
			for (let r in t) {
				let n = t[r]
				typeof n != "object" ? this.addValue(r, n) : this.addValue(r, JSON.stringify(n))
			}
	}
	formatValue(t) {
		return t === void 0 ? "<undefined>" : t === null ? "<null>" : typeof t == "string" ? `"${t}"` : `${t}`
	}
	addLine(t) {
		this._disposed || this._addLine(e._indent + t)
	}
	addText(t, r) {
		if (this._disposed) return
		let n =
			(this._content.length === 0
				? ""
				: `
`) + ">>>>>>>>>>>>>>>> "
		this._addLine(n + t),
			this._addLine(r, ""),
			r.length > 0 &&
				r[r.length - 1] !==
					`
` &&
				this._addLine("|<---- (ends here)"),
			this._addLine("<<<<<<<<<<<<<<<< " + t)
	}
	addError(t) {
		if (e._indent.length + t.length <= e._lineLen) {
			this._addLine(e._indent + t)
			return
		}
		let r = 0,
			n = e._indent
		for (;;) {
			let i = t.indexOf(": ", r)
			if (i === -1) {
				this._addLine(n + t.substring(r))
				break
			}
			this._addLine(n + t.substring(r, i + 1)), (r = i + 2), (n += e._subIndent)
		}
	}
	addValue(t, r) {
		this._addLine(e._indent + t + ": " + this.formatValue(r))
	}
	addStringValue(t, r, n = !0) {
		this._addLine(e._indent + t + ": " + (n ? `"${r}"` : r))
	}
	_addLine(
		t,
		r = `
`,
	) {
		this._disposed || (this._content += t + r)
	}
	savePoint() {
		return this._content.length
	}
	rollback(t) {
		this._disposed || (this._content.length > t && (this._content = this._content.substring(0, t)))
	}
	dispose() {
		;(this._disposed = !0), (this._content = "")
	}
}