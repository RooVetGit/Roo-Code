
var ta = class e {
	constructor(t, r = (i, s) => i === s, n = []) {
		this._value = t
		this._equalityFn = r
		this._listeners = n
	}
	static watch(t, ...r) {
		let n = () => t(...r.map((a) => a.value)),
			i = new e(n()),
			s = r.map((a) =>
				a.listen(() => {
					i.value = n()
				}),
			),
			o = i.dispose
		return (
			(i.dispose = () => {
				o(), s.forEach((a) => a())
			}),
			i
		)
	}
	dispose = () => {
		this._listeners = []
	}
	listen(t, r = !1) {
		return (
			r && t(this._value, this._value),
			this._listeners.push(t),
			() => {
				this._listeners = this._listeners.filter((n) => n !== t)
			}
		)
	}
	get value() {
		return this._value
	}
	set value(t) {
		if (this._equalityFn(t, this._value)) return
		let r = this._value
		this._value = t
		for (let n of this._listeners) n(t, r)
	}
	waitUntil(t, r) {
		return new Promise((n, i) => {
			let s,
				o =
					r !== void 0 &&
					setTimeout(() => {
						s?.(), i(new Error("Timeout exceeded."))
					}, r)
			s = this.listen((a) => {
				t(a) && (o && clearTimeout(o), s?.(), n(a))
			}, !0)
		})
	}
}