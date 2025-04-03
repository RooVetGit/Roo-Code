
	var wft = /\s+/g,
		jW = class e {
			constructor(t, r) {
				if (((r = Sft(r)), t instanceof e))
					return t.loose === !!r.loose && t.includePrerelease === !!r.includePrerelease ? t : new e(t.raw, r)
				if (t instanceof ZW) return (this.raw = t.value), (this.set = [[t]]), (this.formatted = void 0), this
				if (
					((this.options = r),
					(this.loose = !!r.loose),
					(this.includePrerelease = !!r.includePrerelease),
					(this.raw = t.trim().replace(wft, " ")),
					(this.set = this.raw
						.split("||")
						.map((n) => this.parseRange(n.trim()))
						.filter((n) => n.length)),
					!this.set.length)
				)
					throw new TypeError(`Invalid SemVer Range: ${this.raw}`)
				if (this.set.length > 1) {
					let n = this.set[0]
					if (((this.set = this.set.filter((i) => !uye(i[0]))), this.set.length === 0)) this.set = [n]
					else if (this.set.length > 1) {
						for (let i of this.set)
							if (i.length === 1 && Fft(i[0])) {
								this.set = [i]
								break
							}
					}
				}
				this.formatted = void 0
			}
			get range() {
				if (this.formatted === void 0) {
					this.formatted = ""
					for (let t = 0; t < this.set.length; t++) {
						t > 0 && (this.formatted += "||")
						let r = this.set[t]
						for (let n = 0; n < r.length; n++)
							n > 0 && (this.formatted += " "), (this.formatted += r[n].toString().trim())
					}
				}
				return this.formatted
			}
			format() {
				return this.range
			}
			toString() {
				return this.range
			}
			parseRange(t) {
				let n = ((this.options.includePrerelease && kft) | (this.options.loose && Mft)) + ":" + t,
					i = cye.get(n)
				if (i) return i
				let s = this.options.loose,
					o = s ? Yo[po.HYPHENRANGELOOSE] : Yo[po.HYPHENRANGE]
				;(t = t.replace(o, Wft(this.options.includePrerelease))),
					Sn("hyphen replace", t),
					(t = t.replace(Yo[po.COMPARATORTRIM], Dft)),
					Sn("comparator trim", t),
					(t = t.replace(Yo[po.TILDETRIM], Tft)),
					Sn("tilde trim", t),
					(t = t.replace(Yo[po.CARETTRIM], Rft)),
					Sn("caret trim", t)
				let a = t
					.split(" ")
					.map((f) => Qft(f, this.options))
					.join(" ")
					.split(/\s+/)
					.map((f) => Hft(f, this.options))
				s &&
					(a = a.filter(
						(f) => (Sn("loose invalid filter", f, this.options), !!f.match(Yo[po.COMPARATORLOOSE])),
					)),
					Sn("range list", a)
				let l = new Map(),
					c = a.map((f) => new ZW(f, this.options))
				for (let f of c) {
					if (uye(f)) return [f]
					l.set(f.value, f)
				}
				l.size > 1 && l.has("") && l.delete("")
				let u = [...l.values()]
				return cye.set(n, u), u
			}
			intersects(t, r) {
				if (!(t instanceof e)) throw new TypeError("a Range is required")
				return this.set.some(
					(n) =>
						dye(n, r) && t.set.some((i) => dye(i, r) && n.every((s) => i.every((o) => s.intersects(o, r)))),
				)
			}
			test(t) {
				if (!t) return !1
				if (typeof t == "string")
					try {
						t = new Bft(t, this.options)
					} catch {
						return !1
					}
				for (let r = 0; r < this.set.length; r++) if (Gft(this.set[r], t, this.options)) return !0
				return !1
			}
		}