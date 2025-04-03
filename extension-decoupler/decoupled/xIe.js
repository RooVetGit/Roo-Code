
	var { isIP: D$e } = require("net"),
		{ lookup: T$e } = require("dns"),
		R$e = fD(),
		{ InvalidArgumentError: b0, InformationalError: k$e } = Vr(),
		Xie = Math.pow(2, 31) - 1,
		CV = class {
			#e = 0
			#t = 0
			#i = new Map()
			dualStack = !0
			affinity = null
			lookup = null
			pick = null
			constructor(t) {
				;(this.#e = t.maxTTL),
					(this.#t = t.maxItems),
					(this.dualStack = t.dualStack),
					(this.affinity = t.affinity),
					(this.lookup = t.lookup ?? this.#n),
					(this.pick = t.pick ?? this.#r)
			}
			get full() {
				return this.#i.size === this.#t
			}
			runLookup(t, r, n) {
				let i = this.#i.get(t.hostname)
				if (i == null && this.full) {
					n(null, t.origin)
					return
				}
				let s = {
					affinity: this.affinity,
					dualStack: this.dualStack,
					lookup: this.lookup,
					pick: this.pick,
					...r.dns,
					maxTTL: this.#e,
					maxItems: this.#t,
				}
				if (i == null)
					this.lookup(t, s, (o, a) => {
						if (o || a == null || a.length === 0) {
							n(o ?? new k$e("No DNS entries found"))
							return
						}
						this.setRecords(t, a)
						let l = this.#i.get(t.hostname),
							c = this.pick(t, l, s.affinity),
							u
						typeof c.port == "number" ? (u = `:${c.port}`) : t.port !== "" ? (u = `:${t.port}`) : (u = ""),
							n(null, `${t.protocol}//${c.family === 6 ? `[${c.address}]` : c.address}${u}`)
					})
				else {
					let o = this.pick(t, i, s.affinity)
					if (o == null) {
						this.#i.delete(t.hostname), this.runLookup(t, r, n)
						return
					}
					let a
					typeof o.port == "number" ? (a = `:${o.port}`) : t.port !== "" ? (a = `:${t.port}`) : (a = ""),
						n(null, `${t.protocol}//${o.family === 6 ? `[${o.address}]` : o.address}${a}`)
				}
			}
			#n(t, r, n) {
				T$e(
					t.hostname,
					{
						all: !0,
						family: this.dualStack === !1 ? this.affinity : 0,
						order: "ipv4first",
					},
					(i, s) => {
						if (i) return n(i)
						let o = new Map()
						for (let a of s) o.set(`${a.address}:${a.family}`, a)
						n(null, o.values())
					},
				)
			}
			#r(t, r, n) {
				let i = null,
					{ records: s, offset: o } = r,
					a
				if (
					(this.dualStack
						? (n == null &&
								(o == null || o === Xie
									? ((r.offset = 0), (n = 4))
									: (r.offset++, (n = (r.offset & 1) === 1 ? 6 : 4))),
							s[n] != null && s[n].ips.length > 0 ? (a = s[n]) : (a = s[n === 4 ? 6 : 4]))
						: (a = s[n]),
					a == null || a.ips.length === 0)
				)
					return i
				a.offset == null || a.offset === Xie ? (a.offset = 0) : a.offset++
				let l = a.offset % a.ips.length
				return (
					(i = a.ips[l] ?? null),
					i == null ? i : Date.now() - i.timestamp > i.ttl ? (a.ips.splice(l, 1), this.pick(t, r, n)) : i
				)
			}
			setRecords(t, r) {
				let n = Date.now(),
					i = { records: { 4: null, 6: null } }
				for (let s of r) {
					;(s.timestamp = n),
						typeof s.ttl == "number" ? (s.ttl = Math.min(s.ttl, this.#e)) : (s.ttl = this.#e)
					let o = i.records[s.family] ?? { ips: [] }
					o.ips.push(s), (i.records[s.family] = o)
				}
				this.#i.set(t.hostname, i)
			}
			getHandler(t, r) {
				return new vV(this, t, r)
			}
		},
		vV = class extends R$e {
			#e = null
			#t = null
			#i = null
			#n = null
			#r = null
			constructor(t, { origin: r, handler: n, dispatch: i }, s) {
				super(n), (this.#r = r), (this.#n = n), (this.#t = { ...s }), (this.#e = t), (this.#i = i)
			}
			onError(t) {
				switch (t.code) {
					case "ETIMEDOUT":
					case "ECONNREFUSED": {
						if (this.#e.dualStack) {
							this.#e.runLookup(this.#r, this.#t, (r, n) => {
								if (r) return this.#n.onError(r)
								let i = { ...this.#t, origin: n }
								this.#i(i, this)
							})
							return
						}
						this.#n.onError(t)
						return
					}
					case "ENOTFOUND":
						this.#e.deleteRecord(this.#r)
					default:
						this.#n.onError(t)
						break
				}
			}
		}