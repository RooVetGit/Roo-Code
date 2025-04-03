
var h6 = class {
		constructor(t, r, n, i) {
			this.seq = t
			this.start = r
			this.length = n
			this.origLength = i
		}
		get end() {
			return this.start + this.length
		}
		get localShift() {
			return this.origLength - this.length
		}
	},
	UC = class e {
		constructor(t, r, n, i, s) {
			this.seq = t
			this.start = r
			this.length = n
			this.origStart = i
			this.origLength = s
		}
		static fromMod(t, r) {
			return new e(t.seq, t.start, t.length, t.start + r, t.origLength)
		}
		get end() {
			return this.start + this.length
		}
		get origEnd() {
			return this.origStart + this.origLength
		}
		setStart(t) {
			let r = this.start - t
			;(this.start -= r), (this.length += r), (this.origStart -= r), (this.origLength += r)
		}
		setEnd(t) {
			let r = t - this.end
			;(this.length += r), (this.origLength += r)
		}
	},
	OC = class e {
		static _logger = X("ChangeTracker")
		_modifications = []
		_seq = 0
		get seq() {
			return this._seq
		}
		get empty() {
			return this._modifications.length === 0
		}
		get length() {
			return this._modifications.length
		}
		translate(t, r) {
			let n = t + Math.max(r, 0),
				i = 0,
				s = 0
			for (; i < this._modifications.length && this._modifications[i].end < t; )
				(s += this._modifications[i].localShift), i++
			let a =
				(i === this._modifications.length || t < this._modifications[i].start
					? t
					: this._modifications[i].start) + s
			for (; i < this._modifications.length && this._modifications[i].end < n; )
				(s += this._modifications[i].localShift), i++
			let c =
				(i === this._modifications.length || n < this._modifications[i].start
					? n
					: this._modifications[i].start + this._modifications[i].origLength) + s
			return [a, c - a]
		}
		apply(t, r, n, i) {
			let s = 0,
				o,
				a,
				l,
				c = r,
				u = 0,
				f
			for (; s < this._modifications.length && this._modifications[s].end < r; ) s++
			if (((f = s), s < this._modifications.length && this._modifications[s].start <= r)) {
				;(o = this._modifications[s]), (a = o.length), (l = o.origLength)
				let p = c - o.start
				;(0, mwe.assert)(p <= o.length)
				let g = Math.min(o.length - p, n - u)
				;(a -= g), (u += g), (c = o.end), ++s
			} else (o = new h6(t, r, 0, 0)), (a = 0), (l = 0)
			for (; s < this._modifications.length && u < n; s++) {
				let p = this._modifications[s],
					g = p.start - c,
					m = Math.min(g, n - u)
				if (((l += m), (u += m), c + m < p.start)) break
				let y = Math.min(p.length, n - u)
				;(a += p.length - y), (u += y), (l += p.origLength), (c = p.end)
			}
			for (
				o.length = a + i,
					o.origLength = l + (n - u),
					o.seq = t,
					this._modifications.splice(f, s - f, o),
					s = f + 1;
				s < this._modifications.length;
				s++
			)
				this._modifications[s].start += i - n
			this._seq = t
		}
		merge(t) {
			for (let r of t._modifications) this.apply(r.seq, r.start, r.origLength, r.length)
		}
		advance() {
			for (let t of this._modifications) t.origLength = t.length
		}
		getEdits() {
			let t = [],
				r = 0
			for (let n of this._modifications)
				t.push(new UC(n.seq, n.start, n.length, n.start + r, n.origLength)), (r += n.localShift)
			return t
		}
		countChunks(t) {
			if (this._modifications.length === 0) return 0
			let r = this._modifications.at(-1).end
			return this.getChunks(t, r).length
		}
		getChunks(t, r) {
			if (this._modifications.length === 0) return []
			let n = new Array(),
				i,
				s = 0
			for (let a of this._modifications) {
				let l = UC.fromMod(a, s)
				if (
					((s += a.localShift),
					i !== void 0 &&
						(l.start - i.start >= t || (l.end - i.start > t && l.length <= t)) &&
						(n.push(i), (i = void 0)),
					i === void 0)
				)
					i = new UC(l.seq, l.start, 0, l.origStart, 0)
				else {
					let f = l.start - i.end
					;(i.length += f), (i.origLength += f)
				}
				let c = l.length,
					u = Math.min(c, t - i.length)
				;(i.length += u), (i.origLength += l.origLength), (i.seq = Math.max(i.seq, l.seq))
				for (let f = u; f < c; f += u) {
					n.push(i)
					let p = l.start + f
					;(i = new UC(l.seq, p, 0, l.origEnd, 0)), (u = Math.min(c - f, t)), (i.length += u)
				}
			}
			return i !== void 0 && n.push(i), this._widen(n, t, r), this._validateChunks(n)
		}
		_widen(t, r, n) {
			let i = 0
			for (let s = 0; s < t.length; s++) {
				let o = t[s],
					a = s + 1 === t.length ? n : t[s + 1].start,
					l = r - o.length,
					c,
					u,
					f = Math.floor(o.start - l / 2)
				f <= i ? ((c = i), (u = Math.min(c + r, a))) : ((u = Math.min(f + r, a)), (c = Math.max(u - r, i))),
					o.setStart(c),
					o.setEnd(u),
					(i = u)
			}
		}
		_validateChunks(t) {
			let r = new Array()
			for (let n of t) n.origStart > n.origEnd ? e._logger.error("invalid chunk: ", JSON.stringify(n)) : r.push(n)
			return r
		}
	}