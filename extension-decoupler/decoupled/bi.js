
var Ad = (e) =>
		e instanceof Fg
			? Ad(e.schema)
			: e instanceof da
				? Ad(e.innerType())
				: e instanceof Qg
					? [e.value]
					: e instanceof Ng
						? e.options
						: e instanceof Pg
							? vr.objectValues(e.enum)
							: e instanceof Lg
								? Ad(e._def.innerType)
								: e instanceof Tg
									? [void 0]
									: e instanceof Rg
										? [null]
										: e instanceof Ja
											? [void 0, ...Ad(e.unwrap())]
											: e instanceof Kc
												? [null, ...Ad(e.unwrap())]
												: e instanceof Qv || e instanceof Og
													? Ad(e.unwrap())
													: e instanceof Ug
														? Ad(e._def.innerType)
														: [],
	BI = class e extends Pt {
		_parse(t) {
			let { ctx: r } = this._processInputParams(t)
			if (r.parsedType !== Pe.object)
				return (
					Re(r, {
						code: ve.invalid_type,
						expected: Pe.object,
						received: r.parsedType,
					}),
					vt
				)
			let n = this.discriminator,
				i = r.data[n],
				s = this.optionsMap.get(i)
			return s
				? r.common.async
					? s._parseAsync({ data: r.data, path: r.path, parent: r })
					: s._parseSync({ data: r.data, path: r.path, parent: r })
				: (Re(r, {
						code: ve.invalid_union_discriminator,
						options: Array.from(this.optionsMap.keys()),
						path: [n],
					}),
					vt)
		}
		get discriminator() {
			return this._def.discriminator
		}
		get options() {
			return this._def.options
		}
		get optionsMap() {
			return this._def.optionsMap
		}
		static create(t, r, n) {
			let i = new Map()
			for (let s of r) {
				let o = Ad(s.shape[t])
				if (!o.length)
					throw new Error(
						`A discriminator value for key \`${t}\` could not be extracted from all schema options`,
					)
				for (let a of o) {
					if (i.has(a))
						throw new Error(`Discriminator property ${String(t)} has duplicate value ${String(a)}`)
					i.set(a, s)
				}
			}
			return new e({
				typeName: At.ZodDiscriminatedUnion,
				discriminator: t,
				options: r,
				optionsMap: i,
				...Nt(n),
			})
		}
	}