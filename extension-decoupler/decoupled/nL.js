
var Nl = class e {
	beforeStart
	afterStart
	beforeText
	afterText
	constructor(t) {
		;(this.beforeStart = t.beforeStart),
			(this.afterStart = t.afterStart),
			(this.beforeText = t.beforeText),
			(this.afterText = t.afterText)
	}
	static from(t) {
		return new e({
			beforeStart: t.beforeStart ?? 0,
			afterStart: t.afterStart ?? 0,
			beforeText: t.beforeText ?? "",
			afterText: t.afterText ?? "",
		})
	}
	get beforeEnd() {
		return this.beforeStart + this.beforeText.length
	}
	get afterEnd() {
		return this.afterStart + this.afterText.length
	}
	get beforeCRange() {
		return new bo(this.beforeStart, this.beforeEnd)
	}
	get afterCRange() {
		return new bo(this.afterStart, this.afterEnd)
	}
	toString() {
		return `SingleEdit{before=${this.beforeStart}:${this.beforeEnd}, after=${
			this.afterStart
		}:${this.afterEnd}, beforeText=${JSON.stringify(this.beforeText)}, afterText=${JSON.stringify(this.afterText)}}`
	}
	mergeNext(t) {
		if (t.afterText === "" && t.beforeStart >= this.afterStart && t.beforeEnd <= this.afterEnd) {
			let r =
				this.afterText.slice(0, t.beforeStart - this.afterStart) +
				this.afterText.slice(t.beforeEnd - this.afterStart)
			return new e({
				beforeStart: this.beforeStart,
				afterStart: this.afterStart,
				beforeText: this.beforeText,
				afterText: r,
			})
		} else {
			if (this.afterEnd === t.beforeStart)
				return new e({
					beforeStart: this.beforeStart,
					afterStart: this.afterStart,
					beforeText: this.beforeText + t.beforeText,
					afterText: this.afterText + t.afterText,
				})
			if (t.beforeEnd === this.afterStart)
				return new e({
					beforeStart: t.beforeStart,
					afterStart: t.afterStart,
					beforeText: t.beforeText + this.beforeText,
					afterText: t.afterText + this.afterText,
				})
		}
	}
	normalize() {
		let t = this.beforeStart,
			r = this.afterStart,
			n = this.beforeText,
			i = this.afterText,
			s = W_e(n, i)
		s > 0 && ((t += s), (r += s), (n = n.slice(s)), (i = i.slice(s)))
		let o = G_e(n, i)
		return (
			o > 0 && ((n = n.slice(0, -o)), (i = i.slice(0, -o))),
			new e({ beforeStart: t, afterStart: r, beforeText: n, afterText: i })
		)
	}
}