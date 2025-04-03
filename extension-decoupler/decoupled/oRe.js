
	var N8e = zm(),
		P8e = fq(),
		{
			kConnected: gq,
			kSize: kre,
			kRunning: Mre,
			kPending: Fre,
			kQueued: YE,
			kBusy: L8e,
			kFree: U8e,
			kUrl: O8e,
			kClose: q8e,
			kDestroy: V8e,
			kDispatch: H8e,
		} = Qn(),
		W8e = Rre(),
		Lo = Symbol("clients"),
		io = Symbol("needDrain"),
		KE = Symbol("queue"),
		pq = Symbol("closed resolve"),
		Aq = Symbol("onDrain"),
		Qre = Symbol("onConnect"),
		Nre = Symbol("onDisconnect"),
		Pre = Symbol("onConnectionError"),
		mq = Symbol("get dispatcher"),
		Ure = Symbol("add client"),
		Ore = Symbol("remove client"),
		Lre = Symbol("stats"),
		yq = class extends N8e {
			constructor() {
				super(), (this[KE] = new P8e()), (this[Lo] = []), (this[YE] = 0)
				let t = this
				;(this[Aq] = function (n, i) {
					let s = t[KE],
						o = !1
					for (; !o; ) {
						let a = s.shift()
						if (!a) break
						t[YE]--, (o = !this.dispatch(a.opts, a.handler))
					}
					;(this[io] = o),
						!this[io] && t[io] && ((t[io] = !1), t.emit("drain", n, [t, ...i])),
						t[pq] && s.isEmpty() && Promise.all(t[Lo].map((a) => a.close())).then(t[pq])
				}),
					(this[Qre] = (r, n) => {
						t.emit("connect", r, [t, ...n])
					}),
					(this[Nre] = (r, n, i) => {
						t.emit("disconnect", r, [t, ...n], i)
					}),
					(this[Pre] = (r, n, i) => {
						t.emit("connectionError", r, [t, ...n], i)
					}),
					(this[Lre] = new W8e(this))
			}
			get [L8e]() {
				return this[io]
			}
			get [gq]() {
				return this[Lo].filter((t) => t[gq]).length
			}
			get [U8e]() {
				return this[Lo].filter((t) => t[gq] && !t[io]).length
			}
			get [Fre]() {
				let t = this[YE]
				for (let { [Fre]: r } of this[Lo]) t += r
				return t
			}
			get [Mre]() {
				let t = 0
				for (let { [Mre]: r } of this[Lo]) t += r
				return t
			}
			get [kre]() {
				let t = this[YE]
				for (let { [kre]: r } of this[Lo]) t += r
				return t
			}
			get stats() {
				return this[Lre]
			}
			async [q8e]() {
				this[KE].isEmpty()
					? await Promise.all(this[Lo].map((t) => t.close()))
					: await new Promise((t) => {
							this[pq] = t
						})
			}
			async [V8e](t) {
				for (;;) {
					let r = this[KE].shift()
					if (!r) break
					r.handler.onError(t)
				}
				await Promise.all(this[Lo].map((r) => r.destroy(t)))
			}
			[H8e](t, r) {
				let n = this[mq]()
				return (
					n
						? n.dispatch(t, r) || ((n[io] = !0), (this[io] = !this[mq]()))
						: ((this[io] = !0), this[KE].push({ opts: t, handler: r }), this[YE]++),
					!this[io]
				)
			}
			[Ure](t) {
				return (
					t
						.on("drain", this[Aq])
						.on("connect", this[Qre])
						.on("disconnect", this[Nre])
						.on("connectionError", this[Pre]),
					this[Lo].push(t),
					this[io] &&
						queueMicrotask(() => {
							this[io] && this[Aq](t[O8e], [this, t])
						}),
					this
				)
			}
			[Ore](t) {
				t.close(() => {
					let r = this[Lo].indexOf(t)
					r !== -1 && this[Lo].splice(r, 1)
				}),
					(this[io] = this[Lo].some((r) => !r[io] && r.closed !== !0 && r.destroyed !== !0))
			}
		}