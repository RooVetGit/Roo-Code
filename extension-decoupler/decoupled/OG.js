
var og = class e {
	path
	beforeBlobName
	afterBlobName
	edits
	constructor(t) {
		;(this.path = t.path),
			(this.beforeBlobName = t.beforeBlobName),
			(this.afterBlobName = t.afterBlobName),
			(this.edits = t.edits)
	}
	static from(t) {
		return new e({
			path: t.path ?? "",
			beforeBlobName: t.beforeBlobName ?? "",
			afterBlobName: t.afterBlobName ?? "",
			edits: t.edits?.map((n) => Nl.from(n)) ?? [],
		})
	}
	changedChars() {
		return this.edits.reduce((t, r) => t + r.beforeText.length + r.afterText.length, 0)
	}
	isRepeatedChange() {
		if (this.edits.length <= 1) return !0
		let t = this.edits[0]
		return this.edits.every((r) => r.beforeText === t.beforeText && r.afterText === t.afterText)
	}
	mergeNext(t) {
		if (this.edits.length !== t.edits.length || this.path !== t.path || !t.isRepeatedChange()) return
		let r = [],
			n = 0,
			i = 0
		for (let s = 0; s < this.edits.length; s++) {
			let o = this.edits[s],
				a = o.mergeNext(t.edits[s])
			if (a === void 0) return
			r.push(
				new Nl({
					beforeStart: a.beforeStart + n,
					afterStart: a.afterStart + i,
					beforeText: a.beforeText,
					afterText: a.afterText,
				}),
			),
				(n += a.beforeText.length - o.beforeText.length),
				(i += a.afterText.length - o.afterText.length)
		}
		if (r.length >= 2) {
			let s = r.map((a) => a.beforeCRange)
			if (bo.anyOverlaps(s)) return
			let o = r.map((a) => a.afterCRange)
			if (bo.anyOverlaps(o)) return
		}
		return new e({
			path: this.path,
			beforeBlobName: this.beforeBlobName,
			afterBlobName: t.afterBlobName,
			edits: r,
		}).normalize()
	}
	normalize() {
		let t = this.edits
			.map((r) => r.normalize())
			.filter((r) => r.beforeText !== r.afterText)
			.sort((r, n) => r.beforeStart - n.beforeStart)
		return new e({
			path: this.path,
			beforeBlobName: this.beforeBlobName,
			afterBlobName: this.afterBlobName,
			edits: t,
		})
	}
	hasChange() {
		return this.edits.some((t) => t.beforeText !== t.afterText)
	}
}