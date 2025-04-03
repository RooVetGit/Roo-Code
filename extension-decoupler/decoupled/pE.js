
var Pe = vr.arrayToEnum([
		"string",
		"nan",
		"number",
		"integer",
		"float",
		"boolean",
		"date",
		"bigint",
		"symbol",
		"function",
		"undefined",
		"null",
		"array",
		"object",
		"unknown",
		"promise",
		"void",
		"never",
		"map",
		"set",
	]),
	md = (e) => {
		switch (typeof e) {
			case "undefined":
				return Pe.undefined
			case "string":
				return Pe.string
			case "number":
				return isNaN(e) ? Pe.nan : Pe.number
			case "boolean":
				return Pe.boolean
			case "function":
				return Pe.function
			case "bigint":
				return Pe.bigint
			case "symbol":
				return Pe.symbol
			case "object":
				return Array.isArray(e)
					? Pe.array
					: e === null
						? Pe.null
						: e.then && typeof e.then == "function" && e.catch && typeof e.catch == "function"
							? Pe.promise
							: typeof Map < "u" && e instanceof Map
								? Pe.map
								: typeof Set < "u" && e instanceof Set
									? Pe.set
									: typeof Date < "u" && e instanceof Date
										? Pe.date
										: Pe.object
			default:
				return Pe.unknown
		}
	},
	ve = vr.arrayToEnum([
		"invalid_type",
		"invalid_literal",
		"custom",
		"invalid_union",
		"invalid_union_discriminator",
		"invalid_enum_value",
		"unrecognized_keys",
		"invalid_arguments",
		"invalid_return_type",
		"invalid_date",
		"invalid_string",
		"too_small",
		"too_big",
		"invalid_intersection_types",
		"not_multiple_of",
		"not_finite",
	]),
	xMe = (e) => JSON.stringify(e, null, 2).replace(/"([^"]+)":/g, "$1:"),
	ua = class e extends Error {
		get errors() {
			return this.issues
		}
		constructor(t) {
			super(),
				(this.issues = []),
				(this.addIssue = (n) => {
					this.issues = [...this.issues, n]
				}),
				(this.addIssues = (n = []) => {
					this.issues = [...this.issues, ...n]
				})
			let r = new.target.prototype
			Object.setPrototypeOf ? Object.setPrototypeOf(this, r) : (this.__proto__ = r),
				(this.name = "ZodError"),
				(this.issues = t)
		}
		format(t) {
			let r =
					t ||
					function (s) {
						return s.message
					},
				n = { _errors: [] },
				i = (s) => {
					for (let o of s.issues)
						if (o.code === "invalid_union") o.unionErrors.map(i)
						else if (o.code === "invalid_return_type") i(o.returnTypeError)
						else if (o.code === "invalid_arguments") i(o.argumentsError)
						else if (o.path.length === 0) n._errors.push(r(o))
						else {
							let a = n,
								l = 0
							for (; l < o.path.length; ) {
								let c = o.path[l]
								l === o.path.length - 1
									? ((a[c] = a[c] || { _errors: [] }), a[c]._errors.push(r(o)))
									: (a[c] = a[c] || { _errors: [] }),
									(a = a[c]),
									l++
							}
						}
				}
			return i(this), n
		}
		static assert(t) {
			if (!(t instanceof e)) throw new Error(`Not a ZodError: ${t}`)
		}
		toString() {
			return this.message
		}
		get message() {
			return JSON.stringify(this.issues, vr.jsonStringifyReplacer, 2)
		}
		get isEmpty() {
			return this.issues.length === 0
		}
		flatten(t = (r) => r.message) {
			let r = {},
				n = []
			for (let i of this.issues)
				i.path.length > 0 ? ((r[i.path[0]] = r[i.path[0]] || []), r[i.path[0]].push(t(i))) : n.push(t(i))
			return { formErrors: n, fieldErrors: r }
		}
		get formErrors() {
			return this.flatten()
		}
	}