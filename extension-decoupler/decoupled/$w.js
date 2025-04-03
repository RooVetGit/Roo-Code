
	var Qk = Px(),
		{ MAX_LENGTH: A0e, MAX_SAFE_INTEGER: Nk } = Nx(),
		{ safeRe: m0e, t: y0e } = My(),
		Rdt = Fk(),
		{ compareIdentifiers: Fy } = GW(),
		$W = class e {
			constructor(t, r) {
				if (((r = Rdt(r)), t instanceof e)) {
					if (t.loose === !!r.loose && t.includePrerelease === !!r.includePrerelease) return t
					t = t.version
				} else if (typeof t != "string")
					throw new TypeError(`Invalid version. Must be a string. Got type "${typeof t}".`)
				if (t.length > A0e) throw new TypeError(`version is longer than ${A0e} characters`)
				Qk("SemVer", t, r),
					(this.options = r),
					(this.loose = !!r.loose),
					(this.includePrerelease = !!r.includePrerelease)
				let n = t.trim().match(r.loose ? m0e[y0e.LOOSE] : m0e[y0e.FULL])
				if (!n) throw new TypeError(`Invalid Version: ${t}`)
				if (
					((this.raw = t),
					(this.major = +n[1]),
					(this.minor = +n[2]),
					(this.patch = +n[3]),
					this.major > Nk || this.major < 0)
				)
					throw new TypeError("Invalid major version")
				if (this.minor > Nk || this.minor < 0) throw new TypeError("Invalid minor version")
				if (this.patch > Nk || this.patch < 0) throw new TypeError("Invalid patch version")
				n[4]
					? (this.prerelease = n[4].split(".").map((i) => {
							if (/^[0-9]+$/.test(i)) {
								let s = +i
								if (s >= 0 && s < Nk) return s
							}
							return i
						}))
					: (this.prerelease = []),
					(this.build = n[5] ? n[5].split(".") : []),
					this.format()
			}
			format() {
				return (
					(this.version = `${this.major}.${this.minor}.${this.patch}`),
					this.prerelease.length && (this.version += `-${this.prerelease.join(".")}`),
					this.version
				)
			}
			toString() {
				return this.version
			}
			compare(t) {
				if ((Qk("SemVer.compare", this.version, this.options, t), !(t instanceof e))) {
					if (typeof t == "string" && t === this.version) return 0
					t = new e(t, this.options)
				}
				return t.version === this.version ? 0 : this.compareMain(t) || this.comparePre(t)
			}
			compareMain(t) {
				return (
					t instanceof e || (t = new e(t, this.options)),
					Fy(this.major, t.major) || Fy(this.minor, t.minor) || Fy(this.patch, t.patch)
				)
			}
			comparePre(t) {
				if ((t instanceof e || (t = new e(t, this.options)), this.prerelease.length && !t.prerelease.length))
					return -1
				if (!this.prerelease.length && t.prerelease.length) return 1
				if (!this.prerelease.length && !t.prerelease.length) return 0
				let r = 0
				do {
					let n = this.prerelease[r],
						i = t.prerelease[r]
					if ((Qk("prerelease compare", r, n, i), n === void 0 && i === void 0)) return 0
					if (i === void 0) return 1
					if (n === void 0) return -1
					if (n === i) continue
					return Fy(n, i)
				} while (++r)
			}
			compareBuild(t) {
				t instanceof e || (t = new e(t, this.options))
				let r = 0
				do {
					let n = this.build[r],
						i = t.build[r]
					if ((Qk("build compare", r, n, i), n === void 0 && i === void 0)) return 0
					if (i === void 0) return 1
					if (n === void 0) return -1
					if (n === i) continue
					return Fy(n, i)
				} while (++r)
			}
			inc(t, r, n) {
				switch (t) {
					case "premajor":
						;(this.prerelease.length = 0),
							(this.patch = 0),
							(this.minor = 0),
							this.major++,
							this.inc("pre", r, n)
						break
					case "preminor":
						;(this.prerelease.length = 0), (this.patch = 0), this.minor++, this.inc("pre", r, n)
						break
					case "prepatch":
						;(this.prerelease.length = 0), this.inc("patch", r, n), this.inc("pre", r, n)
						break
					case "prerelease":
						this.prerelease.length === 0 && this.inc("patch", r, n), this.inc("pre", r, n)
						break
					case "major":
						;(this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) && this.major++,
							(this.minor = 0),
							(this.patch = 0),
							(this.prerelease = [])
						break
					case "minor":
						;(this.patch !== 0 || this.prerelease.length === 0) && this.minor++,
							(this.patch = 0),
							(this.prerelease = [])
						break
					case "patch":
						this.prerelease.length === 0 && this.patch++, (this.prerelease = [])
						break
					case "pre": {
						let i = Number(n) ? 1 : 0
						if (!r && n === !1) throw new Error("invalid increment argument: identifier is empty")
						if (this.prerelease.length === 0) this.prerelease = [i]
						else {
							let s = this.prerelease.length
							for (; --s >= 0; ) typeof this.prerelease[s] == "number" && (this.prerelease[s]++, (s = -2))
							if (s === -1) {
								if (r === this.prerelease.join(".") && n === !1)
									throw new Error("invalid increment argument: identifier already exists")
								this.prerelease.push(i)
							}
						}
						if (r) {
							let s = [r, i]
							n === !1 && (s = [r]),
								Fy(this.prerelease[0], r) === 0
									? isNaN(this.prerelease[1]) && (this.prerelease = s)
									: (this.prerelease = s)
						}
						break
					}
					default:
						throw new Error(`invalid increment argument: ${t}`)
				}
				return (this.raw = this.format()), this.build.length && (this.raw += `+${this.build.join(".")}`), this
			}
		}