
var Na = class e {
	constructor(t, r, n, i, s, o, a = "file", l = new Date(), c = "fresh") {
		this.requestId = t
		this.mode = r
		this.scope = n
		this.result = i
		this.qualifiedPathName = s
		this.lineRange = o
		this.uriScheme = a
		this.occurredAt = l
		this.state = c
		;(this.changeType = e.determineChangeType(this.result.existingCode, this.result.suggestedCode)),
			this.changeType === "modification" &&
				this.makeOneLineDiffSpans()
					.filter((f) => f.type !== "noop")
					.every((f) => f.type === "insertion" && f.updated.isWholeLine) &&
				(this.changeType = "insertion"),
			this.changeType === "insertion" && this.lineRange.start > 0
				? (this.highlightRange = new Rn(
						this.lineRange.start - 1,
						this.lineRange.stop -
							(this.lineRange.stop > this.lineRange.start &&
							this.result.existingCode.indexOf(`
`) === -1
								? 1
								: 0),
					))
				: this.changeType === "insertion" && this.lineRange.start === 0 && this.lineRange.stop === 0
					? (this.highlightRange = new Rn(0, 1))
					: (this.highlightRange = this.lineRange)
	}
	changeType
	highlightRange
	previewCursorRange(t) {
		let r = this.previewBoxRange(t)
		return new Rn(Math.max(0, r.start - 1), r.stop)
	}
	previewBoxRange(t) {
		let r = this.state === "accepted",
			n = r ? this.afterLineRange(t) : this.highlightRange
		return (
			r &&
				(this.changeType === "deletion" && n.start > 0
					? (n = new Rn(
							n.start - 1,
							n.stop -
								(n.stop > n.start &&
								this.result.suggestedCode.indexOf(`
`) === -1
									? 1
									: 0),
						))
					: this.changeType === "deletion" && n.start === 0 && n.stop === 0 && (n = new Rn(0, 1))),
			n
		)
	}
	get previewTargetCursorLine() {
		return Math.max(0, this.lineRange.start - 1)
	}
	toString() {
		return `EditSuggestion(${this.qualifiedPathName.relPath}:${this.lineRange.toString()})`
	}
	equals(t) {
		return this.result.suggestionId === t?.result.suggestionId
	}
	compareTo(t) {
		return this.qualifiedPathName.equals(t.qualifiedPathName)
			? this.lineRange.compareTo(t.lineRange)
			: this.qualifiedPathName.relPath.localeCompare(t.qualifiedPathName.relPath)
	}
	makeOneLineDiffSpans() {
		return e.makeOneLineDiffSpans(
			this.result.diffSpans,
			this.result.existingCode,
			this.result.suggestedCode,
			this.lineRange,
		)
	}
	static determineChangeType(t, r) {
		return t === r ? "noop" : t === "" ? "insertion" : r === "" ? "deletion" : "modification"
	}
	static makeOneLineDiffSpans(t, r, n, i) {
		if (!t) return []
		let s = t.sort((f, p) => f.original.start - p.original.start),
			o = [],
			a = i.start,
			l = i.start,
			c = !0,
			u = !0
		for (let f of s) {
			let p = r.slice(f.original.start, f.original.stop),
				g = n.slice(f.updated.start, f.updated.stop),
				m = e.determineChangeType(p, g),
				y = p.split(`
`),
				C = g.split(`
`),
				v = Math.max(y.length, C.length),
				b = f.original.start,
				w = f.updated.start
			for (let B = 0; B < v; B++) {
				let M = y.length > B ? y[B] : "",
					Q = C.length > B ? C[B] : ""
				if (
					(B < y.length - 1 &&
						(M += `
`),
					B < C.length - 1 &&
						(Q += `
`),
					M === "" && Q === "")
				)
					continue
				let O = m
				o.push({
					original: {
						text: M,
						charRange: new bo(b, b + M.length),
						line: a,
						isWholeLine:
							c &&
							M.endsWith(`
`),
					},
					updated: {
						text: Q,
						charRange: new bo(w, w + Q.length),
						line: l,
						isWholeLine:
							u &&
							Q.endsWith(`
`),
					},
					type: O,
				}),
					(b += M.length),
					(w += Q.length),
					M.endsWith(`
`)
						? (a++, (c = !0))
						: (c = !1),
					Q.endsWith(`
`)
						? (l++, (u = !0))
						: (u = !1)
			}
		}
		return o.filter((f) => f.original.text !== "" || f.updated.text !== "")
	}
	afterLineRange(t) {
		return this.state !== "accepted"
			? this.lineRange
			: t
				? this.result.charStart + yl(this.result.suggestedCode) > yl(t.getText())
					? this.lineRange
					: new Rn(
							t.positionAt(this.result.charStart).line,
							t.positionAt(this.result.charStart + yl(this.result.suggestedCode)).line,
						)
				: new Rn(
						this.lineRange.start,
						this.lineRange.stop +
							this.result.suggestedCode.split(`
`).length -
							this.result.existingCode.split(`
`).length,
					)
	}
	intersects(t) {
		return (
			this.qualifiedPathName.equals(t.qualifiedPathName) &&
			(this.lineRange.equals(t.lineRange) || this.lineRange.intersects(t.lineRange))
		)
	}
	with(t) {
		return new e(
			t.requestId ?? this.requestId,
			t.mode ?? this.mode,
			t.scope ?? this.scope,
			t.result ?? this.result,
			t.qualifiedPathName ?? this.qualifiedPathName,
			t.lineRange ?? this.lineRange,
			t.uriScheme ?? this.uriScheme,
			t.occurredAt ?? this.occurredAt,
			t.state ?? this.state,
		)
	}
	static from(t) {
		return new e(
			t.requestId,
			t.mode,
			t.scope,
			t.result,
			Je.from(t.qualifiedPathName),
			new Rn(t.lineRange.start, t.lineRange.stop),
			t.uriScheme,
			t.occurredAt,
			t.state,
		)
	}
}