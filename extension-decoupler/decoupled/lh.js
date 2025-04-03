
var Zut = (e) => !Hme.has(e),
	WMt = Symbol("type"),
	Lh = (e) => e && e === Math.floor(e) && e > 0 && isFinite(e),
	Gme = (e) =>
		Lh(e)
			? e <= Math.pow(2, 8)
				? Uint8Array
				: e <= Math.pow(2, 16)
					? Uint16Array
					: e <= Math.pow(2, 32)
						? Uint32Array
						: e <= Number.MAX_SAFE_INTEGER
							? Ty
							: null
			: null,
	Ty = class extends Array {
		constructor(t) {
			super(t), this.fill(0)
		}
	},
	LW = class e {
		heap
		length
		static #e = !1
		static create(t) {
			let r = Gme(t)
			if (!r) return []
			e.#e = !0
			let n = new e(t, r)
			return (e.#e = !1), n
		}
		constructor(t, r) {
			if (!e.#e) throw new TypeError("instantiate Stack using Stack.create(n)")
			;(this.heap = new r(t)), (this.length = 0)
		}
		push(t) {
			this.heap[this.length++] = t
		}
		pop() {
			return this.heap[--this.length]
		}
	},
	Ry = class e {
		#e
		#t
		#i
		#n
		#r
		#l
		ttl
		ttlResolution
		ttlAutopurge
		updateAgeOnGet
		updateAgeOnHas
		allowStale
		noDisposeOnSet
		noUpdateTTL
		maxEntrySize
		sizeCalculation
		noDeleteOnFetchRejection
		noDeleteOnStaleGet
		allowStaleOnFetchAbort
		allowStaleOnFetchRejection
		ignoreFetchAbort
		#o
		#u
		#d
		#a
		#s
		#p
		#m
		#g
		#f
		#v
		#h
		#E
		#b
		#y
		#x
		#B
		#A
		static unsafeExposeInternals(t) {
			return {
				starts: t.#b,
				ttls: t.#y,
				sizes: t.#E,
				keyMap: t.#d,
				keyList: t.#a,
				valList: t.#s,
				next: t.#p,
				prev: t.#m,
				get head() {
					return t.#g
				},
				get tail() {
					return t.#f
				},
				free: t.#v,
				isBackgroundFetch: (r) => t.#c(r),
				backgroundFetch: (r, n, i, s) => t.#F(r, n, i, s),
				moveToTail: (r) => t.#R(r),
				indexes: (r) => t.#_(r),
				rindexes: (r) => t.#w(r),
				isStale: (r) => t.#C(r),
			}
		}
		get max() {
			return this.#e
		}
		get maxSize() {
			return this.#t
		}
		get calculatedSize() {
			return this.#u
		}
		get size() {
			return this.#o
		}
		get fetchMethod() {
			return this.#r
		}
		get memoMethod() {
			return this.#l
		}
		get dispose() {
			return this.#i
		}
		get disposeAfter() {
			return this.#n
		}
		constructor(t) {
			let {
				max: r = 0,
				ttl: n,
				ttlResolution: i = 1,
				ttlAutopurge: s,
				updateAgeOnGet: o,
				updateAgeOnHas: a,
				allowStale: l,
				dispose: c,
				disposeAfter: u,
				noDisposeOnSet: f,
				noUpdateTTL: p,
				maxSize: g = 0,
				maxEntrySize: m = 0,
				sizeCalculation: y,
				fetchMethod: C,
				memoMethod: v,
				noDeleteOnFetchRejection: b,
				noDeleteOnStaleGet: w,
				allowStaleOnFetchRejection: B,
				allowStaleOnFetchAbort: M,
				ignoreFetchAbort: Q,
			} = t
			if (r !== 0 && !Lh(r)) throw new TypeError("max option must be a nonnegative integer")
			let O = r ? Gme(r) : Array
			if (!O) throw new Error("invalid max value: " + r)
			if (
				((this.#e = r),
				(this.#t = g),
				(this.maxEntrySize = m || this.#t),
				(this.sizeCalculation = y),
				this.sizeCalculation)
			) {
				if (!this.#t && !this.maxEntrySize)
					throw new TypeError("cannot set sizeCalculation without setting maxSize or maxEntrySize")
				if (typeof this.sizeCalculation != "function")
					throw new TypeError("sizeCalculation set to non-function")
			}
			if (v !== void 0 && typeof v != "function") throw new TypeError("memoMethod must be a function if defined")
			if (((this.#l = v), C !== void 0 && typeof C != "function"))
				throw new TypeError("fetchMethod must be a function if specified")
			if (
				((this.#r = C),
				(this.#B = !!C),
				(this.#d = new Map()),
				(this.#a = new Array(r).fill(void 0)),
				(this.#s = new Array(r).fill(void 0)),
				(this.#p = new O(r)),
				(this.#m = new O(r)),
				(this.#g = 0),
				(this.#f = 0),
				(this.#v = LW.create(r)),
				(this.#o = 0),
				(this.#u = 0),
				typeof c == "function" && (this.#i = c),
				typeof u == "function" ? ((this.#n = u), (this.#h = [])) : ((this.#n = void 0), (this.#h = void 0)),
				(this.#x = !!this.#i),
				(this.#A = !!this.#n),
				(this.noDisposeOnSet = !!f),
				(this.noUpdateTTL = !!p),
				(this.noDeleteOnFetchRejection = !!b),
				(this.allowStaleOnFetchRejection = !!B),
				(this.allowStaleOnFetchAbort = !!M),
				(this.ignoreFetchAbort = !!Q),
				this.maxEntrySize !== 0)
			) {
				if (this.#t !== 0 && !Lh(this.#t))
					throw new TypeError("maxSize must be a positive integer if specified")
				if (!Lh(this.maxEntrySize)) throw new TypeError("maxEntrySize must be a positive integer if specified")
				this.#q()
			}
			if (
				((this.allowStale = !!l),
				(this.noDeleteOnStaleGet = !!w),
				(this.updateAgeOnGet = !!o),
				(this.updateAgeOnHas = !!a),
				(this.ttlResolution = Lh(i) || i === 0 ? i : 1),
				(this.ttlAutopurge = !!s),
				(this.ttl = n || 0),
				this.ttl)
			) {
				if (!Lh(this.ttl)) throw new TypeError("ttl must be a positive integer if specified")
				this.#Q()
			}
			if (this.#e === 0 && this.ttl === 0 && this.#t === 0)
				throw new TypeError("At least one of max, maxSize, or ttl is required")
			if (!this.ttlAutopurge && !this.#e && !this.#t) {
				let Y = "LRU_CACHE_UNBOUNDED"
				Zut(Y) &&
					(Hme.add(Y),
					Wme(
						"TTL caching without ttlAutopurge, max, or maxSize can result in unbounded memory consumption.",
						"UnboundedCacheWarning",
						Y,
						e,
					))
			}
		}
		getRemainingTTL(t) {
			return this.#d.has(t) ? 1 / 0 : 0
		}
		#Q() {
			let t = new Ty(this.#e),
				r = new Ty(this.#e)
			;(this.#y = t),
				(this.#b = r),
				(this.#N = (s, o, a = Dy.now()) => {
					if (((r[s] = o !== 0 ? a : 0), (t[s] = o), o !== 0 && this.ttlAutopurge)) {
						let l = setTimeout(() => {
							this.#C(s) && this.#I(this.#a[s], "expire")
						}, o + 1)
						l.unref && l.unref()
					}
				}),
				(this.#D = (s) => {
					r[s] = t[s] !== 0 ? Dy.now() : 0
				}),
				(this.#S = (s, o) => {
					if (t[o]) {
						let a = t[o],
							l = r[o]
						if (!a || !l) return
						;(s.ttl = a), (s.start = l), (s.now = n || i())
						let c = s.now - l
						s.remainingTTL = a - c
					}
				})
			let n = 0,
				i = () => {
					let s = Dy.now()
					if (this.ttlResolution > 0) {
						n = s
						let o = setTimeout(() => (n = 0), this.ttlResolution)
						o.unref && o.unref()
					}
					return s
				}
			;(this.getRemainingTTL = (s) => {
				let o = this.#d.get(s)
				if (o === void 0) return 0
				let a = t[o],
					l = r[o]
				if (!a || !l) return 1 / 0
				let c = (n || i()) - l
				return a - c
			}),
				(this.#C = (s) => {
					let o = r[s],
						a = t[s]
					return !!a && !!o && (n || i()) - o > a
				})
		}
		#D = () => {}
		#S = () => {}
		#N = () => {}
		#C = () => !1
		#q() {
			let t = new Ty(this.#e)
			;(this.#u = 0),
				(this.#E = t),
				(this.#T = (r) => {
					;(this.#u -= t[r]), (t[r] = 0)
				}),
				(this.#P = (r, n, i, s) => {
					if (this.#c(n)) return 0
					if (!Lh(i))
						if (s) {
							if (typeof s != "function") throw new TypeError("sizeCalculation must be a function")
							if (((i = s(n, r)), !Lh(i)))
								throw new TypeError("sizeCalculation return invalid (expect positive integer)")
						} else
							throw new TypeError(
								"invalid size value (must be positive integer). When maxSize or maxEntrySize is used, sizeCalculation or size must be set.",
							)
					return i
				}),
				(this.#k = (r, n, i) => {
					if (((t[r] = n), this.#t)) {
						let s = this.#t - t[r]
						for (; this.#u > s; ) this.#M(!0)
					}
					;(this.#u += t[r]), i && ((i.entrySize = n), (i.totalCalculatedSize = this.#u))
				})
		}
		#T = (t) => {}
		#k = (t, r, n) => {}
		#P = (t, r, n, i) => {
			if (n || i) throw new TypeError("cannot set size without setting maxSize or maxEntrySize on cache")
			return 0
		};
		*#_({ allowStale: t = this.allowStale } = {}) {
			if (this.#o)
				for (let r = this.#f; !(!this.#L(r) || ((t || !this.#C(r)) && (yield r), r === this.#g)); )
					r = this.#m[r]
		}
		*#w({ allowStale: t = this.allowStale } = {}) {
			if (this.#o)
				for (let r = this.#g; !(!this.#L(r) || ((t || !this.#C(r)) && (yield r), r === this.#f)); )
					r = this.#p[r]
		}
		#L(t) {
			return t !== void 0 && this.#d.get(this.#a[t]) === t
		}
		*entries() {
			for (let t of this.#_())
				this.#s[t] !== void 0 &&
					this.#a[t] !== void 0 &&
					!this.#c(this.#s[t]) &&
					(yield [this.#a[t], this.#s[t]])
		}
		*rentries() {
			for (let t of this.#w())
				this.#s[t] !== void 0 &&
					this.#a[t] !== void 0 &&
					!this.#c(this.#s[t]) &&
					(yield [this.#a[t], this.#s[t]])
		}
		*keys() {
			for (let t of this.#_()) {
				let r = this.#a[t]
				r !== void 0 && !this.#c(this.#s[t]) && (yield r)
			}
		}
		*rkeys() {
			for (let t of this.#w()) {
				let r = this.#a[t]
				r !== void 0 && !this.#c(this.#s[t]) && (yield r)
			}
		}
		*values() {
			for (let t of this.#_()) this.#s[t] !== void 0 && !this.#c(this.#s[t]) && (yield this.#s[t])
		}
		*rvalues() {
			for (let t of this.#w()) this.#s[t] !== void 0 && !this.#c(this.#s[t]) && (yield this.#s[t])
		}
		[Symbol.iterator]() {
			return this.entries()
		}
		[Symbol.toStringTag] = "LRUCache"
		find(t, r = {}) {
			for (let n of this.#_()) {
				let i = this.#s[n],
					s = this.#c(i) ? i.__staleWhileFetching : i
				if (s !== void 0 && t(s, this.#a[n], this)) return this.get(this.#a[n], r)
			}
		}
		forEach(t, r = this) {
			for (let n of this.#_()) {
				let i = this.#s[n],
					s = this.#c(i) ? i.__staleWhileFetching : i
				s !== void 0 && t.call(r, s, this.#a[n], this)
			}
		}
		rforEach(t, r = this) {
			for (let n of this.#w()) {
				let i = this.#s[n],
					s = this.#c(i) ? i.__staleWhileFetching : i
				s !== void 0 && t.call(r, s, this.#a[n], this)
			}
		}
		purgeStale() {
			let t = !1
			for (let r of this.#w({ allowStale: !0 })) this.#C(r) && (this.#I(this.#a[r], "expire"), (t = !0))
			return t
		}
		info(t) {
			let r = this.#d.get(t)
			if (r === void 0) return
			let n = this.#s[r],
				i = this.#c(n) ? n.__staleWhileFetching : n
			if (i === void 0) return
			let s = { value: i }
			if (this.#y && this.#b) {
				let o = this.#y[r],
					a = this.#b[r]
				if (o && a) {
					let l = o - (Dy.now() - a)
					;(s.ttl = l), (s.start = Date.now())
				}
			}
			return this.#E && (s.size = this.#E[r]), s
		}
		dump() {
			let t = []
			for (let r of this.#_({ allowStale: !0 })) {
				let n = this.#a[r],
					i = this.#s[r],
					s = this.#c(i) ? i.__staleWhileFetching : i
				if (s === void 0 || n === void 0) continue
				let o = { value: s }
				if (this.#y && this.#b) {
					o.ttl = this.#y[r]
					let a = Dy.now() - this.#b[r]
					o.start = Math.floor(Date.now() - a)
				}
				this.#E && (o.size = this.#E[r]), t.unshift([n, o])
			}
			return t
		}
		load(t) {
			this.clear()
			for (let [r, n] of t) {
				if (n.start) {
					let i = Date.now() - n.start
					n.start = Dy.now() - i
				}
				this.set(r, n.value, n)
			}
		}
		set(t, r, n = {}) {
			if (r === void 0) return this.delete(t), this
			let {
					ttl: i = this.ttl,
					start: s,
					noDisposeOnSet: o = this.noDisposeOnSet,
					sizeCalculation: a = this.sizeCalculation,
					status: l,
				} = n,
				{ noUpdateTTL: c = this.noUpdateTTL } = n,
				u = this.#P(t, r, n.size || 0, a)
			if (this.maxEntrySize && u > this.maxEntrySize)
				return l && ((l.set = "miss"), (l.maxEntrySizeExceeded = !0)), this.#I(t, "set"), this
			let f = this.#o === 0 ? void 0 : this.#d.get(t)
			if (f === void 0)
				(f =
					this.#o === 0
						? this.#f
						: this.#v.length !== 0
							? this.#v.pop()
							: this.#o === this.#e
								? this.#M(!1)
								: this.#o),
					(this.#a[f] = t),
					(this.#s[f] = r),
					this.#d.set(t, f),
					(this.#p[this.#f] = f),
					(this.#m[f] = this.#f),
					(this.#f = f),
					this.#o++,
					this.#k(f, u, l),
					l && (l.set = "add"),
					(c = !1)
			else {
				this.#R(f)
				let p = this.#s[f]
				if (r !== p) {
					if (this.#B && this.#c(p)) {
						p.__abortController.abort(new Error("replaced"))
						let { __staleWhileFetching: g } = p
						g !== void 0 &&
							!o &&
							(this.#x && this.#i?.(g, t, "set"), this.#A && this.#h?.push([g, t, "set"]))
					} else o || (this.#x && this.#i?.(p, t, "set"), this.#A && this.#h?.push([p, t, "set"]))
					if ((this.#T(f), this.#k(f, u, l), (this.#s[f] = r), l)) {
						l.set = "replace"
						let g = p && this.#c(p) ? p.__staleWhileFetching : p
						g !== void 0 && (l.oldValue = g)
					}
				} else l && (l.set = "update")
			}
			if (
				(i !== 0 && !this.#y && this.#Q(),
				this.#y && (c || this.#N(f, i, s), l && this.#S(l, f)),
				!o && this.#A && this.#h)
			) {
				let p = this.#h,
					g
				for (; (g = p?.shift()); ) this.#n?.(...g)
			}
			return this
		}
		pop() {
			try {
				for (; this.#o; ) {
					let t = this.#s[this.#g]
					if ((this.#M(!0), this.#c(t))) {
						if (t.__staleWhileFetching) return t.__staleWhileFetching
					} else if (t !== void 0) return t
				}
			} finally {
				if (this.#A && this.#h) {
					let t = this.#h,
						r
					for (; (r = t?.shift()); ) this.#n?.(...r)
				}
			}
		}
		#M(t) {
			let r = this.#g,
				n = this.#a[r],
				i = this.#s[r]
			return (
				this.#B && this.#c(i)
					? i.__abortController.abort(new Error("evicted"))
					: (this.#x || this.#A) &&
						(this.#x && this.#i?.(i, n, "evict"), this.#A && this.#h?.push([i, n, "evict"])),
				this.#T(r),
				t && ((this.#a[r] = void 0), (this.#s[r] = void 0), this.#v.push(r)),
				this.#o === 1 ? ((this.#g = this.#f = 0), (this.#v.length = 0)) : (this.#g = this.#p[r]),
				this.#d.delete(n),
				this.#o--,
				r
			)
		}
		has(t, r = {}) {
			let { updateAgeOnHas: n = this.updateAgeOnHas, status: i } = r,
				s = this.#d.get(t)
			if (s !== void 0) {
				let o = this.#s[s]
				if (this.#c(o) && o.__staleWhileFetching === void 0) return !1
				if (this.#C(s)) i && ((i.has = "stale"), this.#S(i, s))
				else return n && this.#D(s), i && ((i.has = "hit"), this.#S(i, s)), !0
			} else i && (i.has = "miss")
			return !1
		}
		peek(t, r = {}) {
			let { allowStale: n = this.allowStale } = r,
				i = this.#d.get(t)
			if (i === void 0 || (!n && this.#C(i))) return
			let s = this.#s[i]
			return this.#c(s) ? s.__staleWhileFetching : s
		}
		#F(t, r, n, i) {
			let s = r === void 0 ? void 0 : this.#s[r]
			if (this.#c(s)) return s
			let o = new Bk(),
				{ signal: a } = n
			a?.addEventListener("abort", () => o.abort(a.reason), {
				signal: o.signal,
			})
			let l = { signal: o.signal, options: n, context: i },
				c = (y, C = !1) => {
					let { aborted: v } = o.signal,
						b = n.ignoreFetchAbort && y !== void 0
					if (
						(n.status &&
							(v && !C
								? ((n.status.fetchAborted = !0),
									(n.status.fetchError = o.signal.reason),
									b && (n.status.fetchAbortIgnored = !0))
								: (n.status.fetchResolved = !0)),
						v && !b && !C)
					)
						return f(o.signal.reason)
					let w = g
					return (
						this.#s[r] === g &&
							(y === void 0
								? w.__staleWhileFetching
									? (this.#s[r] = w.__staleWhileFetching)
									: this.#I(t, "fetch")
								: (n.status && (n.status.fetchUpdated = !0), this.set(t, y, l.options))),
						y
					)
				},
				u = (y) => (n.status && ((n.status.fetchRejected = !0), (n.status.fetchError = y)), f(y)),
				f = (y) => {
					let { aborted: C } = o.signal,
						v = C && n.allowStaleOnFetchAbort,
						b = v || n.allowStaleOnFetchRejection,
						w = b || n.noDeleteOnFetchRejection,
						B = g
					if (
						(this.#s[r] === g &&
							(!w || B.__staleWhileFetching === void 0
								? this.#I(t, "fetch")
								: v || (this.#s[r] = B.__staleWhileFetching)),
						b)
					)
						return (
							n.status && B.__staleWhileFetching !== void 0 && (n.status.returnedStale = !0),
							B.__staleWhileFetching
						)
					if (B.__returned === B) throw y
				},
				p = (y, C) => {
					let v = this.#r?.(t, s, l)
					v && v instanceof Promise && v.then((b) => y(b === void 0 ? void 0 : b), C),
						o.signal.addEventListener("abort", () => {
							;(!n.ignoreFetchAbort || n.allowStaleOnFetchAbort) &&
								(y(void 0), n.allowStaleOnFetchAbort && (y = (b) => c(b, !0)))
						})
				}
			n.status && (n.status.fetchDispatched = !0)
			let g = new Promise(p).then(c, u),
				m = Object.assign(g, {
					__abortController: o,
					__staleWhileFetching: s,
					__returned: void 0,
				})
			return (
				r === void 0
					? (this.set(t, m, { ...l.options, status: void 0 }), (r = this.#d.get(t)))
					: (this.#s[r] = m),
				m
			)
		}
		#c(t) {
			if (!this.#B) return !1
			let r = t
			return (
				!!r &&
				r instanceof Promise &&
				r.hasOwnProperty("__staleWhileFetching") &&
				r.__abortController instanceof Bk
			)
		}
		async fetch(t, r = {}) {
			let {
				allowStale: n = this.allowStale,
				updateAgeOnGet: i = this.updateAgeOnGet,
				noDeleteOnStaleGet: s = this.noDeleteOnStaleGet,
				ttl: o = this.ttl,
				noDisposeOnSet: a = this.noDisposeOnSet,
				size: l = 0,
				sizeCalculation: c = this.sizeCalculation,
				noUpdateTTL: u = this.noUpdateTTL,
				noDeleteOnFetchRejection: f = this.noDeleteOnFetchRejection,
				allowStaleOnFetchRejection: p = this.allowStaleOnFetchRejection,
				ignoreFetchAbort: g = this.ignoreFetchAbort,
				allowStaleOnFetchAbort: m = this.allowStaleOnFetchAbort,
				context: y,
				forceRefresh: C = !1,
				status: v,
				signal: b,
			} = r
			if (!this.#B)
				return (
					v && (v.fetch = "get"),
					this.get(t, {
						allowStale: n,
						updateAgeOnGet: i,
						noDeleteOnStaleGet: s,
						status: v,
					})
				)
			let w = {
					allowStale: n,
					updateAgeOnGet: i,
					noDeleteOnStaleGet: s,
					ttl: o,
					noDisposeOnSet: a,
					size: l,
					sizeCalculation: c,
					noUpdateTTL: u,
					noDeleteOnFetchRejection: f,
					allowStaleOnFetchRejection: p,
					allowStaleOnFetchAbort: m,
					ignoreFetchAbort: g,
					status: v,
					signal: b,
				},
				B = this.#d.get(t)
			if (B === void 0) {
				v && (v.fetch = "miss")
				let M = this.#F(t, B, w, y)
				return (M.__returned = M)
			} else {
				let M = this.#s[B]
				if (this.#c(M)) {
					let ne = n && M.__staleWhileFetching !== void 0
					return (
						v && ((v.fetch = "inflight"), ne && (v.returnedStale = !0)),
						ne ? M.__staleWhileFetching : (M.__returned = M)
					)
				}
				let Q = this.#C(B)
				if (!C && !Q) return v && (v.fetch = "hit"), this.#R(B), i && this.#D(B), v && this.#S(v, B), M
				let O = this.#F(t, B, w, y),
					j = O.__staleWhileFetching !== void 0 && n
				return (
					v && ((v.fetch = Q ? "stale" : "refresh"), j && Q && (v.returnedStale = !0)),
					j ? O.__staleWhileFetching : (O.__returned = O)
				)
			}
		}
		async forceFetch(t, r = {}) {
			let n = await this.fetch(t, r)
			if (n === void 0) throw new Error("fetch() returned undefined")
			return n
		}
		memo(t, r = {}) {
			let n = this.#l
			if (!n) throw new Error("no memoMethod provided to constructor")
			let { context: i, forceRefresh: s, ...o } = r,
				a = this.get(t, o)
			if (!s && a !== void 0) return a
			let l = n(t, a, { options: o, context: i })
			return this.set(t, l, o), l
		}
		get(t, r = {}) {
			let {
					allowStale: n = this.allowStale,
					updateAgeOnGet: i = this.updateAgeOnGet,
					noDeleteOnStaleGet: s = this.noDeleteOnStaleGet,
					status: o,
				} = r,
				a = this.#d.get(t)
			if (a !== void 0) {
				let l = this.#s[a],
					c = this.#c(l)
				return (
					o && this.#S(o, a),
					this.#C(a)
						? (o && (o.get = "stale"),
							c
								? (o && n && l.__staleWhileFetching !== void 0 && (o.returnedStale = !0),
									n ? l.__staleWhileFetching : void 0)
								: (s || this.#I(t, "expire"), o && n && (o.returnedStale = !0), n ? l : void 0))
						: (o && (o.get = "hit"), c ? l.__staleWhileFetching : (this.#R(a), i && this.#D(a), l))
				)
			} else o && (o.get = "miss")
		}
		#U(t, r) {
			;(this.#m[r] = t), (this.#p[t] = r)
		}
		#R(t) {
			t !== this.#f &&
				(t === this.#g ? (this.#g = this.#p[t]) : this.#U(this.#m[t], this.#p[t]),
				this.#U(this.#f, t),
				(this.#f = t))
		}
		delete(t) {
			return this.#I(t, "delete")
		}
		#I(t, r) {
			let n = !1
			if (this.#o !== 0) {
				let i = this.#d.get(t)
				if (i !== void 0)
					if (((n = !0), this.#o === 1)) this.#O(r)
					else {
						this.#T(i)
						let s = this.#s[i]
						if (
							(this.#c(s)
								? s.__abortController.abort(new Error("deleted"))
								: (this.#x || this.#A) &&
									(this.#x && this.#i?.(s, t, r), this.#A && this.#h?.push([s, t, r])),
							this.#d.delete(t),
							(this.#a[i] = void 0),
							(this.#s[i] = void 0),
							i === this.#f)
						)
							this.#f = this.#m[i]
						else if (i === this.#g) this.#g = this.#p[i]
						else {
							let o = this.#m[i]
							this.#p[o] = this.#p[i]
							let a = this.#p[i]
							this.#m[a] = this.#m[i]
						}
						this.#o--, this.#v.push(i)
					}
			}
			if (this.#A && this.#h?.length) {
				let i = this.#h,
					s
				for (; (s = i?.shift()); ) this.#n?.(...s)
			}
			return n
		}
		clear() {
			return this.#O("delete")
		}
		#O(t) {
			for (let r of this.#w({ allowStale: !0 })) {
				let n = this.#s[r]
				if (this.#c(n)) n.__abortController.abort(new Error("deleted"))
				else {
					let i = this.#a[r]
					this.#x && this.#i?.(n, i, t), this.#A && this.#h?.push([n, i, t])
				}
			}
			if (
				(this.#d.clear(),
				this.#s.fill(void 0),
				this.#a.fill(void 0),
				this.#y && this.#b && (this.#y.fill(0), this.#b.fill(0)),
				this.#E && this.#E.fill(0),
				(this.#g = 0),
				(this.#f = 0),
				(this.#v.length = 0),
				(this.#u = 0),
				(this.#o = 0),
				this.#A && this.#h)
			) {
				let r = this.#h,
					n
				for (; (n = r?.shift()); ) this.#n?.(...n)
			}
		}
	}