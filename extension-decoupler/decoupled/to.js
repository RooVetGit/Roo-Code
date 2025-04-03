
var To = class e extends Pt {
	constructor() {
		super(...arguments), (this._cached = null), (this.nonstrict = this.passthrough), (this.augment = this.extend)
	}
	_getCached() {
		if (this._cached !== null) return this._cached
		let t = this._def.shape(),
			r = vr.objectKeys(t)
		return (this._cached = { shape: t, keys: r })
	}
	_parse(t) {
		if (this._getType(t) !== Pe.object) {
			let c = this._getOrReturnCtx(t)
			return (
				Re(c, {
					code: ve.invalid_type,
					expected: Pe.object,
					received: c.parsedType,
				}),
				vt
			)
		}
		let { status: n, ctx: i } = this._processInputParams(t),
			{ shape: s, keys: o } = this._getCached(),
			a = []
		if (!(this._def.catchall instanceof zl && this._def.unknownKeys === "strip"))
			for (let c in i.data) o.includes(c) || a.push(c)
		let l = []
		for (let c of o) {
			let u = s[c],
				f = i.data[c]
			l.push({
				key: { status: "valid", value: c },
				value: u._parse(new za(i, f, i.path, c)),
				alwaysSet: c in i.data,
			})
		}
		if (this._def.catchall instanceof zl) {
			let c = this._def.unknownKeys
			if (c === "passthrough")
				for (let u of a)
					l.push({
						key: { status: "valid", value: u },
						value: { status: "valid", value: i.data[u] },
					})
			else if (c === "strict") a.length > 0 && (Re(i, { code: ve.unrecognized_keys, keys: a }), n.dirty())
			else if (c !== "strip") throw new Error("Internal ZodObject error: invalid unknownKeys value.")
		} else {
			let c = this._def.catchall
			for (let u of a) {
				let f = i.data[u]
				l.push({
					key: { status: "valid", value: u },
					value: c._parse(new za(i, f, i.path, u)),
					alwaysSet: u in i.data,
				})
			}
		}
		return i.common.async
			? Promise.resolve()
					.then(async () => {
						let c = []
						for (let u of l) {
							let f = await u.key,
								p = await u.value
							c.push({ key: f, value: p, alwaysSet: u.alwaysSet })
						}
						return c
					})
					.then((c) => Ms.mergeObjectSync(n, c))
			: Ms.mergeObjectSync(n, l)
	}
	get shape() {
		return this._def.shape()
	}
	strict(t) {
		return (
			$e.errToObj,
			new e({
				...this._def,
				unknownKeys: "strict",
				...(t !== void 0
					? {
							errorMap: (r, n) => {
								var i, s, o, a
								let l =
									(o =
										(s = (i = this._def).errorMap) === null || s === void 0
											? void 0
											: s.call(i, r, n).message) !== null && o !== void 0
										? o
										: n.defaultError
								return r.code === "unrecognized_keys"
									? {
											message: (a = $e.errToObj(t).message) !== null && a !== void 0 ? a : l,
										}
									: { message: l }
							},
						}
					: {}),
			})
		)
	}
	strip() {
		return new e({ ...this._def, unknownKeys: "strip" })
	}
	passthrough() {
		return new e({ ...this._def, unknownKeys: "passthrough" })
	}
	extend(t) {
		return new e({
			...this._def,
			shape: () => ({ ...this._def.shape(), ...t }),
		})
	}
	merge(t) {
		return new e({
			unknownKeys: t._def.unknownKeys,
			catchall: t._def.catchall,
			shape: () => ({ ...this._def.shape(), ...t._def.shape() }),
			typeName: At.ZodObject,
		})
	}
	setKey(t, r) {
		return this.augment({ [t]: r })
	}
	catchall(t) {
		return new e({ ...this._def, catchall: t })
	}
	pick(t) {
		let r = {}
		return (
			vr.objectKeys(t).forEach((n) => {
				t[n] && this.shape[n] && (r[n] = this.shape[n])
			}),
			new e({ ...this._def, shape: () => r })
		)
	}
	omit(t) {
		let r = {}
		return (
			vr.objectKeys(this.shape).forEach((n) => {
				t[n] || (r[n] = this.shape[n])
			}),
			new e({ ...this._def, shape: () => r })
		)
	}
	deepPartial() {
		return em(this)
	}
	partial(t) {
		let r = {}
		return (
			vr.objectKeys(this.shape).forEach((n) => {
				let i = this.shape[n]
				t && !t[n] ? (r[n] = i) : (r[n] = i.optional())
			}),
			new e({ ...this._def, shape: () => r })
		)
	}
	required(t) {
		let r = {}
		return (
			vr.objectKeys(this.shape).forEach((n) => {
				if (t && !t[n]) r[n] = this.shape[n]
				else {
					let s = this.shape[n]
					for (; s instanceof Ja; ) s = s._def.innerType
					r[n] = s
				}
			}),
			new e({ ...this._def, shape: () => r })
		)
	}
	keyof() {
		return EY(vr.objectKeys(this.shape))
	}
}