
var Ux = x((X1t, yye) => {
	"use strict"
	var Ox = Symbol("SemVer ANY"),
		t4 = class e {
			static get ANY() {
				return Ox
			}
			constructor(t, r) {
				if (((r = hye(r)), t instanceof e)) {
					if (t.loose === !!r.loose) return t
					t = t.value
				}
				;(t = t.trim().split(/\s+/).join(" ")),
					e4("comparator", t, r),
					(this.options = r),
					(this.loose = !!r.loose),
					this.parse(t),
					this.semver === Ox ? (this.value = "") : (this.value = this.operator + this.semver.version),
					e4("comp", this)
			}
			parse(t) {
				let r = this.options.loose ? gye[pye.COMPARATORLOOSE] : gye[pye.COMPARATOR],
					n = t.match(r)
				if (!n) throw new TypeError(`Invalid comparator: ${t}`)
				;(this.operator = n[1] !== void 0 ? n[1] : ""),
					this.operator === "=" && (this.operator = ""),
					n[2] ? (this.semver = new Aye(n[2], this.options.loose)) : (this.semver = Ox)
			}
			toString() {
				return this.value
			}
			test(t) {
				if ((e4("Comparator.test", t, this.options.loose), this.semver === Ox || t === Ox)) return !0
				if (typeof t == "string")
					try {
						t = new Aye(t, this.options)
					} catch {
						return !1
					}
				return XW(t, this.operator, this.semver, this.options)
			}
			intersects(t, r) {
				if (!(t instanceof e)) throw new TypeError("a Comparator is required")
				return this.operator === ""
					? this.value === ""
						? !0
						: new mye(t.value, r).test(this.value)
					: t.operator === ""
						? t.value === ""
							? !0
							: new mye(this.value, r).test(t.semver)
						: ((r = hye(r)),
							(r.includePrerelease && (this.value === "<0.0.0-0" || t.value === "<0.0.0-0")) ||
							(!r.includePrerelease && (this.value.startsWith("<0.0.0") || t.value.startsWith("<0.0.0")))
								? !1
								: !!(
										(this.operator.startsWith(">") && t.operator.startsWith(">")) ||
										(this.operator.startsWith("<") && t.operator.startsWith("<")) ||
										(this.semver.version === t.semver.version &&
											this.operator.includes("=") &&
											t.operator.includes("=")) ||
										(XW(this.semver, "<", t.semver, r) &&
											this.operator.startsWith(">") &&
											t.operator.startsWith("<")) ||
										(XW(this.semver, ">", t.semver, r) &&
											this.operator.startsWith("<") &&
											t.operator.startsWith(">"))
									))
			}
		}
	yye.exports = t4
	var hye = Fk(),
		{ safeRe: gye, t: pye } = My(),
		XW = JW(),
		e4 = Px(),
		Aye = Ws(),
		mye = bl()
})