
var YMe = Symbol("zod_brand"),
	Qv = class extends Pt {
		_parse(t) {
			let { ctx: r } = this._processInputParams(t),
				n = r.data
			return this._def.type._parse({ data: n, path: r.path, parent: r })
		}
		unwrap() {
			return this._def.type
		}
	},
	Nv = class e extends Pt {
		_parse(t) {
			let { status: r, ctx: n } = this._processInputParams(t)
			if (n.common.async)
				return (async () => {
					let s = await this._def.in._parseAsync({
						data: n.data,
						path: n.path,
						parent: n,
					})
					return s.status === "aborted"
						? vt
						: s.status === "dirty"
							? (r.dirty(), tm(s.value))
							: this._def.out._parseAsync({
									data: s.value,
									path: n.path,
									parent: n,
								})
				})()
			{
				let i = this._def.in._parseSync({
					data: n.data,
					path: n.path,
					parent: n,
				})
				return i.status === "aborted"
					? vt
					: i.status === "dirty"
						? (r.dirty(), { status: "dirty", value: i.value })
						: this._def.out._parseSync({
								data: i.value,
								path: n.path,
								parent: n,
							})
			}
		}
		static create(t, r) {
			return new e({ in: t, out: r, typeName: At.ZodPipeline })
		}
	},
	Og = class extends Pt {
		_parse(t) {
			let r = this._def.innerType._parse(t),
				n = (i) => (wg(i) && (i.value = Object.freeze(i.value)), i)
			return Fv(r) ? r.then((i) => n(i)) : n(r)
		}
		unwrap() {
			return this._def.innerType
		}
	}