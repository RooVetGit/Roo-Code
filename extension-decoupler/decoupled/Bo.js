
var vC = class e {
		constructor(t, r) {
			this.start = t
			this.stop = r
		}
		equals(t) {
			return this.start === t.start && this.stop === t.stop
		}
		get length() {
			return this.stop - this.start
		}
		toString() {
			return `[${this.start}, ${this.stop})`
		}
		compareTo(t) {
			return this.start - t.start
		}
		contains(t) {
			return (
				typeof t == "number" && (t = new e(t, t + 1)),
				this.start <= t.start && this.stop >= t.stop && this.stop > t.start
			)
		}
		intersects(t) {
			return typeof t == "number" && (t = new e(t, t + 1)), this.start < t.stop && this.stop > t.start
		}
		touches(t) {
			return typeof t == "number" && (t = new e(t, t + 1)), this.start === t.stop || this.stop === t.start
		}
		intersection(t) {
			if (this.intersects(t)) return new e(Math.max(this.start, t.start), Math.min(this.stop, t.stop))
		}
		distanceTo(t) {
			return (
				typeof t == "number" && (t = new e(t, t + 1)),
				-Math.min(0, Math.min(this.stop, t.stop) - Math.max(this.start, t.start))
			)
		}
		offset(t, r, n = -1 / 0, i = 1 / 0) {
			let s = Math.min(i, Math.max(n, this.start + t)),
				o = Math.max(n, Math.min(i, this.stop + r))
			if (s > o) {
				let a = Math.ceil((this.start + this.stop) / 2),
					l = Math.max(n, Math.min(i, a))
				return new e(l, l)
			}
			return new e(s, o)
		}
		static anyOverlaps(t) {
			if (t.length <= 1) return !1
			t.sort((n, i) => (n.start === i.start ? n.stop - i.stop : n.start - i.start))
			let r = t[0].stop
			for (let n = 1; n < t.length; n++) {
				if (t[n].start < r) return !0
				r = t[n].stop
			}
			return !1
		}
		static mergeTouching(t) {
			if (t.length <= 1) return [...t]
			let r = [...t].sort((i, s) => i.start - s.start),
				n = [r[0]]
			for (let i = 1; i < r.length; i++) {
				let s = n[n.length - 1],
					o = r[i]
				s.stop >= o.start ? (s.stop = Math.max(s.stop, o.stop)) : n.push(o)
			}
			return n
		}
	},
	bo = class extends vC {},
	Rn = class extends vC {}