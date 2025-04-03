
var JQ = class {
		constructor(t) {
			this.name = t
		}
		start = Date.now()
		increments = []
		charge(t) {
			this.increments.push({ name: t, end: Date.now() })
		}
		*[Symbol.iterator]() {
			let t = this.start
			for (let { name: r, end: n } of this.increments) yield [r, n - t], (t = n)
			yield ["total", t - this.start]
		}
		format() {
			return (
				(this.name
					? `${this.name}:
`
					: "") +
				Array.from(this).map(([r, n]) => `  - ${r}: ${n} ms`).join(`
`)
			)
		}
	},
	zQ = class {
		_value = 0
		_add(t = 1) {
			this._value += t
		}
		_invalidate() {
			this._value = Number.NaN
		}
		get value() {
			return this._value
		}
	},
	M8 = class extends zQ {
		increment(t = 1) {
			this._add(t)
		}
	},
	F8 = class extends zQ {
		_start = void 0
		start() {
			this._start = Date.now()
		}
		stop() {
			this._start === void 0 ? this._invalidate() : this._add(Date.now() - this._start)
		}
	},
	NC = class {
		constructor(t) {
			this.name = t
		}
		counters = new Map()
		timings = new Map()
		counterMetric(t) {
			let r = this.counters.get(t)
			return r === void 0 && ((r = new M8()), this.counters.set(t, r)), r
		}
		timingMetric(t) {
			let r = this.timings.get(t)
			return r === void 0 && ((r = new F8()), this.timings.set(t, r)), r
		}
		format() {
			let t = this.name ? `${this.name}:` : "",
				r = Array.from(this.counters.entries()).map(([s, o]) => `  - ${s}: ${o.value}`).join(`
`),
				n = "  - timing stats:",
				i = Array.from(this.timings.entries()).map(([s, o]) => `    - ${s}: ${o.value} ms`).join(`
`)
			return (
				t +
				`
` +
				r +
				`
` +
				n +
				`
` +
				i
			)
		}
	}