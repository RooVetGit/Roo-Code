
var D_ = class e {
	_spaces
	_tabs
	constructor({ spaces: t, tabs: r }) {
		;(this._spaces = t), (this._tabs = r)
	}
	static computeCommonLeadingWhitespace(t) {
		if (t.length === 0) return new e({ spaces: 0, tabs: 0 })
		let n = t
				.filter((o) => o.trim().length > 0)
				.map((o) => {
					let a = o.match(/^([ \t]*)/)
					return a ? a[1] : ""
				}),
			i = n.map((o) => o.length - o.replace(/ /g, "").length),
			s = n.map((o) => o.length - o.replace(/\t/g, "").length)
		return new e({
			spaces: i.reduce((o, a) => Math.min(o, a), i[0]),
			tabs: s.reduce((o, a) => Math.min(o, a), s[0]),
		})
	}
	trimLeadingIncremental(t) {
		let r = this._spaces,
			n = this._tabs,
			i = 0
		for (; i < t.length && (r > 0 || n > 0); ) {
			let s = t[i++]
			if (s === " " && r > 0) r--
			else if (s === "	" && n > 0) n--
			else return
		}
		return { trimmed: t.slice(i), remaining: new e({ spaces: r, tabs: n }) }
	}
	trimLeadingFull(t, r) {
		let n = this.trimLeadingIncremental(t)
		return n
			? !n.remaining.isEmpty() && t.length > 0
				? (r?.debug("Untrimmed whitespace"), t)
				: n.trimmed
			: (r?.debug(`No common leading whitespace for line: ${t}`), t)
	}
	isEmpty() {
		return this._spaces === 0 && this._tabs === 0
	}
	total() {
		return this._spaces + this._tabs
	}
}