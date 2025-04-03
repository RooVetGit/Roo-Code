
var Cd = class e extends Pt {
	_parse(t) {
		let { ctx: r, status: n } = this._processInputParams(t),
			i = this._def
		if (r.parsedType !== Pe.array)
			return (
				Re(r, {
					code: ve.invalid_type,
					expected: Pe.array,
					received: r.parsedType,
				}),
				vt
			)
		if (i.exactLength !== null) {
			let o = r.data.length > i.exactLength.value,
				a = r.data.length < i.exactLength.value
			;(o || a) &&
				(Re(r, {
					code: o ? ve.too_big : ve.too_small,
					minimum: a ? i.exactLength.value : void 0,
					maximum: o ? i.exactLength.value : void 0,
					type: "array",
					inclusive: !0,
					exact: !0,
					message: i.exactLength.message,
				}),
				n.dirty())
		}
		if (
			(i.minLength !== null &&
				r.data.length < i.minLength.value &&
				(Re(r, {
					code: ve.too_small,
					minimum: i.minLength.value,
					type: "array",
					inclusive: !0,
					exact: !1,
					message: i.minLength.message,
				}),
				n.dirty()),
			i.maxLength !== null &&
				r.data.length > i.maxLength.value &&
				(Re(r, {
					code: ve.too_big,
					maximum: i.maxLength.value,
					type: "array",
					inclusive: !0,
					exact: !1,
					message: i.maxLength.message,
				}),
				n.dirty()),
			r.common.async)
		)
			return Promise.all([...r.data].map((o, a) => i.type._parseAsync(new za(r, o, r.path, a)))).then((o) =>
				Ms.mergeArray(n, o),
			)
		let s = [...r.data].map((o, a) => i.type._parseSync(new za(r, o, r.path, a)))
		return Ms.mergeArray(n, s)
	}
	get element() {
		return this._def.type
	}
	min(t, r) {
		return new e({
			...this._def,
			minLength: { value: t, message: $e.toString(r) },
		})
	}
	max(t, r) {
		return new e({
			...this._def,
			maxLength: { value: t, message: $e.toString(r) },
		})
	}
	length(t, r) {
		return new e({
			...this._def,
			exactLength: { value: t, message: $e.toString(r) },
		})
	}
	nonempty(t) {
		return this.min(1, t)
	}
}