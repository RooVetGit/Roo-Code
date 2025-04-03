
var ME = x((uIt, Qte) => {
	"use strict"
	var { isBlobLike: SB, iteratorMixin: A4e } = ga(),
		{ kState: no } = Gf(),
		{ kEnumerableProperty: t0 } = Xt(),
		{ FileLike: Rte, isFileLike: m4e } = OO(),
		{ webidl: fn } = ys(),
		{ File: Fte } = require("buffer"),
		kte = require("util"),
		Mte = globalThis.File ?? Fte,
		kE = class e {
			constructor(t) {
				if ((fn.util.markAsUncloneable(this), t !== void 0))
					throw fn.errors.conversionFailed({
						prefix: "FormData constructor",
						argument: "Argument 1",
						types: ["undefined"],
					})
				this[no] = []
			}
			append(t, r, n = void 0) {
				fn.brandCheck(this, e)
				let i = "FormData.append"
				if ((fn.argumentLengthCheck(arguments, 2, i), arguments.length === 3 && !SB(r)))
					throw new TypeError("Failed to execute 'append' on 'FormData': parameter 2 is not of type 'Blob'")
				;(t = fn.converters.USVString(t, i, "name")),
					(r = SB(r)
						? fn.converters.Blob(r, i, "value", { strict: !1 })
						: fn.converters.USVString(r, i, "value")),
					(n = arguments.length === 3 ? fn.converters.USVString(n, i, "filename") : void 0)
				let s = qO(t, r, n)
				this[no].push(s)
			}
			delete(t) {
				fn.brandCheck(this, e)
				let r = "FormData.delete"
				fn.argumentLengthCheck(arguments, 1, r),
					(t = fn.converters.USVString(t, r, "name")),
					(this[no] = this[no].filter((n) => n.name !== t))
			}
			get(t) {
				fn.brandCheck(this, e)
				let r = "FormData.get"
				fn.argumentLengthCheck(arguments, 1, r), (t = fn.converters.USVString(t, r, "name"))
				let n = this[no].findIndex((i) => i.name === t)
				return n === -1 ? null : this[no][n].value
			}
			getAll(t) {
				fn.brandCheck(this, e)
				let r = "FormData.getAll"
				return (
					fn.argumentLengthCheck(arguments, 1, r),
					(t = fn.converters.USVString(t, r, "name")),
					this[no].filter((n) => n.name === t).map((n) => n.value)
				)
			}
			has(t) {
				fn.brandCheck(this, e)
				let r = "FormData.has"
				return (
					fn.argumentLengthCheck(arguments, 1, r),
					(t = fn.converters.USVString(t, r, "name")),
					this[no].findIndex((n) => n.name === t) !== -1
				)
			}
			set(t, r, n = void 0) {
				fn.brandCheck(this, e)
				let i = "FormData.set"
				if ((fn.argumentLengthCheck(arguments, 2, i), arguments.length === 3 && !SB(r)))
					throw new TypeError("Failed to execute 'set' on 'FormData': parameter 2 is not of type 'Blob'")
				;(t = fn.converters.USVString(t, i, "name")),
					(r = SB(r)
						? fn.converters.Blob(r, i, "name", { strict: !1 })
						: fn.converters.USVString(r, i, "name")),
					(n = arguments.length === 3 ? fn.converters.USVString(n, i, "name") : void 0)
				let s = qO(t, r, n),
					o = this[no].findIndex((a) => a.name === t)
				o !== -1
					? (this[no] = [...this[no].slice(0, o), s, ...this[no].slice(o + 1).filter((a) => a.name !== t)])
					: this[no].push(s)
			}
			[kte.inspect.custom](t, r) {
				let n = this[no].reduce(
					(s, o) => (
						s[o.name]
							? Array.isArray(s[o.name])
								? s[o.name].push(o.value)
								: (s[o.name] = [s[o.name], o.value])
							: (s[o.name] = o.value),
						s
					),
					{ __proto__: null },
				)
				;(r.depth ??= t), (r.colors ??= !0)
				let i = kte.formatWithOptions(r, n)
				return `FormData ${i.slice(i.indexOf("]") + 2)}`
			}
		}
	A4e("FormData", kE, no, "name", "value")
	Object.defineProperties(kE.prototype, {
		append: t0,
		delete: t0,
		get: t0,
		getAll: t0,
		has: t0,
		set: t0,
		[Symbol.toStringTag]: { value: "FormData", configurable: !0 },
	})
	function qO(e, t, r) {
		if (typeof t != "string") {
			if (
				(m4e(t) ||
					(t =
						t instanceof Blob
							? new Mte([t], "blob", { type: t.type })
							: new Rte(t, "blob", { type: t.type })),
				r !== void 0)
			) {
				let n = { type: t.type, lastModified: t.lastModified }
				t = t instanceof Fte ? new Mte([t], r, n) : new Rte(t, r, n)
			}
		}
		return { name: e, value: t }
	}
	Qte.exports = { FormData: kE, makeEntry: qO }
})