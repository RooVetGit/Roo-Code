
	var mHe = _E(),
		{ ClientDestroyedError: mO, ClientClosedError: yHe, InvalidArgumentError: Ym } = Vr(),
		{ kDestroy: CHe, kClose: vHe, kClosed: wE, kDestroyed: Km, kDispatch: yO, kInterceptors: rp } = Qn(),
		wd = Symbol("onDestroyed"),
		Jm = Symbol("onClosed"),
		mB = Symbol("Intercepted Dispatch"),
		CO = class extends mHe {
			constructor() {
				super(), (this[Km] = !1), (this[wd] = null), (this[wE] = !1), (this[Jm] = [])
			}
			get destroyed() {
				return this[Km]
			}
			get closed() {
				return this[wE]
			}
			get interceptors() {
				return this[rp]
			}
			set interceptors(t) {
				if (t) {
					for (let r = t.length - 1; r >= 0; r--)
						if (typeof this[rp][r] != "function") throw new Ym("interceptor must be an function")
				}
				this[rp] = t
			}
			close(t) {
				if (t === void 0)
					return new Promise((n, i) => {
						this.close((s, o) => (s ? i(s) : n(o)))
					})
				if (typeof t != "function") throw new Ym("invalid callback")
				if (this[Km]) {
					queueMicrotask(() => t(new mO(), null))
					return
				}
				if (this[wE]) {
					this[Jm] ? this[Jm].push(t) : queueMicrotask(() => t(null, null))
					return
				}
				;(this[wE] = !0), this[Jm].push(t)
				let r = () => {
					let n = this[Jm]
					this[Jm] = null
					for (let i = 0; i < n.length; i++) n[i](null, null)
				}
				this[vHe]()
					.then(() => this.destroy())
					.then(() => {
						queueMicrotask(r)
					})
			}
			destroy(t, r) {
				if ((typeof t == "function" && ((r = t), (t = null)), r === void 0))
					return new Promise((i, s) => {
						this.destroy(t, (o, a) => (o ? s(o) : i(a)))
					})
				if (typeof r != "function") throw new Ym("invalid callback")
				if (this[Km]) {
					this[wd] ? this[wd].push(r) : queueMicrotask(() => r(null, null))
					return
				}
				t || (t = new mO()), (this[Km] = !0), (this[wd] = this[wd] || []), this[wd].push(r)
				let n = () => {
					let i = this[wd]
					this[wd] = null
					for (let s = 0; s < i.length; s++) i[s](null, null)
				}
				this[CHe](t).then(() => {
					queueMicrotask(n)
				})
			}
			[mB](t, r) {
				if (!this[rp] || this[rp].length === 0) return (this[mB] = this[yO]), this[yO](t, r)
				let n = this[yO].bind(this)
				for (let i = this[rp].length - 1; i >= 0; i--) n = this[rp][i](n)
				return (this[mB] = n), n(t, r)
			}
			dispatch(t, r) {
				if (!r || typeof r != "object") throw new Ym("handler must be an object")
				try {
					if (!t || typeof t != "object") throw new Ym("opts must be an object.")
					if (this[Km] || this[wd]) throw new mO()
					if (this[wE]) throw new yHe()
					return this[mB](t, r)
				} catch (n) {
					if (typeof r.onError != "function") throw new Ym("invalid onError method")
					return r.onError(n), !1
				}
			}
		}